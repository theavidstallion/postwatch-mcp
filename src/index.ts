import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { extractSharpContext } from './sharp.js';
import { getVitalsTrend, getClinical, assessDeteriorationRisk } from './tools.js';

const app = express();
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        name: 'post-discharge-deterioration-monitor',
        version: '1.0.0',
        platform: 'Render',
        timestamp: new Date().toISOString()
    });
});

// Session storage to link GET (SSE) and POST (Messages)
const transports = new Map<string, SSEServerTransport>();

/**
 * Builds a fresh instance of the MCP server with all tools registered.
 */
function buildMcpServer() {
    const server = new McpServer({
        name: 'post-discharge-deterioration-monitor',
        version: '1.0.0',
    });

    // Tool 1: Vitals Trend
    server.tool(
        'get_vitals_trend',
        'Retrieves chronological vital sign readings.',
        { days: z.number().optional().default(7) },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) throw new Error('Missing SHARP headers');

            const result = await getVitalsTrend({
                fhir_server_url: sharp.fhirServerUrl,
                fhir_access_token: sharp.fhirAccessToken,
                patient_id: sharp.patientId,
                days: args.days,
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );

    // Tool 2: Clinical Context
    server.tool(
        'get_clinical_context',
        'Retrieves discharge diagnosis and active conditions.',
        {},
        async (_args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) throw new Error('Missing SHARP headers');

            const result = await getClinical({
                fhir_server_url: sharp.fhirServerUrl,
                fhir_access_token: sharp.fhirAccessToken,
                patient_id: sharp.patientId,
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );

    // Tool 3: AI Deterioration Risk (The Winner Tool)
    server.tool(
        'assess_deterioration_risk',
        'AI temporal analysis of vitals to detect patterns threshold systems miss.',
        { days: z.number().optional().default(7) },
        async (args, extra) => {
            const req = (extra as any)._meta?.httpRequest;
            const sharp = req ? extractSharpContext(req) : null;
            if (!sharp) throw new Error('Missing SHARP headers');

            const result = await assessDeteriorationRisk({
                fhir_server_url: sharp.fhirServerUrl,
                fhir_access_token: sharp.fhirAccessToken,
                patient_id: sharp.patientId,
                days: args.days,
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );

    return server;
}

// ── Unified MCP Endpoint (Hackathon Bulletproof Version) ─────────────

// Single global transport since PO is the only client
let globalTransport: SSEServerTransport | null = null;
let globalServer: McpServer | null = null;

app.get('/mcp', async (req, res) => {
    // We explicitly tell the SDK the message endpoint is '/mcp/message'
    globalTransport = new SSEServerTransport('/mcp/message', res);

    // Only build the server once to prevent memory leaks
    if (!globalServer) {
        globalServer = buildMcpServer();
    }

    await globalServer.connect(globalTransport);
    console.log("✅ GET /mcp connection established by Prompt Opinion");
});

// A single handler function for incoming messages
const handlePost = async (req: express.Request, res: express.Response) => {
    if (!globalTransport) {
        console.error("❌ POST received before GET initialization");
        // Returning 202 instead of 404 so PO's aggressive ping doesn't fail the registration
        return res.status(202).json({ warning: "Waiting for GET stream" });
    }
    await globalTransport.handlePostMessage(req, res);
};

// Listen on both possible routes Prompt Opinion might use
app.post('/mcp', handlePost);
app.post('/mcp/message', handlePost);

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
✅ PostWatch MCP Server Live
--------------------------------------------------
Health Check:  http://localhost:${PORT}/health
MCP Endpoint:  http://localhost:${PORT}/mcp
--------------------------------------------------
    `);
});