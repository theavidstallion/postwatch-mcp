import 'dotenv/config';

const FHIR_BASE_URL = 'https://app.promptopinion.ai/api/workspaces/019dbce5-bcef-7a8d-b823-dc3fdc71a75d/fhir';
const API_KEY = 'Bearer 019e0e89-709c-76fb-9f70-d92582aa3230:Ke77hO0TkgkUqxvxsCkkmlHA4yMbuS9Q';

const PATIENTS = {
    STABLE: 'f8c98491-5f0d-4be7-897a-448fe270c41c', // Jones Adam
    CRITICAL: '26479c04-8e12-45ee-86ed-0754cac1982e' // Christina Hart
};

const DATES = [
    "2026-05-03T09:00:00Z",
    "2026-05-04T09:00:00Z",
    "2026-05-05T09:00:00Z",
    "2026-05-06T09:00:00Z",
    "2026-05-07T09:00:00Z"
];

// Helper to quickly build observation resources
function buildObservation(patientId: string, loinc: string, display: string, value: number, unit: string, unitCode: string, date: string) {
    return {
        "resourceType": "Observation",
        "status": "final",
        "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }],
        "code": { "coding": [{ "system": "http://loinc.org", "code": loinc, "display": display }] },
        "subject": { "reference": `Patient/${patientId}` },
        "effectiveDateTime": date,
        "valueQuantity": { "value": value, "unit": unit, "system": "http://unitsofmeasure.org", "code": unitCode }
    };
}

// Helper to build the CABG clinical context
function buildClinicalContext(patientId: string) {
    return [
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
        }
    ];
}

const resources: any[] = [];

// 1. Setup Jones Adam (Stable)
resources.push(...buildClinicalContext(PATIENTS.STABLE));
const stableHRs = [72, 73, 71, 72, 72];
const stableSpO2s = [98, 98, 97, 98, 98];
const stableRRs = [14, 14, 15, 14, 14];

DATES.forEach((date, i) => {
    resources.push(buildObservation(PATIENTS.STABLE, "8867-4", "Heart rate", stableHRs[i], "beats/min", "/min", date));
    resources.push(buildObservation(PATIENTS.STABLE, "59408-5", "Oxygen saturation", stableSpO2s[i], "%", "%", date));
    resources.push(buildObservation(PATIENTS.STABLE, "9279-1", "Respiratory rate", stableRRs[i], "/min", "/min", date));
});

// 2. Setup Christina Hart (Critical)
resources.push(...buildClinicalContext(PATIENTS.CRITICAL));
const criticalHRs = [88, 95, 102, 108, 115];
const criticalSpO2s = [94, 92, 90, 88, 86];
const criticalRRs = [18, 20, 22, 24, 26];

DATES.forEach((date, i) => {
    resources.push(buildObservation(PATIENTS.CRITICAL, "8867-4", "Heart rate", criticalHRs[i], "beats/min", "/min", date));
    resources.push(buildObservation(PATIENTS.CRITICAL, "59408-5", "Oxygen saturation", criticalSpO2s[i], "%", "%", date));
    resources.push(buildObservation(PATIENTS.CRITICAL, "9279-1", "Respiratory rate", criticalRRs[i], "/min", "/min", date));
});

// Execute Upload
async function runUpload() {
    console.log(`🚀 Starting upload for ${resources.length} total resources...`);
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
            console.error(`❌ Failed to upload ${res.resourceType} for Patient ${res.subject?.reference}: ${response.status} - ${err}`);
        } else {
            console.log(`✅ Uploaded ${res.resourceType} for ${res.subject?.reference}`);
        }
    }
    console.log("🎉 All data seeded successfully. Ready for agent testing.");
}

runUpload();