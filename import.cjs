// import.js

// 1. Load Admin SDK, your service account key, and the data file
const admin = require('firebase-admin');

// Ensure these file names match the ones you are using
const serviceAccount = require('./serviceAccountKey.json'); 
const data = require('./questions.json'); // This should be your file of quiz questions

// 2. Initialize Firebase using your service account key
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const collectionName = 'questions'; // This will be the name of your Firestore collection

async function uploadData() {
  console.log(`Starting upload to collection: ${collectionName}...`);

  try {
    // If your JSON is an array of objects: [{}, {}]
    if (Array.isArray(data)) {
        for (const item of data) {
            // 'add' creates a new document with an auto-generated ID
            await db.collection(collectionName).add(item);
        }
    } 
    // If your JSON is an object where keys are the intended document IDs: { "q1": {}, "q2": {} }
    else if (typeof data === 'object' && data !== null) {
        for (const docId in data) {
            if (Object.hasOwnProperty.call(data, docId)) {
                // 'set' uses the outer key as the document ID
                await db.collection(collectionName).doc(docId).set(data[docId]);
            }
        }
    } else {
        throw new Error("JSON file must contain either an array or an object at the root.");
    }
    
    console.log('Data upload complete! Check your Cloud Firestore console.');

  } catch (error) {
    console.error("An error occurred during upload:", error.message);
  }
}

uploadData();