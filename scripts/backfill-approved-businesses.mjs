#!/usr/bin/env node
/**
 * One-time backfill script (Firebase Admin SDK):
 * Finds business users who were approved BEFORE the fix that creates
 * a `businesses` collection document on approval. Creates the missing
 * business listings so they appear in the directory.
 *
 * SETUP:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → downloads a JSON file
 *   3. Place it in this folder as: scripts/serviceAccountKey.json
 *   4. Run the script (see Usage below)
 *   5. DELETE the key file when done!
 *
 * Usage:
 *   node scripts/backfill-approved-businesses.mjs              # dry-run (default)
 *   node scripts/backfill-approved-businesses.mjs --apply      # actually write to Firestore
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Load service account key ──
const KEY_PATH = new URL('./serviceAccountKey.json', import.meta.url);
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
} catch {
  console.error(`\n❌ Could not read service account key at:\n   ${KEY_PATH.pathname}\n`);
  console.error('Steps to fix:');
  console.error('  1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('  2. Click "Generate new private key"');
  console.error('  3. Save the file as: scripts/serviceAccountKey.json');
  console.error('  4. Re-run this script\n');
  process.exit(1);
}

// ── Initialize Firebase Admin ──
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n🔍 Backfill: approved business users → businesses collection`);
  console.log(`   Mode: ${DRY_RUN ? '🟡 DRY RUN (pass --apply to write)' : '🟢 APPLY'}\n`);

  // 1. Find all business users who were approved
  const usersSnap = await db.collection('users')
    .where('accountType', '==', 'business')
    .where('adminApproved', '==', true)
    .get();

  if (usersSnap.empty) {
    console.log('✅ No approved business users found. Nothing to backfill.');
    process.exit(0);
  }

  console.log(`Found ${usersSnap.size} approved business user(s).\n`);

  // 2. Find all businesses that already have a _signupUserId or ownerId link
  const existingBizSnap = await db.collection('businesses').get();
  const linkedUserIds = new Set();
  existingBizSnap.docs.forEach((d) => {
    const data = d.data();
    if (data._signupUserId) linkedUserIds.add(data._signupUserId);
    if (data.ownerId) linkedUserIds.add(data.ownerId);
  });

  console.log(`Found ${linkedUserIds.size} user(s) already linked to a business listing.\n`);

  // 3. Find users who need a business doc created
  const usersToBackfill = [];
  usersSnap.docs.forEach((d) => {
    if (!linkedUserIds.has(d.id)) {
      usersToBackfill.push({ id: d.id, ...d.data() });
    }
  });

  if (usersToBackfill.length === 0) {
    console.log('✅ All approved business users already have a business listing. Nothing to do.');
    process.exit(0);
  }

  console.log(`🛠  ${usersToBackfill.length} user(s) need a businesses doc:\n`);

  let created = 0;
  for (const userData of usersToBackfill) {
    const address = userData.businessAddress || {};
    const businessListing = {
      // Core fields matching existing Business interface
      name: userData.businessName || '',
      category: userData.businessType || '',
      desc: '',
      location: address.formattedAddress ||
        [address.street, address.city, address.state, address.zip].filter(Boolean).join(', '),
      phone: userData.phone || '',
      website: '',
      email: userData.email || '',
      hours: '',
      menu: '',
      services: '',
      priceRange: '',
      yearEstablished: new Date().getFullYear(),
      paymentMethods: [],
      deliveryOptions: [],
      specialtyTags: [],
      emoji: '',
      rating: 0,
      reviews: 0,
      promoted: false,
      bgColor: '#f0f4ff',
      ownerId: userData.id,
      ownerName: userData.name || '',
      ownerEmail: userData.email || '',
      createdAt: FieldValue.serverTimestamp(),

      // Geolocation
      latitude: address.lat || null,
      longitude: address.lng || null,

      // Address details
      country: address.country || 'US',
      addressComponents: address,
      stateOfIncorp: userData.stateOfIncorp || null,

      // TIN
      tin: userData.tinNumber || null,
      tinVerified: userData.tinValidationStatus === 'valid',

      // Registration & verification — already approved
      kycStatus: 'approved',
      registrationStatus: 'approved',
      verified: true,
      verifiedAt: FieldValue.serverTimestamp(),
      verificationMethod: 'admin',

      // Profit status
      profitStatus: userData.profitStatus || '',
      isRegistered: userData.isRegistered ?? false,

      // KYC docs
      verificationDocs: (userData.verificationDocUrls || []).map((url, i) => ({
        url,
        name: `Document ${i + 1}`,
      })),
      photoIdUrl: userData.photoIdUrl || null,
      beneficialOwners: userData.beneficialOwners || [],

      // Photos & analytics
      photos: [],
      coverPhotoIndex: 0,
      viewCount: 0,
      contactClicks: 0,
      shareCount: 0,
      followerCount: 0,
      followers: [],

      // Link back to signup
      _signupUserId: userData.id,
      _backfilled: true,
    };

    console.log(`  → ${userData.businessName || '(no name)'} (user: ${userData.id}, email: ${userData.email})`);
    console.log(`    Location: ${businessListing.location || '(none)'}`);
    console.log(`    Category: ${businessListing.category || '(none)'}`);

    if (!DRY_RUN) {
      const docRef = await db.collection('businesses').add(businessListing);
      console.log(`    ✅ Created businesses/${docRef.id}`);
      created++;
    } else {
      console.log(`    ⏭  Skipped (dry run)`);
    }
    console.log();
  }

  console.log(DRY_RUN
    ? `\n🟡 Dry run complete. Run with --apply to create ${usersToBackfill.length} business listing(s).`
    : `\n✅ Done! Created ${created} business listing(s).`
  );

  if (!DRY_RUN) {
    console.log('\n⚠️  IMPORTANT: Delete scripts/serviceAccountKey.json now — never commit it!\n');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
