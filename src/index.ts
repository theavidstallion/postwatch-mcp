import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { extractSharpContext } from './sharp.js';
import { getVitalsTrend, getClinical, assessDeteriorationRisk } from './tools.js';
import 'dotenv/config';

const app = express();
app.use(express.json());

// Health check — use this to verify deployment
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        name: 'post-discharge-deterioration-monitor',
        version: '1.0.0',
        sharp_headers_required: [
            'X-FHIR-Server-URL',
            'X-FHIR-Access-Token',
            'X-Patient-ID',
        ],
    });
});

// One transport per SSE connection
const transports = new Map<string, SSEServerTransport>();

function buildMcpServer() {
    const server = new McpServer({
        name: 'post-discharge-deterioration-monitor',
        version: '1.0.0',
    });

    // ── Tool 1 ────────────────────────────────────────────────────────────────
    server.tool(
        'get_vitals_trend',
        'Retrieves chronological vital sign readings for a post-discharge patient from the FHIR store.',
        { days: z.number().optional().default(7).describe('Days of history to retrieve') },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;

            if (!sharp) {
                return {
                    isError: true,
                    content: [{ type: 'text' as const, text: 'Missing SHARP headers: X-FHIR-Server-URL, X-FHIR-Access-Token, X-Patient-ID' }],
                };
            }

            try {
                const result = await getVitalsTrend({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                    days: args.days,
                });
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
            }
        }
    );

    // ── Tool 2 ────────────────────────────────────────────────────────────────
    server.tool(
        'get_clinical_context',
        'Retrieves patient clinical context: discharge diagnosis, active conditions, days since discharge.',
        {},
        async (_args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;

            if (!sharp) {
                return {
                    isError: true,
                    content: [{ type: 'text' as const, text: 'Missing SHARP headers' }],
                };
            }

            try {
                const result = await getClinical({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                });
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
            }
        }
    );

    // ── Tool 3 ────────────────────────────────────────────────────────────────
    server.tool(
        'assess_deterioration_risk',
        'Analyzes post-discharge vital sign trends using AI temporal reasoning. Detects compound multi-signal deterioration patterns that threshold-based systems miss. Returns FHIR RiskAssessment with clinical escalation recommendation.',
        { days: z.number().optional().default(7).describe('Days of history to analyze') },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;

            if (!sharp) {
                return {
                    isError: true,
                    content: [{ type: 'text' as const, text: 'Missing SHARP headers' }],
                };
            }

            try {
                const result = await assessDeteriorationRisk({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                    days: args.days,
                });
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
            }
        }
    );

    return server;
}

// SSE endpoint — this is the URL you register with Prompt Opinion
app.get('/mcp', async (req, res) => {
    const sessionId = (req.query.sessionId as string) ?? `session-${Date.now()}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const server = buildMcpServer();
    const transport = new SSEServerTransport('/mcp/message', res);

    transports.set(sessionId, transport);
    res.on('close', () => transports.delete(sessionId));

    await server.connect(transport);
});

// Message endpoint — paired with SSE
app.post('/mcp/message', async (req, res) => {
    const sessionId = (req.query.sessionId as string);
    const transport = transports.get(sessionId);

    if (!transport) {
        res.status(404).json({ error: `Session ${sessionId} not found` });
        return;
    }

    await transport.handlePostMessage(req, res, req.body);
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
    console.log(`MCP server running on http://localhost:${PORT}`);
    console.log(`SSE endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health: http://localhost:${PORT}/health`);
});