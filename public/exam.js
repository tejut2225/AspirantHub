// exam.js - COMPLETE AND UPDATED VERSION (Includes ALL fixes: Config Display, Standard/Stream Filter, Redirect & Logout)

// -------------------- Firebase & Utilities Imports --------------------
// 1. IMPORT shared Firebase services
import { auth, db, getCurrentUser } from './firebase.js'; 
// 2. IMPORT reusable functions from profilemenu.js (INCLUDING logoutUser)
import { initializeProfileMenu, logoutUser } from './profilemenu.js'; 
import { 
    collection, getDocs, addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// -------------------- UI Elements --------------------
const questionNumberEl = document.getElementById("questionNumber");
const questionTextEl = document.getElementById("questionText");
const optionsEl = document.getElementById("options");
const paletteEl = document.getElementById("palette");
const attemptedCountEl = document.getElementById("attemptedCount");
const totalQuestionsEl = document.getElementById("totalQuestions");
const markedCountEl = document.getElementById("markedCount");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const markBtn = document.getElementById("markBtn");
const submitBtn = document.getElementById("submitBtn");
const timerEl = document.getElementById("timer");
const configSummaryEl = document.getElementById("configSummary"); 
const qTimerEl = document.getElementById("qTimer");
const clearBtn = document.getElementById("clearBtn");

// Custom Modal Elements
const submitModalEl = document.getElementById("submitModal");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");
const cancelSubmitBtn = document.getElementById("cancelSubmitBtn");
const modalAttemptedCountEl = document.getElementById("modalAttemptedCount");
const modalMarkedCountEl = document.getElementById("modalMarkedCount");

// Profile Dropdown Elements
const profileDropdown = document.getElementById('profileDropdown');
const profileIcon = document.getElementById('profileIcon');
const logoutButton = document.getElementById('logoutButton'); // The button in the dropdown


// -------------------- State --------------------
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let answers = {};
let markedForReview = {};
let remainingSeconds = 0;
let examStartedAt = Date.now();
let currentUser = null; 
let questionTimeSpent = [];
let questionTimerInterval = null;
let globalTimerInterval = null;

// -------------------- Helper: Shuffle --------------------
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function normalize(value) {
    return value ? value.toString().trim().toLowerCase() : "";
}

// -------------------- Load Questions (UPDATED to include Standard and Stream filters) --------------------
async function loadQuestions() {
    try {
        if (!db) {
            throw new Error("Firestore database object (db) is not initialized.");
        }
        
        const querySnapshot = await getDocs(collection(db, "questions"));
        allQuestions = querySnapshot.docs.map(doc => doc.data());

        const examConfig = JSON.parse(localStorage.getItem("examConfig") || "{}");
        
        // Convert all config values to lowercase for case-insensitive matching
        const company = (examConfig.company || "").toLowerCase();
        const topic = (examConfig.topic || "").toLowerCase();
        // ★ NEW: Get Standard and Stream from localStorage
        const standard = (examConfig.standard || "").toLowerCase();
        const stream = (examConfig.stream || "").toLowerCase();


        filteredQuestions = allQuestions.filter(q => {
            const qCompany = q.company?.toLowerCase() || '';
            const qTopic = q.topic?.toLowerCase() || '';
            // ★ NEW: Get Standard and Stream from the question document
            const qStandard = q.standard?.toLowerCase() || '';
            const qStream = q.stream?.toLowerCase() || '';

            // 1. Standard Match (CRITICAL: Must match the standard selected by the user)
            let standardMatch = qStandard === standard;

            // 2. Stream Match (Only applies if standard is NOT 10th and a stream was selected)
            let streamMatch = true;
            if (standard !== '10th' && stream && stream !== 'any') {
                streamMatch = qStream === stream; 
            }
            
            // 3. Company and Topic Match (Existing logic)
            let companyMatch = !company || company === 'any' || qCompany === company;
            let topicMatch = !topic || topic === 'any' || qTopic === topic;

            // COMBINED FILTER: All conditions must be true
            return standardMatch && streamMatch && companyMatch && topicMatch;
        });

        shuffleArray(filteredQuestions);
        if (examConfig.numQuestions) filteredQuestions = filteredQuestions.slice(0, examConfig.numQuestions);

        if (filteredQuestions.length === 0) {
            questionTextEl.textContent = "No questions found for your selected filters. Please go back to config.";
            [prevBtn, nextBtn, markBtn, clearBtn, submitBtn].forEach(btn => btn.disabled = true);
            return;
        }

        questionTimeSpent = new Array(filteredQuestions.length).fill(0);

        initExam();
    } catch (err) {
        console.error("Error loading questions (Check Firebase Config and Firestore Rules):", err);
        questionTextEl.textContent = "🔴 Failed to load questions. Check console for details.";
    }
}

// -------------------- Configuration Display (UPDATED to target specific IDs) --------------------
function displayConfigSummary() {
    const examConfig = JSON.parse(localStorage.getItem("examConfig") || "{}");
    const numQuestions = filteredQuestions.length;
    
    const formatText = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1) : 'N/A';
    
    const standard = examConfig.standard || 'N/A';
    const stream = examConfig.stream || 'Any';
    const topic = examConfig.topic || 'Any';
    const company = examConfig.company || 'Any';

    const totalSeconds = numQuestions * (examConfig.perQuestionSeconds || 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const duration = `${minutes} min ${seconds} sec`;

    const standardElement = document.getElementById('configStandard');
    if (standardElement) {
        standardElement.textContent = formatText(standard);
    }

    const streamElement = document.getElementById('configStream');
    const streamRow = document.getElementById('streamBranchRow');
    
    if (streamRow) {
        if (standard.toLowerCase() === '10th' || stream.toLowerCase() === 'any') {
            streamRow.style.display = 'none';
        } else {
            streamRow.style.display = ''; 
            if (streamElement) {
                streamElement.textContent = stream.toUpperCase(); 
            }
        }
    }
    
    document.getElementById('configQuestions').textContent = numQuestions;
    document.getElementById('configTopic').textContent = formatText(topic);
    document.getElementById('configCompany').textContent = formatText(company);
    document.getElementById('configTotalTime').textContent = duration;
}

// -------------------- Individual Question Timer --------------------
function startQuestionTimer(index) {
    if (questionTimerInterval) clearInterval(questionTimerInterval);

    const currentSeconds = questionTimeSpent[index];
    const mins = Math.floor(currentSeconds / 60);
    const secs = currentSeconds % 60;
    qTimerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    questionTimerInterval = setInterval(() => {
        if (index === currentIndex) {
            questionTimeSpent[index]++; 
            const newSeconds = questionTimeSpent[index];
            const newMins = Math.floor(newSeconds / 60);
            const newSecs = newSeconds % 60;
            qTimerEl.textContent = `${String(newMins).padStart(2, "0")}:${String(newSecs).padStart(2, "0")}`;
        }
    }, 1000);
}

// -------------------- Render Question (UPDATED WITH VISUAL FIX) --------------------
function renderQuestion(index) {
    if (!filteredQuestions[index]) return;
    const q = filteredQuestions[index];
    
    startQuestionTimer(index); 

    questionNumberEl.textContent = `Q${index + 1} / ${filteredQuestions.length}`;
    
    let questionContent = q.qtext;
    if (q.image_url) {
        questionContent = `
            <div class="question-image-container" style="text-align: center; margin-bottom: 20px;">
                <img src="${q.image_url}" alt="Question Image" 
                style="max-width: 300px; height: auto; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
            </div>
            ${q.qtext}
        `;
    }

    questionTextEl.innerHTML = questionContent; 
    optionsEl.innerHTML = "";
    
    const gridWrapper = document.createElement('div');
    gridWrapper.style.cssText = "display: flex; flex-wrap: wrap; gap: 15px;"; 
    optionsEl.appendChild(gridWrapper);

    const optionKeys = ["option_a", "option_b", "option_c", "option_d", "option_e"];
    let hasOptions = false;

    optionKeys.forEach((key, idx) => {
        const imageKey = `image_${key.slice(-1)}`; 
        const imageUrl = q[imageKey];
        const optionText = q[key];
        const optionLetter = String.fromCharCode(65 + idx);

        if (optionText) {
            hasOptions = true;
            const label = document.createElement("label");
            
            // VISUAL FIX: Apply the CSS Class instead of hardcoded red/black styles
            label.className = "option-label"; 
            if (answers[index] === optionText) {
                label.classList.add("selected");
            }

            const isImageOption = !!imageUrl;
            const flexDir = isImageOption ? 'column' : 'row';
            const align = isImageOption ? 'center' : 'flex-start'; 
            
            // Reduced inline styles to let CSS handle colors/borders
            label.style.cssText = `
                flex: 1 1 45%; max-width: 48%; margin: 0; box-sizing: border-box; 
                display: flex; flex-direction: row; align-items: ${align}; 
                text-align: ${isImageOption ? 'center' : 'left'}; 
            `;
            
            const radioHtml = `<input type="radio" name="option" value="${optionText}" ${answers[index] === optionText ? 'checked' : ''}>`;
            
            let optionContent = `<div style="display: flex; flex-direction: ${flexDir}; align-items: ${align}; flex-grow: 1; width: 100%; height: 100%;">`;
            
            const letterStyle = isImageOption ? 
                `style="font-weight: bold; margin-bottom: 10px; font-size: 1.1em; flex-shrink: 0;"` : 
                `style="font-weight: bold; margin-right: 10px; font-size: 1em; flex-shrink: 0;"`;
            
            optionContent += `<span ${letterStyle}>${optionLetter}.</span>`;
            
            if (isImageOption) {
                optionContent += `
                    <div style="text-align: center; width: 100%; margin-bottom: 10px;">
                        <img src="${imageUrl}" alt="${optionText}" 
                        style="max-width: 150px; height: auto; border: 2px solid #ccc; border-radius: 4px; display: inline-block;">
                    </div>
                `;
            }
            
            optionContent += `<span style="display: block; font-size: 1em; flex-grow: 1;">${optionText}</span>`;
            optionContent += `</div>`;
            
            label.innerHTML = radioHtml + optionContent;
            
            const radioInput = label.querySelector('input[type="radio"]');
            radioInput.addEventListener("change", () => {
                answers[index] = optionText;
                
                // Visual toggle for selection
                const allLabels = optionsEl.querySelectorAll('.option-label');
                allLabels.forEach(l => l.classList.remove('selected'));
                label.classList.add('selected');

                updateSummary();
                updatePalette();
            });

            gridWrapper.appendChild(label);
        }
    });

    if (!hasOptions) {
        const inputBox = document.createElement("input");
        inputBox.type = "text";
        inputBox.className = "fill-blank-input"; // Use a class for consistency
        inputBox.placeholder = "Type your answer here...";
        inputBox.value = answers[index] || "";
        inputBox.style.cssText = "width: 100%; padding: 12px; border: 2px solid var(--primary-blue); border-radius: 6px; font-size: 1.05rem; background-color: #fff; color: #000; outline: none;";
        
        inputBox.addEventListener("input", e => {
            answers[index] = e.target.value;
            updateSummary();
            updatePalette();
        });
        optionsEl.appendChild(inputBox);
    }

    updatePalette();
    updateNavButtons();
}

// -------------------- Clear Button Logic --------------------
function clearAnswer() {
    const currentQuestionIndex = currentIndex;
    if (answers[currentQuestionIndex]) delete answers[currentQuestionIndex];

    const options = optionsEl.querySelectorAll('input');
    options.forEach(input => {
        if (input.type === 'radio') input.checked = false;
        else if (input.type === 'text') input.value = '';
    });

    const allLabels = optionsEl.querySelectorAll('.option-label');
    allLabels.forEach(l => l.classList.remove('selected'));

    updateSummary();
    updatePalette();
}

// -------------------- Palette & Summary --------------------
function buildPalette() {
    paletteEl.innerHTML = "";
    filteredQuestions.forEach((_, i) => {
        const btn = document.createElement("button");
        btn.textContent = i + 1;
        btn.addEventListener("click", () => {
            currentIndex = i;
            renderQuestion(currentIndex);
        });
        paletteEl.appendChild(btn);
    });
    updatePalette();
}

function updatePalette() {
    const buttons = paletteEl.querySelectorAll("button");
    buttons.forEach((btn, i) => {
        btn.className = "";
        if (i === currentIndex) btn.classList.add("current");
        if (markedForReview[i]) btn.classList.add("marked");
        else if (answers[i]) btn.classList.add("answered");
        else btn.classList.add("unanswered");
    });
}

function updateSummary() {
    let answeredCount = 0;
    for (let i = 0; i < filteredQuestions.length; i++) {
        const answer = answers[i];
        if (answer !== undefined && answer !== null && answer !== '') answeredCount++;
    }
    attemptedCountEl.textContent = answeredCount;
    if(modalAttemptedCountEl) modalAttemptedCountEl.textContent = answeredCount;
    
    let markedCount = 0;
    for (let i = 0; i < filteredQuestions.length; i++) {
        if (markedForReview[i]) markedCount++;
    }
    markedCountEl.textContent = markedCount;
    if(modalMarkedCountEl) modalMarkedCountEl.textContent = markedCount;
    
    totalQuestionsEl.textContent = filteredQuestions.length;
}

// -------------------- Navigation & Events --------------------
function updateNavButtons() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === filteredQuestions.length - 1;
}

prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) currentIndex--;
    renderQuestion(currentIndex);
});

nextBtn.addEventListener("click", () => {
    if (currentIndex < filteredQuestions.length - 1) currentIndex++;
    renderQuestion(currentIndex);
});

markBtn.addEventListener("click", () => {
    if (markedForReview[currentIndex]) delete markedForReview[currentIndex];
    else markedForReview[currentIndex] = true;
    updatePalette();
    updateSummary();
});

clearBtn.addEventListener("click", clearAnswer);

// -------------------- Global Timer --------------------
function startTimer() {
    if (globalTimerInterval) clearInterval(globalTimerInterval); 
    
    const examConfig = JSON.parse(localStorage.getItem("examConfig") || "{}");
    const numQuestions = filteredQuestions.length || (examConfig.numQuestions || 0); 
    const perQuestionSeconds = examConfig.perQuestionSeconds || 60;
    
    if (remainingSeconds === 0) {
        remainingSeconds = numQuestions * perQuestionSeconds;
    }

    function tick() {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        
        timerEl.textContent = timeStr;
        if(document.getElementById("modalTimerDisplay")) {
             document.getElementById("modalTimerDisplay").textContent = timeStr; 
        }
        
        if (remainingSeconds <= 0) {
            endExam();
        } else {
            remainingSeconds--;
        }
    }
    globalTimerInterval = setInterval(tick, 1000);
}

// -------------------- End Exam (The final execution) --------------------
async function endExam() {
    if (questionTimerInterval) clearInterval(questionTimerInterval);
    if (globalTimerInterval) clearInterval(globalTimerInterval);
    
    const user = currentUser; 
    
    if (!user || !user.uid) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html"; 
        return; 
    }
    
    if (!db) {
        alert("Database connection failed.");
        return;
    }

    const timeUsedSeconds = Math.floor((Date.now() - examStartedAt) / 1000);
    
    const resultData = {
        questions: filteredQuestions.map((q, i) => ({
            questionID: q.qID || i + 1,
            questionText: q.qtext,
            correctAnswer: q.correct_answer,
            userAnswer: answers[i] || null,
            isCorrect: normalize(answers[i]) === normalize(q.correct_answer),
            timeSpentSeconds: questionTimeSpent[i] || 0
        })),
        totalQuestions: filteredQuestions.length,
        attempted: parseInt(attemptedCountEl.textContent, 10), 
        marked: parseInt(markedCountEl.textContent, 10),      
        timeTakenSeconds: timeUsedSeconds,
        timestamp: new Date(),
        userId: user.uid 
    };

    try {
        const userResultsRef = collection(db, "users", user.uid, "examResults");
        const docRef = await addDoc(userResultsRef, resultData);
        window.location.href = `result.html?attemptId=${docRef.id}`;
    } catch (err) {
        console.error("Error saving result:", err);
        alert("Failed to save results. Check console.");
    }
}

// -------------------- Custom Modal Handlers --------------------
submitBtn.addEventListener("click", () => {
    updateSummary();
    if(submitModalEl) {
        submitModalEl.style.display = "block";
    } else {
        if (confirm("Are you sure you want to submit the exam?")) endExam();
    }
});

if(cancelSubmitBtn) {
    cancelSubmitBtn.addEventListener("click", () => {
        if(submitModalEl) submitModalEl.style.display = "none";
    });
}

if(confirmSubmitBtn) confirmSubmitBtn.addEventListener("click", endExam);

// -------------------- Profile Dropdown Logic --------------------
if (profileIcon && profileDropdown) {
    profileIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle('show');
    });

    window.addEventListener('click', (event) => {
        const dropdownContent = document.getElementById('dropdownMenu');
        if (dropdownContent && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('show');
        }
    });
}

// -------------------- LOGOUT FIX --------------------
if (logoutButton) {
    logoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        logoutUser(); 
    });
}

// -------------------- Init Exam --------------------
function initExam() {
    if (filteredQuestions.length === 0) return;
    displayConfigSummary(); 
    buildPalette();
    renderQuestion(currentIndex);
    updateSummary();
    startTimer();
}

/**
 * =======================================================
 * 🛠️ FILTER DISABLE LOGIC (FOR CONFIG PAGE)
 * =======================================================
 */
function initializeFilterLogic() {
    const standardSelect = document.getElementById('standardSelect'); 
    const filterBySelect = document.getElementById('filterBySelect'); 

    if (standardSelect && filterBySelect) {
        standardSelect.addEventListener('change', () => {
            const val = standardSelect.value.toLowerCase();
            const isJunior = val.includes('10th') || val.includes('intermediate');
            
            if (isJunior) {
                filterBySelect.disabled = true;
                filterBySelect.value = ""; 
                filterBySelect.style.opacity = "0.5";
            } else {
                filterBySelect.disabled = false;
                filterBySelect.style.opacity = "1";
            }
        });
    }
}

// -------------------- Auth State (CRITICAL FIX) --------------------
async function authenticateAndInitialize() {
    const user = await getCurrentUser(); 
    if (user) {
        currentUser = user; 
        initializeProfileMenu(user); 
        initializeFilterLogic(); 
        loadQuestions();
    } else {
        window.location.href = "login.html";
    }
}

/**
 * UPDATED: Dynamic Filter Logic
 */
function handleStandardDropdownChanges() {
    const standardSelect = document.getElementById('standardSelect'); 
    const filterBySelect = document.getElementById('filterBySelect'); 

    if (!standardSelect || !filterBySelect) return;

    standardSelect.addEventListener('change', () => {
        const selectedValue = standardSelect.value;
        
        if (selectedValue === 'Intermediate') {
            filterBySelect.disabled = true;
            filterBySelect.innerHTML = '<option value="">--Disabled for Inter--</option>';
            filterBySelect.style.opacity = "0.5";
        } 
        else if (selectedValue === '10th') {
            filterBySelect.disabled = false;
            filterBySelect.style.opacity = "1";
            filterBySelect.innerHTML = `
                <option value="">--Select Subject--</option>
                <option value="English">English</option>
                <option value="Maths">Maths</option>
                <option value="Science">Science</option>
                <option value="Social">Social Science</option>
            `;
        } 
        else {
            filterBySelect.disabled = false;
            filterBySelect.style.opacity = "1";
            filterBySelect.innerHTML = `
                <option value="">--Select Filter Type--</option>
                <option value="Company">Company</option>
                <option value="Topic">Topic</option>
                <option value="Company+Topic">Company + Topic</option>
            `;
        }
    });
}

authenticateAndInitialize();

// -------------------- End of File --------------------