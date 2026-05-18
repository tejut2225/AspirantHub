// public/js/profilemenu.js - FULLY UPDATED FOR REUSABLE LOGOUT & ALL NEW FIELDS

// -------------------- Firebase & Utilities Imports --------------------
import { auth, db, getCurrentUser, signOut } from './firebase.js'; 
import { 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    updateProfile, 
    updatePassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// -------------------- UI Elements --------------------
// Profile Page Elements (these only exist on profilemenu.html)
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const messageEl = document.getElementById('message');
const profileForm = document.getElementById('profileForm');
const profilePageLogoutBtn = document.getElementById('logoutButton'); // The dedicated button on profilemenu.html

// Data Display Elements (Spans for View Mode)
const displayEmail = document.getElementById('displayEmail');
const displayNameSpan = document.getElementById('displayName');
const displayCompanySpan = document.getElementById('displayCompany');
const displayInstTypeSpan = document.getElementById('displayInstType');
const displayStateSpan = document.getElementById('displayState');
const displayCitySpan = document.getElementById('displayCity');
const displayContactSpan = document.getElementById('displayContact');
const displayStudentIDSpan = document.getElementById('displayStudentID');
const displayPasswordStatus = document.getElementById('displayPasswordStatus');

// Form Input Elements (Inputs for Edit Mode)
const inputName = document.getElementById('inputName');
const inputCompany = document.getElementById('inputCompany');
const inputInstType = document.getElementById('inputInstType');
const inputState = document.getElementById('inputState');
const inputCity = document.getElementById('inputCity');
const inputContact = document.getElementById('inputContact');
const inputStudentID = document.getElementById('inputStudentID');
const inputPassword = document.getElementById('inputPassword');

// Collection of elements for toggling view/edit state
const viewDataElements = document.querySelectorAll('.view-data');
const editInputElements = document.querySelectorAll('.edit-input');

// Header Elements (Used by Exam Page and Profile Page)
const profileIconEl = document.getElementById('profileIcon'); // The circular icon
const profileDisplayNameEl = document.getElementById('profileDisplayName'); // The name next to the icon (if exists)

// -------------------- State --------------------
let currentUserData = {};
// Check if the script is running on the dedicated profile page URL
const isProfilePage = window.location.pathname.includes('profilemenu.html');

// -------------------- Helper Functions --------------------

function showMessage(msg, type) {
    if (!messageEl) return; // Guard for exam page where this element might not exist
    console.log(`📢 Message: ${msg} (${type})`);
    messageEl.textContent = msg;
    messageEl.className = type === 'success' ? 'success' : 'error';
    messageEl.style.display = 'block';
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 4000);
}

function toggleEditMode(isEditing) {
    if (!isProfilePage) return; // Only relevant for the profile page

    if (isEditing) {
        console.log('🔄 Switching to Edit Mode');
        // Switch to edit mode
        viewDataElements.forEach(el => el.style.display = 'none');
        editInputElements.forEach(el => el.style.display = 'block');

        if (editBtn) editBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        // Populate input fields with current data from state
        inputName.value = currentUserData.fullName || '';
        inputCompany.value = currentUserData.company || '';
        inputInstType.value = currentUserData.instituteType || '';
        inputState.value = currentUserData.state || '';
        inputCity.value = currentUserData.city || '';
        inputContact.value = currentUserData.contactNumber || '';
        inputStudentID.value = currentUserData.studentID || '';
        inputPassword.value = ''; // Password field is always cleared for security
    } else {
        console.log('🔄 Switching to View Mode');
        // Switch to view mode
        viewDataElements.forEach(el => el.style.display = 'block');
        editInputElements.forEach(el => el.style.display = 'none');

        if (editBtn) editBtn.style.display = 'inline-block';
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

// --- Load User Data Function (Reusable) ---

async function loadUserData(user) {
    if (!user) {
        console.error('❌ Cannot load data: No user provided.');
        currentUserData = {};
        return;
    }
    
    console.log('📡 Fetching profile data for UID:', user.uid);
    
    // Set email immediately from Auth
    if (displayEmail) displayEmail.textContent = user.email || 'N/A';

    let profileData = {
        fullName: user.displayName || '',
        company: '',
        instituteType: '',
        state: '',
        city: '',
        contactNumber: '',
        studentID: ''
    };

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            console.log('✅ Firestore document found');
            const userData = userDocSnap.data();
            profileData.fullName = userData.fullName || userData.name || profileData.fullName;
            profileData.company = userData.company || userData.university || '';
            profileData.instituteType = userData.instituteType || '';
            profileData.state = userData.state || '';
            profileData.city = userData.city || '';
            profileData.contactNumber = userData.contactNumber || '';
            profileData.studentID = userData.studentID || '';
        } else if (isProfilePage) {
            console.log('ℹ️ No Firestore document, creating default...');
            // Only create the default profile if on the dedicated profile page
            await setDoc(userDocRef, {
                fullName: user.displayName || '',
                email: user.email,
                createdAt: new Date().toISOString()
            }, { merge: true });
            profileData.fullName = user.displayName || ''; 
        }
    } catch (error) {
        console.error('❌ Error fetching/creating Firestore profile data:', error);
        if (isProfilePage) showMessage('Error loading profile data: ' + error.message, 'error');
    }

    // Store current data in state
    currentUserData = profileData;
    
    // Update the display elements (only relevant for the Profile Page)
    if (isProfilePage) {
        if (displayNameSpan) displayNameSpan.textContent = profileData.fullName || 'No name provided';
        if (displayCompanySpan) displayCompanySpan.textContent = profileData.company || 'No institute set';
        if (displayInstTypeSpan) displayInstTypeSpan.textContent = profileData.instituteType || 'Not set';
        if (displayStateSpan) displayStateSpan.textContent = profileData.state || 'Not set';
        if (displayCitySpan) displayCitySpan.textContent = profileData.city || 'Not set';
        if (displayContactSpan) displayContactSpan.textContent = profileData.contactNumber || 'Not set';
        if (displayStudentIDSpan) displayStudentIDSpan.textContent = profileData.studentID || 'Not set';
        
        toggleEditMode(false);
    }
}

/**
 * =======================================================
 * 🔑 EXPORTED LOGOUT FUNCTION
 * =======================================================
 */
export async function logoutUser() {
    console.log('🚪 Logging out user...');
    try {
        await signOut(); 
        console.log('✅ Sign-out successful');
        window.location.href = 'login.html'; 
    } catch (error) {
        console.error('❌ Logout failed:', error);
        alert('Logout failed: ' + error.message); 
    }
}


/**
 * =======================================================
 * 🔑 EXPORTED FUNCTION FOR EXAM PAGE HEADER
 * =======================================================
 */
export async function initializeProfileMenu(user) {
    if (!user) {
        console.warn('⚠️ initializeProfileMenu called without user');
        return;
    }
    
    await loadUserData(user); 
    
    const nameToUse = currentUserData.fullName || user.email;
    const initial = (nameToUse || 'P').charAt(0).toUpperCase();

    if (profileIconEl) {
        profileIconEl.textContent = initial;
        if (profileDisplayNameEl) {
            profileDisplayNameEl.textContent = nameToUse;
        }
    }

    console.log(`✅ Profile Menu Initialized for header: ${nameToUse}`);
}

// -------------------- Profile Page Specific Logic --------------------

if (isProfilePage) {
    console.log('📄 Profile Page detected, binding events...');
    
    // --- Event Listeners ---
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            console.log('✏️ Edit button clicked');
            toggleEditMode(true);
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            console.log('❌ Cancel button clicked');
            toggleEditMode(false);
        });
    }
    
    if (profilePageLogoutBtn) {
        profilePageLogoutBtn.addEventListener('click', () => {
            console.log('🚪 Profile Page Logout clicked');
            logoutUser();
        }); 
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('💾 Submit event triggered');
            
            const user = auth.currentUser;
            if (!user) {
                showMessage('Error: User not logged in.', 'error');
                return;
            }
            
            const updatedData = {
                fullName: inputName.value.trim(),
                company: inputCompany.value.trim(),
                instituteType: inputInstType.value.trim(),
                state: inputState.value.trim(),
                city: inputCity.value.trim(),
                contactNumber: inputContact.value.trim(),
                studentID: inputStudentID.value.trim()
            };

            const newPassword = inputPassword.value;

            if (!updatedData.fullName) {
                showMessage('Full Name cannot be empty.', 'error');
                return;
            }
            
            try {
                let changesMade = false;
                console.log('⏳ Updating profile records...');
                
                // 1. Update Auth Profile (Display Name)
                if (updatedData.fullName !== user.displayName) {
                    await updateProfile(user, { displayName: updatedData.fullName });
                    changesMade = true;
                }
                
                // 2. Update Firestore (Full Object)
                await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
                changesMade = true;
                
                // 3. Update Password if typed
                if (newPassword) {
                    console.log('🔐 Updating password...');
                    await updatePassword(user, newPassword);
                    changesMade = true;
                }
                
                console.log('✅ Update cycle complete');
                await loadUserData(user); 
                
                showMessage(
                    changesMade ? 'Profile updated successfully!' : 'No changes detected.', 
                    'success'
                );
                
            } catch (error) {
                console.error('❌ Update failed:', error);
                let errorMessage = 'Update failed. ';
                if (error.code === 'auth/requires-recent-login') {
                    errorMessage += 'Please log out and log back in to change sensitive data.';
                } else {
                    errorMessage += error.message || 'Please try again.';
                }
                showMessage(errorMessage, 'error');
            }
        });
    }
    
    // --- Auth State Listener ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('👤 Auth state: User is logged in');
            await loadUserData(user);
        } else {
            console.warn('⚠️ No authenticated user, redirecting to login...');
            window.location.href = 'login.html';
        }
    });

} 
// -------------------- End of File --------------------