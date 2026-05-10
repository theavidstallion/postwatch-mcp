import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Note: Use this specific transport from the SDK
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { getVitalsTrend, getClinical, assessDeteriorationRisk } from './tools.js';
import cors from 'cors';

const app = express();
const port = process.env["PORT"] || 8080;

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
    res.send("PostWatch is alive");
});

app.post("/mcp", async (req, res) => {
    try {
        const server = new McpServer(
            {
                name: "PostWatch Deterioration Monitor",
                version: "1.0.0",
            },
            {
                capabilities: {
                    extensions: {
                        "ai.promptopinion/fhir-context": {
                            scopes: [
                                { name: "patient/Patient.rs", required: true },
                                { name: "offline_access" },
                                { name: "patient/Observation.rs" },
                                { name: "patient/Condition.rs" },
                            ],
                        },
                    },
                },
            }
        );

        // ── Tool 1: Risk Assessment (The Star of the Show) ───────────────────
        server.tool(
            'assess_deterioration_risk',
            'Analyzes post-discharge vital sign trends using AI temporal reasoning. Detects compound multi-signal deterioration patterns that threshold-based systems miss. Returns FHIR RiskAssessment with clinical escalation recommendation.',
            {
                patientId: z.string().describe('The FHIR Patient ID'),
                days: z.number().optional().default(30),
            },
            async (args) => {
                try {
                    const result = await assessDeteriorationRisk({
                        patient_id: args.patientId,
                        days: args.days,
                    });
                    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
                } catch (err: any) {
                    return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
                }
            }
        );

        server.tool(
            'get_vitals_trend',
            'Retrieves chronological vital sign readings for a post-discharge patient.',
            {
                patientId: z.string().describe('The FHIR Patient ID'),
                days: z.number().optional().default(30),
            },
            async (args) => {
                try {
                    const result = await getVitalsTrend({
                        patient_id: args.patientId,
                        days: args.days,
                    });
                    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
                } catch (err: any) {
                    return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
                }
            }
        );

        server.tool(
            'get_clinical_context',
            'Retrieves patient clinical context: discharge diagnosis, active conditions, days since discharge.',
            {
                patientId: z.string().describe('The FHIR Patient ID'),
            },
            async (args) => {
                try {
                    const result = await getClinical({
                        patient_id: args.patientId,
                    });
                    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
                } catch (err: any) {
                    return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
                }
            }
        );

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        res.on("close", () => {
            transport.close();
            server.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);

    } catch (error) {
        console.log("Error handling MCP request:", error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
            });
        }
    }
});

app.listen(port, () => {
    console.log(`🚀 PostWatch Streamable MCP listening on port ${port}`);
});