// -------------------- server.mjs --------------------
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai'; 

// -------------------- Setup Paths --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Firebase Service Account --------------------
let serviceAccount;
try {
  serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'serviceAccountKey.json'), 'utf8')
  );
} catch (err) {
  console.error('❌ Failed to read serviceAccountKey.json:', err);
  process.exit(1);
}

// -------------------- Initialize App & AI Client --------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the Gemini Client using the @google/genai Client pattern
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 
// 💡 Using gemini-2.0-flash-lite for stability and quota
const modelName = "gemini-2.0-flash-lite"; 

app.use(cors()); 
app.use(bodyParser.json());
app.use(express.json()); 

// ✅ Serve frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- Firebase Init --------------------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// -------------------- Helper Functions --------------------
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Delay helper for retries
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// -------------------- Nodemailer Setup --------------------
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', 
  port: 587,              
  secure: false,          
  auth: {
    user: process.env.EMAIL_USER || 'tejut2225@gmail.com', 
    pass: process.env.EMAIL_PASS || 'fcef lcds zkaq ckqp', 
  },
});

// -------------------- Frontend Routes --------------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/exam', (req, res) => res.sendFile(path.join(__dirname, 'public', 'exam.html')));
app.get('/result', (req, res) => res.sendFile(path.join(__dirname, 'public', 'result.html')));

// -------------------- Backend API Routes --------------------

// 8️⃣ UPDATED: Secure Gemini Chat Endpoint (Fixed for @google/genai syntax)
app.post('/api/chat', async (req, res) => {
    const { messages, systemInstruction } = req.body;
    const maxRetries = 3;
    let attempt = 0;

    // Prepare conversation history correctly for this SDK
    const contents = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    while (attempt < maxRetries) {
        try {
            // Using the correct .models.generateContent method for this library
            const result = await ai.models.generateContent({
                model: modelName,
                contents: contents,
                config: {
                    systemInstruction: systemInstruction 
                }
            });

            // In this SDK, result.text is a property, not a function
            return res.json({ text: result.text });

        } catch (error) {
            attempt++;
            // Check for Rate Limit (429)
            if (error.status === 429 && attempt < maxRetries) {
                console.warn(`⚠️ Quota hit. Retry attempt ${attempt}/${maxRetries} in 2 seconds...`);
                await sleep(2000); 
                continue;
            }

            console.error("Gemini API Error:", error);
            const errorMsg = error.status === 429 
                ? "EduMate AI is busy. Please wait a minute and try again." 
                : "Sorry, EduMate AI is having trouble. Please try refreshing.";
            
            return res.status(error.status || 500).json({ text: errorMsg });
        }
    }
});

// 1️⃣ Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const otp = generateOTP();
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      await userRef.update({ otp, verified: false });
    } else {
      await userRef.set({ email, otp, verified: false, exams: [] });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'tejut2225@gmail.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
    });

    console.log(`✅ OTP for ${email}: ${otp}`);
    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Check logs.' });
  }
});

// 2️⃣ Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

  try {
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();

    if (!docSnap.exists) return res.status(404).json({ success: false, message: 'User not found' });

    if (docSnap.data().otp === otp) {
      await userRef.update({ verified: true, otp: admin.firestore.FieldValue.delete() });
      res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

// 3️⃣ Register User
app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();

    if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Send OTP first.' });
    if (!docSnap.data().verified) return res.status(403).json({ success: false, message: 'Email not verified.' });

    await userRef.update({
      name,
      password, 
      createdAt: admin.firestore.FieldValue.serverTimestamp(), 
    });

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// 4️⃣ Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();

    if (!docSnap.exists || docSnap.data().password !== password)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!docSnap.data().verified) return res.status(403).json({ success: false, message: 'Email not verified.' });

    res.status(200).json({ success: true, message: 'Login successful', user: docSnap.data() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5️⃣ Fetch Questions
app.get('/questions', async (req, res) => {
  try {
    const snapshot = await db.collection('questions').get();
    const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6️⃣ Submit Exam
app.post('/submit', async (req, res) => {
  const { email, answers, timeTakenSeconds } = req.body;
  if (!email || !answers) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();
    if (!docSnap.exists) return res.status(404).json({ success: false, message: 'User not found' });

    const examResult = { answers, timeTakenSeconds, timestamp: admin.firestore.FieldValue.serverTimestamp() };
    await userRef.update({ exams: admin.firestore.FieldValue.arrayUnion(examResult) });

    res.status(200).json({ success: true, message: 'Exam submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7️⃣ Fetch Results
app.get('/results/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const userRef = db.collection('users').doc(email);
    const docSnap = await userRef.get();
    if (!docSnap.exists) return res.status(404).json({ success: false, message: 'User not found' });

    const exams = docSnap.data().exams || [];
    res.status(200).json({ success: true, exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});