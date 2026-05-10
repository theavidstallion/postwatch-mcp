import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Note: Use this specific transport from the SDK
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { extractSharpContext } from './sharp.js';
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
        // 1. Mirror their exact capabilities object
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

        // 2. Register your tools inside the POST handler (one server per request)
        server.tool(
            'assess_deterioration_risk',
            'Analyzes post-discharge vital sign trends using AI.',
            { days: z.number().optional().default(7) },
            async (args) => {
                const sharp = extractSharpContext(req); // Pass the current request
                const result = await assessDeteriorationRisk({
                    fhir_server_url: sharp.fhirServerUrl,
                    fhir_access_token: sharp.fhirAccessToken,
                    patient_id: sharp.patientId,
                    days: args.days,
                });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
        );

        // [Add your other 2 tools here following the same pattern]

        // 3. Use the Streamable transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        res.on("close", () => {
            transport.close();
            server.close();
        });

        // 4. Connect and immediately handle the request body
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