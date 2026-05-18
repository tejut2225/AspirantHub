// public/js/firebase.js - FINAL CLEAN VERSION (Ready to Copy/Paste)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut // Renamed import to avoid conflicts
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// -------------------- Firebase Configuration --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDiLsLtO-ZbAKoOyLkXbT7ws9AJQhW1sAA",
  authDomain: "exam-portal-cf32b.firebaseapp.com",
  projectId: "exam-portal-cf32b",
  storageBucket: "exam-portal-cf32b.firebasestorage.app",
  messagingSenderId: "182956377341",
  appId: "1:182956377341:web:2640609519fc16e7692a94",
  measurementId: "G-350CKDQ104"
};

// -------------------- Initialize Firebase --------------------
const app = initializeApp(firebaseConfig);

// Export core Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// -------------------- Sign-Out Wrapper --------------------
/**
 * Signs out the current Firebase user.
 * Clears localStorage and sessionStorage for a clean logout.
 */
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error("Error during Firebase sign out:", error);
    throw error;
  }
};

// -------------------- Firestore Exports --------------------
export { collection, getDocs, getDoc, addDoc, doc, setDoc, updateDoc };

// -------------------- Fetch Exam Attempt Result --------------------
/**
 * Fetches a single exam attempt result from Firestore.
 * Path: users/{user.uid}/examResults/{attemptId}
 * @param {string} attemptId - Unique ID of the exam result document.
 * @returns {object|null} - The document data or null if not found.
 */
export async function getAttemptResult(attemptId) {
  if (!attemptId) return null;

  const user = auth.currentUser;
  if (!user || !user.uid) {
    console.error("Firebase fetch error: No authenticated user found to retrieve nested result.");
    return null;
  }

  const attemptRef = doc(db, "users", user.uid, "examResults", attemptId);

  try {
    const docSnap = await getDoc(attemptRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.error(
        `Firebase fetch error: No attempt document found for ID ${attemptId} at path: ${attemptRef.path}`
      );
      return null;
    }
  } catch (error) {
    console.error("Error fetching attempt result:", error);
    return null;
  }
}

// -------------------- Get Current User --------------------
/**
 * Returns a Promise that resolves with the currently authenticated user.
 * Useful for checking login state in other scripts.
 */
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe(); // Stop listening after first event
        resolve(user);
      },
      reject
    );
  });
};
