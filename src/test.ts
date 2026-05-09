import 'dotenv/config';
import { assessDeteriorationRisk } from './tools.js';

async function runTest() {
    console.log("Evaluating patient data...");

    try {
        const result = await assessDeteriorationRisk({
            fhir_server_url: 'https://app.promptopinion.ai/api/workspaces/019dbce5-bcef-7a8d-b823-dc3fdc71a75d/fhir',
            fhir_access_token: '019e0e89-709c-76fb-9f70-d92582aa3230:Ke77hO0TkgkUqxvxsCkkmlHA4yMbuS9Q',
            patient_id: 'efda1d29-05da-475e-8d39-6c11fe4d6cf9',
            days: 30, // Using 30 to ensure the May 3-7 dates are caught
        });

        console.log("\n=== AI ASSESSMENT RESULT ===");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();