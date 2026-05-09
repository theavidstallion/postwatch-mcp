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

// ── Unified MCP Endpoint ──────────────────────────────────────────────────

// GET: Establishes the SSE Connection
app.get('/mcp', async (req, res) => {
    // Generate or use provided sessionId
    const sessionId = (req.query.sessionId as string) ?? 'session-default';

    // SSEServerTransport(endpoint, response) 
    // We set the endpoint to '/mcp' so POSTs come back to this same route
    const transport = new SSEServerTransport('/mcp', res);
    const server = buildMcpServer();

    transports.set(sessionId, transport);

    res.on('close', () => {
        transports.delete(sessionId);
    });

    await server.connect(transport);
});

// POST: Receives messages/tool calls from the platform
app.post('/mcp', async (req, res) => {
    const sessionId = (req.query.sessionId as string) ?? 'session-default';
    const transport = transports.get(sessionId);

    if (!transport) {
        // Fail gracefully: if the specific session is lost, try the default one
        const fallbackTransport = transports.get('session-default');
        if (fallbackTransport) {
            await fallbackTransport.handlePostMessage(req, res, req.body);
        } else {
            res.status(404).json({ error: "No active MCP session found. Connect via GET first." });
        }
        return;
    }

    await transport.handlePostMessage(req, res, req.body);
});

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