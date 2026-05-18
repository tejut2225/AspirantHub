// login.js (UPDATED TO FIX REDIRECT RACE CONDITION)

// Import the shared services
import { auth, db } from './firebase.js'; 
import { 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    sendPasswordResetEmail,
    // CRITICAL ADDITION: Need onAuthStateChanged here to safely redirect
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// CRITICAL: Ensure setDoc is included here for direct usage
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM elements
const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");
const googleBtn = document.querySelector(".google-btn");
const emailInput = document.getElementById("email");
const forgotPasswordLink = document.getElementById("forgotPasswordLink"); 

// --- COMMON REDIRECTION/PROFILE LOGIC (MODIFIED FOR ASYNC WAIT) ---
const handleLoginSuccess = async (user) => {
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    
    // --- 1. Fetch Existing Data or Initialize New Data ---
    const userSnap = await getDoc(userRef);

    let userData;
    const updateData = {
        email: user.email,
        name: user.displayName || userSnap?.data()?.name || "", 
        lastLoginTime: new Date().toISOString(), 
        authCreationTime: user.metadata.creationTime, 
    };

    if (!userSnap.exists()) {
        userData = { ...updateData, exams: [], verified: true }; 
        await setDoc(userRef, userData);
        console.log("New user profile created and login time recorded!");
    } else {
        userData = userSnap.data();
        await setDoc(userRef, updateData, { merge: true });
        console.log("Existing user login time recorded!");
    }
    
    // --- 2. Check Verification Status ---
    if (!userData.verified) {
        msg.textContent = "Please verify your email using the OTP sent to you.";
        return;
    }

    // --- 3. CRITICAL: Wait for Firebase Session Confirmation (New Logic) ---
    msg.textContent = "Login successful! Securing session...";

    // This promise resolves ONLY after Firebase confirms the user token is saved.
    const userReadyPromise = new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u && u.uid === uid) {
                unsubscribe();
                resolve();
            }
        });
    });

    // Wait for the user session to be fully registered in the browser storage
    await userReadyPromise;

    // --- 4. Final Redirect ---
    msg.textContent = "Session secured. Redirecting...";
    localStorage.setItem("currentUser", JSON.stringify({ uid, ...userData, ...updateData }));

    // Keep the timeout as a clean exit transition, but the main wait is complete.
    setTimeout(() => {
        window.location.href = "exam.html";
    }, 500); // Changed to 500ms as the async wait already happened.
};

// --- FORGOT PASSWORD LOGIC (NO CHANGE) ---
forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
        msg.textContent = "Please enter your email address in the field above first.";
        return;
    }
    
    msg.textContent = `Sending password reset link to ${email}...`;

    try {
        await sendPasswordResetEmail(auth, email);
        msg.textContent = "Password reset email sent successfully! Please check your inbox (and spam folder).";
    } catch (error) {
        console.error("Password Reset Error:", error);
        if (error.code === 'auth/user-not-found') {
            msg.textContent = `No user found with email ${email}. Please check the address.`;
        } else {
            msg.textContent = `Failed to send reset email: ${error.message}`;
        }
    }
});
 
// --- GOOGLE LOGIN IMPLEMENTATION ---
googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    msg.textContent = "Connecting with Google...";

    try {
        const result = await signInWithPopup(auth, provider);
        // The popup signIn automatically triggers the auth state change, so we wait after the initial promise
        await handleLoginSuccess(result.user);

    } catch (error) {
        console.error("Google Login Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            msg.textContent = "Google login interrupted. Try again.";
        } else {
            msg.textContent = "Google login failed: " + error.message;
        }
    }
});

// --- EMAIL/PASSWORD LOGIN ---
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Logging in...";

    const email = emailInput.value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // We pass the user object to handleLoginSuccess to initiate the wait/redirect sequence
        await handleLoginSuccess(userCredential.user);

    } catch (error) {
        console.error(error);
        if (error.code === "auth/wrong-password") {
            msg.textContent = "Incorrect password. Try again.";
        } else if (error.code === "auth/user-not-found") {
            msg.textContent = "No account found with this email.";
        } else {
            msg.textContent = "Login failed: " + error.message;
        }
    }
});

// REGISTER BUTTON LOGIC 
document.getElementById("toRegister").addEventListener("click", () => {
    window.location.href = "register.html";
});