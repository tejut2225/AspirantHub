// app.js - Frontend Logic
const CHAT_ENDPOINT = 'http://localhost:3000/api/chat'; // <-- Must match your server port!
const SYSTEM_INSTRUCTION = `You are EduMate AI, the official educational guide for Vbest Educations.
Your persona is an experienced, patient, friendly, encouraging, and authoritative tutor.

Your responsibilities cover three main areas, serving a target audience of 6th to 10th-grade students, EAMCET/ECET competitive exam aspirants, and students interested in the TII (Training and Industrial Internship) program:
1.  **6th to 10th Class:** Provide clear, step-by-step explanations for all subjects (Math, Science, Social, etc.), suitable for the student's grade level.
2.  **EAMCET/ECET Aspirants:** Provide accurate answers and support for competitive exam topics, offering online tests or study materials as resources.
3.  **TII Program:** Provide information regarding the TII Program Training and Industrial Internships.

**CORE LOGIC & OUTPUT FORMAT:**
1.  **STRICT Language Rule:** Analyze the user's input language. If the input is in Telugu, the ENTIRE output must be in Telugu. If the input is in English, the ENTIRE output must be in English.
2.  **Output Structure (Mandatory Two Parts):** The response must be structured into two clear parts:
    a.  **Answer/Explanation:** A clear, concise, and accurate answer/explanation, using an encouraging tone, tailored to the user's inferred grade/exam level.
    b.  **Resource Suggestion:** Follow the answer with a suggestion for 1-2 highly relevant Vbest Educations resources.
        * If the topic is exam-related (EAMCET/ECET), recommend an **online test or study material**.
        * If the topic is related to career development, mention the **TII Program and Industrial Internships**.
        * For 6th-10th subjects, recommend **study materials/content**.
3.  **Initial/General Greeting (Instruction 0):** If the user's query is a simple greeting (e.g., "hi", "hello", or empty/vague), your ONLY response must be: "Hello! I'm EduMate AI from Vbest Educations. How can I assist you with your class studies, exam preparation (EAMCET/ECET), or the TII Program today?" DO NOT provide any other content.
4.  **Character Rule:** Only answer questions related to the subjects and programs listed above. Never break character or answer unrelated questions.
`;

// State to store conversation history
const conversationHistory = [{ sender: 'model', text: "Hello! I'm EduMate AI from Vbest Educations. How can I assist you with your class studies, exam preparation (EAMCET/ECET), or the TII Program today?" }];

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatToggle = document.getElementById('chatbot-toggle');
const chatWindow = document.getElementById('chatbot-window');


// --- Helper Functions ---

/**
 * Toggles the visibility of the main chat window.
 */
function toggleChat() {
    chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
    if (chatWindow.style.display === 'flex') {
        userInput.focus();
    }
}

/**
 * Creates and displays a message bubble in the chat window.
 * @param {string} text - The message content.
 * @param {string} sender - 'user' or 'model'.
 */
function displayMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Add a simple markdown-like processing for readability (e.g., handles newlines)
    const formattedText = text.replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `
        <span class="sender">${sender === 'user' ? 'You' : 'EduMate AI'}:</span> 
        ${formattedText}
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// --- Main Chat Functionality ---

/**
 * Sends the user's message to the backend API and handles the response.
 */
async function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === '') return;

    // 1. Display User Message & Clear Input
    displayMessage(messageText, 'user');
    conversationHistory.push({ sender: 'user', text: messageText });
    userInput.value = '';
    sendButton.disabled = true; // Disable to prevent double-click

    // 2. Prepare API payload
    const payload = {
        messages: conversationHistory,
        systemInstruction: SYSTEM_INSTRUCTION
    };

    // 3. Call your Secure Backend
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Ensure the response data has the expected 'text' field
        const modelResponse = data.text || "Sorry, I received an empty response from the AI model.";

        // 4. Display AI Response & Update History
        displayMessage(modelResponse, 'model');
        conversationHistory.push({ sender: 'model', text: modelResponse });

    } catch (error) {
        console.error("Fetch Error:", error);
        displayMessage("I'm sorry, I'm having trouble connecting right now. Please try again or check the server console.", 'model');
    } finally {
        sendButton.disabled = false;
        userInput.focus();
    }
}


// --- Event Listeners ---
chatToggle.addEventListener('click', toggleChat);
sendButton.addEventListener('click', sendMessage);

// Allow pressing Enter key to send message
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) {
        sendMessage();
    }
});

