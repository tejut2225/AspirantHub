/**
 * Firebase Cloud Function to export Firestore data to a Google Sheet 
 * on an HTTPS request (manual or client-side trigger).
 * * * 1. Reads data from a specified Firestore collection.
 * 2. Authenticates with the Google Sheets API using the Cloud Function's 
 * default Service Account (Application Default Credentials - ADC).
 * 3. Writes the data as a clean mirror to the target Google Sheet.
 * * NOTE: This method removes the dependency on Cloud Secret Manager, allowing
 * this function to be deployed on the free Spark plan.
 */

// Import necessary Firebase/Google packages
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// Initialize Firebase Admin SDK to access Firestore
admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURATION CONSTANTS (UPDATED) ---
// 1. ID from your Google Sheet URL (the part after /d/ and before /edit)
const SPREADSHEET_ID = '17gfk-nGGSWmcHCPUi6ZcHPKDWMTALIJSHiWaMqYRbCs'; 

// 2. The name of the Firestore collection to export
const COLLECTION_NAME = 'questions'; 

// 3. The sheet/tab name and starting cell range
const SHEET_RANGE = 'Sheet1!A1'; 

// 4. NOTE: Removed SA_SECRET_NAME as we no longer use Cloud Secret Manager.
// --- END CONFIGURATION ---

/**
 * HTTPS Callable function to be triggered manually.
 * NOTE: This function can be deployed on the free Spark plan.
 */
exports.exportFirestoreToSheets = functions
    // Change to an HTTPS request handler instead of a scheduled pubsub topic
    .https.onRequest(async (req, res) => {
        
    functions.logger.info(`Starting manual export for collection: ${COLLECTION_NAME}`);

    // --- 1. Authentication with Google Sheets API using Application Default Credentials (ADC) ---
    try {
        // Use Application Default Credentials (ADC) to authenticate as the function's service account.
        // This avoids the need for a private key in Cloud Secret Manager, making it Spark-plan compatible.
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        // The 'sheets' client will use the credentials obtained from the default service account
        const sheets = google.sheets({ version: 'v4', auth });

        // --- IMPORTANT MANUAL SETUP STEP ---
        // You MUST share the target Google Sheet (SPREADSHEET_ID) with the service account email 
        // that runs this Cloud Function. 
        // The email is typically: [YOUR_PROJECT_ID]@appspot.gserviceaccount.com 
        // Find your project ID in the Firebase console settings.
        // -----------------------------------


        // --- 2. Fetch data from Firestore ---
        const snapshot = await db.collection(COLLECTION_NAME).get();
        functions.logger.info(`Found ${snapshot.size} documents to export.`);
        
        // Prepare data with a header row, now including the Document ID
        const data = [
            ['Document ID', 'Name', 'Email', 'Registration Date'] // Header Row
        ]; 
        
        // Map Firestore documents to a 2D array (row, column)
        snapshot.forEach(doc => {
            const d = doc.data();
            
            // Convert Firestore Timestamp object to a readable string
            let registrationDate = '';
            if (d.timestamp && d.timestamp.toDate) {
                registrationDate = d.timestamp.toDate().toLocaleString('en-US');
            }

            data.push([
                doc.id, // <-- The unique Firestore Document ID (your "Question ID")
                d.name || '', 
                d.email || '', 
                registrationDate
            ]);
        });

        // --- 3. Write data to Google Sheet ---
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_RANGE, // e.g., 'Sheet1!A1'
            valueInputOption: 'USER_ENTERED', // Interprets the values as if typed by a user
            resource: {
                values: data,
            },
        });
        
        const successMessage = `Successfully exported ${data.length - 1} records to Google Sheet ID: ${SPREADSHEET_ID}`;
        functions.logger.info(successMessage);
        
        // Send a success response
        res.status(200).send({ message: successMessage });
        
        return null;

    } catch (error) {
        functions.logger.error('Error during Firestore to Sheets export:', error);
        // Send an HTTP 500 response on failure
        res.status(500).send({ error: 'Export failed due to an internal error.', details: error.message });
        throw new Error('Export failed due to an internal error.');
    }
});
