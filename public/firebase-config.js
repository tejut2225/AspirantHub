// Import Firebase functions
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDiLsLtO-ZbAKoOyLkXbT7ws9AJQhW1sAA",
  authDomain: "exam-portal-cf32b.firebaseapp.com",
  projectId: "exam-portal-cf32b",
  // rest of your config...
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
