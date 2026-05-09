import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { extractSharpContext } from './sharp.js';
import { getVitalsTrend, getClinical, assessDeteriorationRisk } from './tools.js';

const app = express();

// ── CORS Configuration (Crucial for external platforms like PO) ───────────
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-fhir-server-url, x-fhir-access-token, x-patient-id');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// ── MCP Server Builder ────────────────────────────────────────────────────
function buildMcpServer() {
    const server = new McpServer({
        name: 'post-discharge-deterioration-monitor',
        version: '1.0.0',
    });

    // ── Tool 1 ──
    server.tool(
        'get_vitals_trend',
        'Retrieves chronological vital sign readings for a post-discharge patient from the FHIR store.',
        { days: z.number().optional().default(7).describe('Days of history to retrieve') },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) return { isError: true, content: [{ type: 'text', text: 'Missing SHARP headers' }] };

            try {
                const result = await getVitalsTrend({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                    days: args.days,
                });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text', text: err.message }] };
            }
        }
    );

    // ── Tool 2 ──
    server.tool(
        'get_clinical_context',
        'Retrieves patient clinical context: discharge diagnosis, active conditions, days since discharge.',
        {},
        async (_args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) return { isError: true, content: [{ type: 'text', text: 'Missing SHARP headers' }] };

            try {
                const result = await getClinical({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text', text: err.message }] };
            }
        }
    );

    // ── Tool 3 ──
    server.tool(
        'assess_deterioration_risk',
        'Analyzes post-discharge vital sign trends using AI temporal reasoning.',
        { days: z.number().optional().default(7).describe('Days of history to analyze') },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) return { isError: true, content: [{ type: 'text', text: 'Missing SHARP headers' }] };

            try {
                const result = await assessDeteriorationRisk({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                    days: args.days,
                });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            } catch (err: any) {
                return { isError: true, content: [{ type: 'text', text: err.message }] };
            }
        }
    );

    return server;
}

// ── Native Connection Handling ────────────────────────────────────────────
const transports = new Map<string, SSEServerTransport>();

// SSE endpoint — this is the URL you register with Prompt Opinion
app.get('/mcp', async (req, res) => {
    console.log("🟢 Incoming SSE Connection from Prompt Opinion...");

    // 1. Set the buffer-killer header BEFORE the SDK takes over
    res.setHeader('X-Accel-Buffering', 'no');

    // 2. Optimization for Azure/C# parsers
    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);

    const server = buildMcpServer();

    // 3. The SDK will handle res.writeHead(200, ...) internally now.
    // We use the absolute path to ensure the C# client doesn't get lost.
    const transport = new SSEServerTransport('/mcp/message', res);

    await server.connect(transport);

    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    console.log(`✅ Connection established. Session ID: ${sessionId}`);

    res.on('close', () => {
        console.log(`🔴 Connection closed: ${sessionId}`);
        transports.delete(sessionId);
    });
});

// Message endpoint
app.post('/mcp/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
        console.error(`❌ Session ${sessionId} not found for POST`);
        res.status(404).json({ error: "Session not found" });
        return;
    }

    await transport.handlePostMessage(req, res);
});

// ── Start Server ──────────────────────────────────────────────────────────
// Use 0.0.0.0 to ensure Azure's internal network can route to the port
const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PostWatch MCP Server Listening on 0.0.0.0:${PORT}`);
});