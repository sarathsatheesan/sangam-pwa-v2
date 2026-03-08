// Migration script: Update all posts with type 'social' to 'community' in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyClfuZtD0Si-oZ0QRJXcVFvyakYh0Csgyo",
  authDomain: "mithr-1e5f4.firebaseapp.com",
  projectId: "mithr-1e5f4",
  storageBucket: "mithr-1e5f4.firebasestorage.app",
  messagingSenderId: "699698490740",
  appId: "1:699698490740:web:1941b2de4cc25dac095021",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log('Searching for posts with type "social"...');

  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where('type', '==', 'social'));
  const snapshot = await getDocs(q);

  console.log(`Found ${snapshot.size} post(s) with type "social".`);

  let updated = 0;
  for (const docSnap of snapshot.docs) {
    await updateDoc(doc(db, 'posts', docSnap.id), { type: 'community' });
    updated++;
    console.log(`  Updated post ${docSnap.id}: social → community`);
  }

  // Also check events collection for type 'Social'
  console.log('\nSearching for events with type "Social"...');
  const eventsRef = collection(db, 'events');
  const eq = query(eventsRef, where('type', '==', 'Social'));
  const eventsSnapshot = await getDocs(eq);

  console.log(`Found ${eventsSnapshot.size} event(s) with type "Social".`);

  for (const docSnap of eventsSnapshot.docs) {
    await updateDoc(doc(db, 'events', docSnap.id), { type: 'Community' });
    updated++;
    console.log(`  Updated event ${docSnap.id}: Social → Community`);
  }

  console.log(`\nDone! Updated ${updated} document(s) total.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
