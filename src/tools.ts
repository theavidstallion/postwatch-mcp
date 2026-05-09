import { GoogleGenerativeAI } from '@google/generative-ai';
import { getVitalsTimeline, getClinicalContext, formatTimelineForPrompt } from './fhir.js';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const gemini = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface ToolArgs {
    fhir_server_url: string;
    fhir_access_token: string;
    patient_id: string;
    days?: number;
}

export async function getVitalsTrend(args: ToolArgs) {
    const days = args.days ?? 7;
    const readings = await getVitalsTimeline(
        args.fhir_server_url,
        args.fhir_access_token,
        args.patient_id,
        days
    );

    return {
        patient_id: args.patient_id,
        days_requested: days,
        total_readings: readings.length,
        vitals_timeline: readings,
        formatted_timeline: formatTimelineForPrompt(readings),
    };
}

export async function getClinical(args: ToolArgs) {
    const ctx = await getClinicalContext(
        args.fhir_server_url,
        args.fhir_access_token,
        args.patient_id
    );

    const enc = ctx.lastEncounter;
    const name = ctx.patient?.name?.[0];

    return {
        patient_id: args.patient_id,
        patient_name: `${name?.given?.join(' ') ?? ''} ${name?.family ?? ''}`.trim(),
        discharge_date: enc?.period?.end ?? 'Unknown',
        discharge_diagnosis: enc?.reasonCode?.[0]?.coding?.[0]?.display ?? 'Not specified',
        active_conditions: ctx.activeConditions,
        days_since_discharge: enc?.period?.end
            ? Math.floor((Date.now() - new Date(enc.period.end).getTime()) / 86400000)
            : null,
    };
}

export async function assessDeteriorationRisk(args: ToolArgs) {
    const [vitalsData, clinicalData] = await Promise.all([
        getVitalsTrend(args),
        getClinical(args),
    ]);

    if (vitalsData.total_readings === 0) {
        return {
            risk_level: 'UNKNOWN',
            reason: 'No vital sign readings found in the specified time window.',
            patient_id: args.patient_id,
        };
    }

    const prompt = `You are a clinical decision support AI analyzing post-discharge patient vital signs for deterioration risk.

PATIENT CONTEXT:
- Name: ${clinicalData.patient_name}
- Discharge diagnosis: ${clinicalData.discharge_diagnosis}
- Days since discharge: ${clinicalData.days_since_discharge ?? 'Unknown'}
- Active conditions: ${clinicalData.active_conditions.join(', ') || 'None recorded'}

VITAL SIGNS TIMELINE (chronological, one row per day):
${vitalsData.formatted_timeline}

ANALYSIS INSTRUCTIONS:
1. Detect TRENDS not just threshold violations. HR increasing 72 to 91 over 5 days is dangerous even if each value is individually normal.
2. Detect CROSS-SIGNAL correlations. HR trending up while SpO2 trending down simultaneously is a compound deterioration signal more alarming than either alone.
3. Apply CLINICAL CONTEXT. Post-cardiac-surgery patients tolerate less HR increase than post-appendectomy patients. Weight findings accordingly.
4. Be conservative. False negatives cost lives. False positives cost a phone call.

Return ONLY valid JSON. No markdown. No explanation. Nothing outside the JSON object:
{
  "risk_level": "LOW",
  "confidence": 0.85,
  "primary_concern": "single concise sentence describing the main finding",
  "trend_findings": ["finding 1", "finding 2"],
  "cross_signal_correlations": ["correlation if detected, empty array if none"],
  "recommended_action": "specific actionable instruction for the care team",
  "clinical_reasoning": "2-3 sentences explaining the assessment",
  "would_threshold_alert_trigger": false
}`;

    const result = await gemini.generateContent(prompt);
    const raw = result.response.text().trim();

    let assessment: any;
    try {
        const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        assessment = JSON.parse(clean);
    } catch {
        assessment = { parse_error: true, raw_response: raw };
    }

    const fhirRiskAssessment = {
        resourceType: 'RiskAssessment',
        status: 'final',
        subject: { reference: `Patient/${args.patient_id}` },
        occurrenceDateTime: new Date().toISOString(),
        basis: [{
            display: `Analyzed ${vitalsData.total_readings} vital sign readings over ${args.days ?? 7} days`,
        }],
        prediction: [{
            outcome: { text: assessment.primary_concern ?? 'Assessment completed' },
            qualitativeRisk: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/risk-probability',
                    code: (assessment.risk_level ?? 'unknown').toLowerCase(),
                    display: assessment.risk_level ?? 'UNKNOWN',
                }],
            },
            rationale: assessment.clinical_reasoning ?? '',
        }],
    };

    return {
        patient_id: args.patient_id,
        assessment,
        fhir_risk_assessment: fhirRiskAssessment,
        vitals_summary: vitalsData.formatted_timeline,
        clinical_context: clinicalData,
    };
}