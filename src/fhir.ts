export interface VitalReading {
    date: string;
    vitalType: string;
    value: number;
    unit: string;
}

const LOINC: Record<string, string> = {
    heartRate: '8867-4',
    spO2: '59408-5',
    respiratoryRate: '9279-1',
    systolicBP: '8480-6',
    temperature: '8310-5',
};

async function fhirGet(url: string, token: string): Promise<any> {
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/fhir+json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`FHIR ${res.status}: ${text}`);
    }
    return res.json();
}

export async function getVitalsTimeline(
    baseUrl: string,
    token: string,
    patientId: string,
    days: number = 7
): Promise<VitalReading[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const url = `${baseUrl}/Observation?patient=${patientId}&category=vital-signs&date=ge${since.toISOString()}&_sort=date&_count=200`;
    const bundle = await fhirGet(url, token);

    const readings: VitalReading[] = [];

    for (const entry of bundle.entry ?? []) {
        const obs = entry.resource;
        const code = obs?.code?.coding?.[0]?.code;
        const vitalName = Object.entries(LOINC).find(([, c]) => c === code)?.[0];
        const value = obs?.valueQuantity?.value;
        const date = obs?.effectiveDateTime;
        const unit = obs?.valueQuantity?.unit ?? '';

        if (vitalName && value !== undefined && date) {
            readings.push({ date, vitalType: vitalName, value, unit });
        }
    }

    return readings.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getClinicalContext(
    baseUrl: string,
    token: string,
    patientId: string
) {
    const [patient, encounterBundle, conditionBundle] = await Promise.all([
        fhirGet(`${baseUrl}/Patient/${patientId}`, token),
        fhirGet(`${baseUrl}/Encounter?patient=${patientId}&_sort=-date&_count=1`, token),
        fhirGet(`${baseUrl}/Condition?patient=${patientId}&clinical-status=active`, token),
    ]);

    const lastEncounter = encounterBundle.entry?.[0]?.resource ?? null;
    const activeConditions = (conditionBundle.entry ?? [])
        .map((e: any) => e.resource?.code?.coding?.[0]?.display ?? 'Unknown')
        .filter(Boolean);

    return { patient, lastEncounter, activeConditions };
}

export function formatTimelineForPrompt(readings: VitalReading[]): string {
    const byDate: Record<string, Record<string, string>> = {};

    for (const r of readings) {
        const day = r.date.split('T')[0];
        byDate[day] = byDate[day] ?? {};
        byDate[day][r.vitalType] = `${r.value} ${r.unit}`;
    }

    return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vitals]) => {
            const parts = Object.entries(vitals)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            return `${date}: ${parts}`;
        })
        .join('\n');
}