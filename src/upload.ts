import 'dotenv/config';

const FHIR_BASE_URL = 'https://app.promptopinion.ai/api/workspaces/019dbce5-bcef-7a8d-b823-dc3fdc71a75d/fhir';
// Replace this with your actual API key!
const API_KEY = 'Bearer 019e0e89-709c-76fb-9f70-d92582aa3230:Ke77hO0TkgkUqxvxsCkkmlHA4yMbuS9Q';

const patientId = 'efda1d29-05da-475e-8d39-6c11fe4d6cf9';

// The exact resources from the bundle, just as a standard array
const resources = [
    {
        "resourceType": "Encounter",
        "status": "finished",
        "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "IMP" },
        "subject": { "reference": `Patient/${patientId}` },
        "period": { "start": "2026-04-13T08:00:00Z", "end": "2026-04-18T14:00:00Z" },
        "reasonCode": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "232717009", "display": "Coronary artery bypass grafting" }] }]
    },
    {
        "resourceType": "Condition",
        "clinicalStatus": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active" }] },
        "subject": { "reference": `Patient/${patientId}` },
        "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "53741008", "display": "Coronary arteriosclerosis" }] }
    },
    // Heart Rates
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-03T09:00:00Z", "valueQuantity": { "value": 72, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-04T09:00:00Z", "valueQuantity": { "value": 76, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-05T09:00:00Z", "valueQuantity": { "value": 81, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-06T09:00:00Z", "valueQuantity": { "value": 86, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-07T09:00:00Z", "valueQuantity": { "value": 91, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    // SpO2
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-03T09:00:00Z", "valueQuantity": { "value": 97, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-04T09:00:00Z", "valueQuantity": { "value": 97, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-05T09:00:00Z", "valueQuantity": { "value": 96, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-06T09:00:00Z", "valueQuantity": { "value": 95, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-07T09:00:00Z", "valueQuantity": { "value": 94, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } },
    // Respiratory Rate
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "9279-1", "display": "Respiratory rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-03T09:00:00Z", "valueQuantity": { "value": 14, "unit": "/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "9279-1", "display": "Respiratory rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-05T09:00:00Z", "valueQuantity": { "value": 16, "unit": "/min", "system": "http://unitsofmeasure.org", "code": "/min" } },
    { "resourceType": "Observation", "status": "final", "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }], "code": { "coding": [{ "system": "http://loinc.org", "code": "9279-1", "display": "Respiratory rate" }] }, "subject": { "reference": `Patient/${patientId}` }, "effectiveDateTime": "2026-05-07T09:00:00Z", "valueQuantity": { "value": 18, "unit": "/min", "system": "http://unitsofmeasure.org", "code": "/min" } }
];

async function runUpload() {
    console.log(`Starting upload for ${resources.length} resources...`);
    for (const res of resources) {
        const url = `${FHIR_BASE_URL}/${res.resourceType}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify(res)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`❌ Failed to upload ${res.resourceType}: ${response.status} - ${err}`);
        } else {
            console.log(`✅ Successfully uploaded ${res.resourceType}`);
        }
    }
    console.log("Upload complete.");
}

runUpload();