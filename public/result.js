// public/js/result.js — FINAL VERSION (FIXED LOGOUT FOR BOTH BUTTONS)

// -------------------- Firebase & Utilities Imports --------------------
// FIX 1: Import the reusable 'logoutUser' function from profilemenu.js
import { signOut, getAttemptResult, getCurrentUser } from './firebase.js'; 
import { initializeProfileMenu, logoutUser } from './profilemenu.js'; 

// -------------------- UI Elements (For Logout Setup) --------------------
// Get references for both logout buttons (IDs from result.html)
const headerLogoutBtn = document.getElementById('logoutButton'); 
const bottomLogoutBtn = document.getElementById('pageLogoutBtn'); 


// -------------------- Core Logic: Log Out Event Handlers (FIX) --------------------

/**
 * Attaches the exported logoutUser function to both Log Out buttons.
 */
function setupLogoutButtons() {
    // 1. Header Dropdown Button (ID: logoutButton)
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            console.log("Header Logout button clicked (calling shared function).");
            // FIX: Use the shared, robust logout function
            logoutUser(); 
        });
    }

    // 2. Bottom Action Button (ID: pageLogoutBtn)
    if (bottomLogoutBtn) {
        bottomLogoutBtn.addEventListener('click', () => {
            console.log("Bottom Logout button clicked (calling shared function).");
            // FIX: Use the shared, robust logout function
            logoutUser(); 
        });
    }
}


// --- Helper function to display results ---
function displayResults(lastAttempt) {
    const mainContentContainer = document.querySelector('.container'); 
    const errorHTML = `
        <div style="text-align: center; padding: 50px;">
            <h2 style="color: red;">Error</h2>
            <p style="color: white; font-size: 1.1rem;">Could not load exam results. The data might be missing or corrupted.</p>
        </div>
    `;

    if (!lastAttempt || !lastAttempt.questions) {
        console.error('Invalid or empty attempt data received from Firebase.');
        if (mainContentContainer) {
             mainContentContainer.innerHTML = errorHTML;
        }
        return;
    }

    const { questions, markedForReview = {}, timeTakenSeconds = 0 } = lastAttempt;

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let attemptedQuestions = 0;

    const tableBody = document.querySelector('#questionTable tbody');
    if (!tableBody) {
        console.error("DOM element '#questionTable tbody' not found. Cannot populate details.");
        if (mainContentContainer) {
            mainContentContainer.innerHTML = errorHTML;
        }
        return;
    }
    
    tableBody.innerHTML = ''; 

    // 2. Process Questions and Build Table
    questions.forEach((q, i) => {
        const userAnswer = q.userAnswer || '';
        const correctAnswer = q.correctAnswer || '';
        let status = '';

        if (!userAnswer.trim()) {
            skipped++;
            status = 'Skipped';
        } else {
            attemptedQuestions++;
            if (q.isCorrect) {
                correct++;
                status = 'Correct';
            } else {
                wrong++;
                status = 'Wrong';
            }
        }

        let rowClass = status.toLowerCase();
        const isMarked = markedForReview[i];
        
        if (isMarked) {
            status += ' / Marked';
            if (rowClass === 'skipped') {
                rowClass = 'marked';
            }
        }

        const tr = document.createElement('tr');
        tr.className = rowClass; 
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${q.questionText || 'N/A'}</td>
            <td>${userAnswer || '-'}</td>
            <td>${correctAnswer || '-'}</td>
            <td>${status}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    // Calculate average time
    const avgTime = (attemptedQuestions > 0 ? (timeTakenSeconds / attemptedQuestions) : 0).toFixed(1);

    // 3. Update Summary Section
    document.getElementById('totalQ').textContent = questions.length;
    document.getElementById('correct').textContent = correct;
    document.getElementById('wrong').textContent = wrong;
    document.getElementById('skipped').textContent = skipped;
    document.getElementById('timeTaken').textContent = `${timeTakenSeconds} sec`;
    document.getElementById('avgTime').textContent = `${avgTime} sec`;

    // 4. Draw Pie Chart
    const ctx = document.getElementById('pieChart').getContext('2d');
    if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Correct', 'Wrong', 'Skipped'],
                datasets: [{
                    data: [correct, wrong, skipped],
                    backgroundColor: ['#22c55e', '#ff0000', '#7c7c7c'], 
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'white' 
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed} (${((context.parsed / questions.length) * 100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    }
}

// --- Main execution block for fetching data from Firebase ---
document.addEventListener('DOMContentLoaded', async () => {
    
    const user = await getCurrentUser();
    
    if (!user) {
        console.error("User not authenticated. Redirecting to login.");
        window.location.href = 'login.html';
        return; 
    }
    
    // Initialize profile menu (for icon and name display)
    await initializeProfileMenu(user); 

    // Setup both logout buttons immediately
    setupLogoutButtons();
    
    const urlParams = new URLSearchParams(window.location.search);
    const attemptId = urlParams.get('attemptId');

    if (!attemptId) {
        console.warn('No attemptId found in URL. Redirecting to home.');
        window.location.href = 'index.html'; 
        return;
    }
    
    try {
        const attemptData = await getAttemptResult(attemptId);
        displayResults(attemptData);

    } catch (error) {
        console.error("Failed to fetch exam results from Firebase:", error);
        document.querySelector('.container').innerHTML = 
            `<div style="text-align: center; padding: 50px;"><h2 style="color: red;">Error</h2><p style="color: white; font-size: 1.1rem;">Failed to connect to the database or retrieve attempt ${attemptId}.</p></div>`;
    }

    document.getElementById('tryAgainBtn').addEventListener('click', () => {
        window.location.href = 'exam.html'; 
    });
});