#!/usr/bin/env node
/**
 * Seed script: Populates catering menu items and enables catering on existing businesses.
 *
 * SETUP: Same as backfill script — requires scripts/serviceAccountKey.json
 *   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save as: scripts/serviceAccountKey.json
 *
 * Usage:
 *   node scripts/seed-catering-data.mjs              # dry-run
 *   node scripts/seed-catering-data.mjs --apply      # write to Firestore
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Load service account key ──
const KEY_PATH = new URL('./serviceAccountKey.json', import.meta.url);
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
} catch {
  console.error(`\n❌ Could not read service account key at:\n   ${KEY_PATH.pathname}`);
  console.error('   Place your Firebase service account key as: scripts/serviceAccountKey.json\n');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const DRY_RUN = !process.argv.includes('--apply');

// ── Sample menu items by cuisine ──
const MENU_CATALOG = {
  'Restaurant & Food': [
    // Indian
    { name: 'Butter Chicken Tray', price: 8999, pricingType: 'per_tray', servesCount: 10, category: 'Entree', dietaryTags: ['gluten_free'], description: 'Creamy tomato-based chicken curry, serves 10' },
    { name: 'Vegetable Biryani Tray', price: 6999, pricingType: 'per_tray', servesCount: 10, category: 'Entree', dietaryTags: ['vegetarian', 'vegan'], description: 'Fragrant basmati rice with mixed vegetables and aromatic spices' },
    { name: 'Samosa Platter (20 pcs)', price: 3499, pricingType: 'flat_rate', category: 'Appetizer', dietaryTags: ['vegetarian'], description: 'Crispy pastries filled with spiced potatoes and peas' },
    { name: 'Paneer Tikka Platter', price: 4499, pricingType: 'per_tray', servesCount: 8, category: 'Appetizer', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Grilled cottage cheese marinated in tandoori spices' },
    { name: 'Dal Makhani Tray', price: 5499, pricingType: 'per_tray', servesCount: 10, category: 'Entree', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Rich and creamy black lentil curry slow-cooked overnight' },
    { name: 'Naan Basket (20 pcs)', price: 2499, pricingType: 'flat_rate', category: 'Side', dietaryTags: ['vegetarian'], description: 'Assorted fresh naan: plain, garlic, and butter' },
    { name: 'Chicken Tikka Masala Tray', price: 9499, pricingType: 'per_tray', servesCount: 10, category: 'Entree', dietaryTags: ['gluten_free'], description: 'Grilled chicken in rich masala sauce' },
    { name: 'Mango Lassi (per person)', price: 399, pricingType: 'per_person', category: 'Beverage', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Sweet yogurt drink with fresh mango pulp' },
    { name: 'Gulab Jamun (30 pcs)', price: 2999, pricingType: 'flat_rate', category: 'Dessert', dietaryTags: ['vegetarian'], description: 'Warm milk dumplings soaked in rose-cardamom syrup' },
    { name: 'Raita Bowl', price: 1499, pricingType: 'per_tray', servesCount: 10, category: 'Side', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Cool yogurt with cucumber, mint, and spices' },
    { name: 'Tandoori Chicken Platter', price: 7999, pricingType: 'per_tray', servesCount: 8, category: 'Entree', dietaryTags: ['gluten_free', 'halal'], description: 'Whole chicken legs marinated and roasted in tandoor' },
    { name: 'Chole Bhature Tray', price: 5999, pricingType: 'per_tray', servesCount: 10, category: 'Entree', dietaryTags: ['vegetarian'], description: 'Spiced chickpea curry with fluffy fried bread' },
  ],
  'Tiffin': [
    { name: 'South Indian Breakfast Box', price: 899, pricingType: 'per_person', category: 'Package', dietaryTags: ['vegetarian'], description: 'Idli, vada, dosa, sambar, and coconut chutney' },
    { name: 'Mini Tiffin Combo', price: 1099, pricingType: 'per_person', category: 'Package', dietaryTags: ['vegetarian'], description: 'Rice, sambar, rasam, dry curry, and curd' },
    { name: 'Dosa Bar Setup', price: 12999, pricingType: 'flat_rate', servesCount: 25, category: 'Package', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Live dosa station with 4 varieties and chutneys, serves 25' },
    { name: 'Idli Platter (40 pcs)', price: 3299, pricingType: 'flat_rate', category: 'Appetizer', dietaryTags: ['vegetarian', 'vegan'], description: 'Steamed rice cakes with sambar and coconut chutney' },
    { name: 'Filter Coffee (per person)', price: 299, pricingType: 'per_person', category: 'Beverage', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Authentic South Indian filter coffee' },
    { name: 'Medu Vada Tray (30 pcs)', price: 2799, pricingType: 'flat_rate', category: 'Appetizer', dietaryTags: ['vegetarian', 'vegan'], description: 'Crispy lentil fritters with chutney trio' },
  ],
  'Grocery & Market': [
    { name: 'Fresh Fruit Platter', price: 4999, pricingType: 'per_tray', servesCount: 15, category: 'Side', dietaryTags: ['vegan', 'gluten_free'], description: 'Seasonal fruits beautifully arranged' },
    { name: 'Chaat Station', price: 799, pricingType: 'per_person', category: 'Appetizer', dietaryTags: ['vegetarian'], description: 'Pani puri, bhel puri, and sev puri setup' },
    { name: 'Mithai Assortment Box', price: 3999, pricingType: 'flat_rate', category: 'Dessert', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Premium assortment: barfi, peda, ladoo, and kaju katli (2 lbs)' },
    { name: 'Chai Service (per person)', price: 249, pricingType: 'per_person', category: 'Beverage', dietaryTags: ['vegetarian', 'gluten_free'], description: 'Masala chai with milk and sugar options' },
  ],
};

async function main() {
  console.log(`\n🍽️  Seed: Catering menu items + enable catering on businesses`);
  console.log(`   Mode: ${DRY_RUN ? '🟡 DRY RUN (pass --apply to write)' : '🟢 APPLY'}\n`);

  // 1. Find all approved businesses in catering-eligible categories
  const cateringCategories = ['Restaurant & Food', 'Tiffin', 'Grocery & Market'];
  const allBizSnap = await db.collection('businesses').get();

  const eligibleBusinesses = [];
  allBizSnap.docs.forEach((d) => {
    const data = d.data();
    if (cateringCategories.includes(data.category) &&
        (data.registrationStatus === 'approved' || data.verified === true)) {
      eligibleBusinesses.push({ id: d.id, ...data });
    }
  });

  if (eligibleBusinesses.length === 0) {
    console.log('⚠️  No approved businesses found in catering-eligible categories.');
    console.log('   Categories checked: ' + cateringCategories.join(', '));
    console.log('   Will create a demo business instead.\n');

    // Create a demo business if none exist
    if (!DRY_RUN) {
      const demoRef = await db.collection('businesses').add({
        name: 'Spice Route Catering',
        category: 'Restaurant & Food',
        desc: 'Authentic Indian catering for corporate events and cultural celebrations. Specializing in North and South Indian cuisine.',
        location: 'Houston, TX',
        phone: '(713) 555-0123',
        email: 'orders@spiceroute.demo',
        hours: 'Mon-Sat 9am-8pm',
        rating: 4.5,
        reviews: 12,
        promoted: false,
        bgColor: '#FFF7ED',
        heritage: 'Indian',
        priceRange: '$$',
        yearEstablished: 2020,
        specialtyTags: ['North Indian', 'South Indian', 'Halal', 'Vegetarian Options'],
        paymentMethods: ['Cash', 'Card'],
        deliveryOptions: ['Delivery', 'Pickup'],
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        verificationMethod: 'admin',
        registrationStatus: 'approved',
        kycStatus: 'approved',
        isCateringEnabled: true,
        latitude: 29.7604,
        longitude: -95.3698,
        photos: [],
        coverPhotoIndex: 0,
        viewCount: 0,
        contactClicks: 0,
        shareCount: 0,
        followerCount: 0,
        followers: [],
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ Created demo business: Spice Route Catering (${demoRef.id})`);
      eligibleBusinesses.push({ id: demoRef.id, name: 'Spice Route Catering', category: 'Restaurant & Food' });
    } else {
      console.log('   ⏭  Skipped (dry run)\n');
      eligibleBusinesses.push({ id: 'DEMO_ID', name: 'Spice Route Catering (demo)', category: 'Restaurant & Food' });
    }
  }

  console.log(`Found ${eligibleBusinesses.length} eligible business(es):\n`);

  let totalMenuItems = 0;

  for (const biz of eligibleBusinesses) {
    const menuItems = MENU_CATALOG[biz.category] || MENU_CATALOG['Restaurant & Food'];
    console.log(`  📍 ${biz.name} (${biz.category}) — ${menuItems.length} menu items`);

    // Enable catering on the business
    if (!DRY_RUN) {
      await db.collection('businesses').doc(biz.id).update({
        isCateringEnabled: true,
      });
      console.log(`     ✅ Set isCateringEnabled: true`);
    }

    // Check for existing menu items
    const existingSnap = await db.collection('cateringMenuItems')
      .where('businessId', '==', biz.id)
      .get();

    if (!existingSnap.empty) {
      console.log(`     ⏭  Already has ${existingSnap.size} menu items, skipping`);
      continue;
    }

    // Create menu items
    for (const item of menuItems) {
      if (!DRY_RUN) {
        await db.collection('cateringMenuItems').add({
          businessId: biz.id,
          name: item.name,
          description: item.description || '',
          price: item.price,
          pricingType: item.pricingType,
          servesCount: item.servesCount || null,
          category: item.category,
          dietaryTags: item.dietaryTags || [],
          available: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      totalMenuItems++;
    }
    console.log(`     ${DRY_RUN ? '⏭  Would create' : '✅ Created'} ${menuItems.length} menu items`);
    console.log();
  }

  // 2. Enable the catering feature flag
  console.log(`\n🏳️  Feature flag: modules_catering`);
  if (!DRY_RUN) {
    const featureRef = db.collection('appConfig').doc('featureSettings');
    const featureSnap = await featureRef.get();
    if (featureSnap.exists) {
      await featureRef.update({ modules_catering: true });
    } else {
      await featureRef.set({ modules_catering: true }, { merge: true });
    }
    console.log(`   ✅ Set modules_catering: true in appConfig/featureSettings`);
  } else {
    console.log(`   ⏭  Would set modules_catering: true (dry run)`);
  }

  console.log(DRY_RUN
    ? `\n🟡 Dry run complete. Would create ${totalMenuItems} menu items across ${eligibleBusinesses.length} business(es).\n   Run with --apply to write to Firestore.`
    : `\n✅ Done! Created ${totalMenuItems} menu items across ${eligibleBusinesses.length} business(es).`
  );

  if (!DRY_RUN) {
    console.log('\n⚠️  Remember to delete scripts/serviceAccountKey.json when done!\n');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
