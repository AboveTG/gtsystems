import { youtubeLayer } from "../lib/layers/youtube.js";
import { fuseEvidence } from "../lib/fusion.js";
import { dedupeChunks } from "../lib/dedupe.js";
import { computeConfidence } from "../lib/confidence.js";

const provider = {
name: "GROQ",
url: "https://api.groq.com/openai/v1/chat/completions",
headers: {
Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
"Content-Type": "application/json"
},
model: "llama-3.3-70b-versatile"
};

function detectSignal(text) {
if (!text || text.length < 80) return 0;
if (text.includes("metadata")) return 1;
if (text.length < 500) return 2;
return 3;
}

const SYSTEM_PROMPT = `
You are a strict linguistic analyzer.

Return JSON only:
{
"noise_score": number,
"confidence": number,
"emotional_triggers": string[],
"logic_breakdown": {
"summary": string,
"key_observations": string[],
"framing_notes": string[]
}
}
`;

function safeParse(content) {
try {
const cleaned = content.replace(/`json/g, "").replace(/`/g, "");
const start = cleaned.indexOf("{");
const end = cleaned.lastIndexOf("}");
return JSON.parse(cleaned.slice(start, end + 1));
} catch {
return null;
}
}

export default async function handler(req, res) {

```
if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
}

const input = req.body?.input?.trim();
if (!input) {
    return res.status(400).json({ error: "No input provided" });
}

// -------------------------
// INGESTION GRAPH
// -------------------------
const layers = [];

const yt = await youtubeLayer(input);
if (yt) layers.push(yt);

const fused = fuseEvidence(layers);
const dedupedText = dedupeChunks([fused.text]).join("\n");

const signal_level = detectSignal(dedupedText);

// -------------------------
// HARD GATE
// -------------------------
if (signal_level === 1) {
    return res.status(200).json({
        noise_score: null,
        confidence: 0,
        signal_level,
        source_type: "youtube",
        layers,
        emotional_triggers: [],
        logic_breakdown: {
            summary: "Metadata-only input.",
            key_observations: ["No transcript available"],
            framing_notes: ["Execution skipped"]
        },
        node: provider.name
    });
}

// -------------------------
// MODEL CALL
// -------------------------
const response = await fetch(provider.url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: dedupedText }
        ]
    })
});

const raw = await response.text();
const api = JSON.parse(raw);
const parsed = safeParse(api?.choices?.[0]?.message?.content);

const confidence = computeConfidence({
    layers,
    signalLevel: signal_level,
    modelConfidence: parsed?.confidence ?? 0.4
});

return res.status(200).json({
    noise_score: parsed?.noise_score ?? 0,
    confidence,
    signal_level,
    layers,
    emotional_triggers: parsed?.emotional_triggers ?? [],
    logic_breakdown: parsed?.logic_breakdown ?? {
        summary: "",
        key_observations: [],
        framing_notes: []
    },
    node: provider.name
});
```

}
