import { IncomingMessage } from 'http';

export interface SharpContext {
    fhirServerUrl: string;
    fhirAccessToken: string;
    patientId: string;
}

export function extractSharpContext(req: IncomingMessage): SharpContext | null {
    const fhirServerUrl = req.headers['x-fhir-server-url'] as string;
    const fhirAccessToken = req.headers['x-fhir-access-token'] as string;
    const patientId = req.headers['x-patient-id'] as string;

    if (!fhirServerUrl || !fhirAccessToken || !patientId) {
        return null;
    }

    return { fhirServerUrl, fhirAccessToken, patientId };
}