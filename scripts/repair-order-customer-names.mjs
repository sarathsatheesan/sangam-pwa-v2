#!/usr/bin/env node
/**
 * One-time repair script (Firebase Admin SDK):
 * Finds RFP-origin catering orders with empty/missing customerName,
 * looks up the associated quote response for the customer details,
 * and patches the order documents.
 *
 * Also fixes orders created with wrong totals after a reprice was accepted:
 * recalculates subtotal/tax/total using the negotiated response.total.
 *
 * SETUP:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → downloads a JSON file
 *   3. Place it in this folder as: scripts/serviceAccountKey.json
 *   4. Run the script (see Usage below)
 *   5. DELETE the key file when done!
 *
 * Usage:
 *   node scripts/repair-order-customer-names.mjs              # dry-run (default)
 *   node scripts/repair-order-customer-names.mjs --apply      # actually write to Firestore
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load service account key ──
const keyPath = new URL('./serviceAccountKey.json', import.meta.url);
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌  Missing serviceAccountKey.json — see instructions at top of this file.');
  process.exit(1);
}

const dryRun = !process.argv.includes('--apply');
if (dryRun) {
  console.log('🔍  DRY RUN — no changes will be written. Pass --apply to write.\n');
} else {
  console.log('⚡  APPLY MODE — changes WILL be written to Firestore.\n');
}

// ── Init Firebase Admin ──
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function repairOrders() {
  // 1. Fetch ALL catering orders (not just RFP — some may have rfpOrigin missing)
  const ordersSnap = await db.collection('cateringOrders').get();

  console.log(`Found ${ordersSnap.size} catering orders total.\n`);

  // First pass: show all orders with empty names for debugging
  const emptyNameOrders = [];
  for (const d of ordersSnap.docs) {
    const o = d.data();
    if (!o.customerName || o.customerName.trim() === '') {
      emptyNameOrders.push({ id: d.id, total: o.total, eventDate: o.eventDate, rfpOrigin: o.rfpOrigin, businessName: o.businessName });
    }
  }
  if (emptyNameOrders.length > 0) {
    console.log(`Orders with empty customerName (${emptyNameOrders.length}):`);
    for (const o of emptyNameOrders) {
      console.log(`  - ${o.id} | $${((o.total || 0) / 100).toFixed(2)} | ${o.eventDate || '?'} | rfp=${o.rfpOrigin || false} | biz=${o.businessName || '?'}`);
    }
    console.log('');
  }

  let nameFixCount = 0;
  let priceFixCount = 0;
  let skippedCount = 0;

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    const orderId = orderDoc.id;
    const responseId = order.quoteResponseId;

    const needsNameFix = !order.customerName || order.customerName.trim() === '';
    const needsPriceFix = false; // We'll check below

    // Look up the associated quote response (if available)
    let response = null;
    if (responseId) {
      const responseSnap = await db.collection('cateringQuoteResponses').doc(responseId).get();
      if (responseSnap.exists) {
        response = responseSnap.data();
      }
    }

    const updates = {};

    // ── Fix 1: Missing customer name ──
    if (needsNameFix) {
      let foundName = false;

      // Try 1: from quote response
      if (response && response.customerName) {
        updates.customerName = response.customerName;
        updates.contactName = response.customerName;
        if (response.customerEmail) updates.customerEmail = response.customerEmail;
        if (response.customerPhone) {
          updates.customerPhone = response.customerPhone;
          updates.contactPhone = response.customerPhone;
        }
        console.log(`  🔧  Order ${orderId} — will set customerName to "${response.customerName}" (from quote response)`);
        nameFixCount++;
        foundName = true;
      }

      // Try 2: from user profile via customerId on the order
      if (!foundName && order.customerId) {
        const userSnap = await db.collection('users').doc(order.customerId).get();
        if (userSnap.exists) {
          const user = userSnap.data();
          const userName = user.name || user.displayName || '';
          if (userName) {
            updates.customerName = userName;
            updates.contactName = userName;
            if (user.email) updates.customerEmail = user.email;
            if (user.phone) {
              updates.customerPhone = user.phone;
              updates.contactPhone = user.phone;
            }
            console.log(`  🔧  Order ${orderId} — will set customerName to "${userName}" (from user profile)`);
            nameFixCount++;
            foundName = true;
          }
        }
      }

      // Try 3: from quote request's customerId
      if (!foundName && order.quoteRequestId) {
        const requestSnap = await db.collection('cateringQuoteRequests').doc(order.quoteRequestId).get();
        if (requestSnap.exists) {
          const request = requestSnap.data();
          if (request.customerId) {
            const userSnap = await db.collection('users').doc(request.customerId).get();
            if (userSnap.exists) {
              const user = userSnap.data();
              const userName = user.name || user.displayName || '';
              if (userName) {
                updates.customerName = userName;
                updates.contactName = userName;
                if (user.email) updates.customerEmail = user.email;
                if (user.phone) {
                  updates.customerPhone = user.phone;
                  updates.contactPhone = user.phone;
                }
                console.log(`  🔧  Order ${orderId} — will set customerName to "${userName}" (from quote request user)`);
                nameFixCount++;
                foundName = true;
              }
            }
          }
        }
      }

      if (!foundName) {
        console.log(`  ⚠️  Order ${orderId} — no customer name found anywhere, skipping name fix.`);
      }
    }

    // ── Fix 2: Wrong total after reprice ──
    const isRepriceAccepted = response && (response.repriceStatus === 'vendor_accepted' || response.repriceStatus === 'counter_accepted');
    if (isRepriceAccepted && response.total != null) {
      // response.total is the negotiated total (subtotal + delivery)
      const deliveryFee = response.deliveryFee || 0;
      const negotiatedSubtotal = Math.max(0, response.total - deliveryFee);
      const itemSubtotal = (order.items || []).reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

      // Check if order was created with item-level prices instead of negotiated price
      // Only fix if the negotiated price is LOWER (positive discount — price went down)
      if (order.subtotal === itemSubtotal && itemSubtotal !== negotiatedSubtotal && negotiatedSubtotal < itemSubtotal) {
        const newTax = Math.round((negotiatedSubtotal + deliveryFee) * 0.0825);
        const newTotal = negotiatedSubtotal + deliveryFee + newTax;

        updates.originalSubtotal = itemSubtotal;
        updates.repriceDiscount = itemSubtotal - negotiatedSubtotal;
        updates.subtotal = negotiatedSubtotal;
        updates.tax = newTax;
        updates.total = newTotal;

        console.log(`  💰  Order ${orderId} — will fix total: $${(order.total / 100).toFixed(2)} → $${(newTotal / 100).toFixed(2)} (reprice discount: $${((itemSubtotal - negotiatedSubtotal) / 100).toFixed(2)})`);
        priceFixCount++;
      }
    }

    // ── Apply updates ──
    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        await db.collection('cateringOrders').doc(orderId).update(updates);
        console.log(`  ✅  Order ${orderId} — updated.`);
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Summary:`);
  console.log(`  Customer name fixes: ${nameFixCount}`);
  console.log(`  Price/total fixes:   ${priceFixCount}`);
  console.log(`  Skipped (no fix needed): ${skippedCount}`);
  if (dryRun && (nameFixCount > 0 || priceFixCount > 0)) {
    console.log(`\n  Run with --apply to write these changes.`);
  }
}

repairOrders()
  .then(() => { console.log('\nDone.'); process.exit(0); })
  .catch((err) => { console.error('Fatal error:', err); process.exit(1); });
