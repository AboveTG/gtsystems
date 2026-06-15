import { rhetoricalScan } from "../lib/rhetoric.js";
import {
    classifyInput,
    extractYouTubeId,
    normalizeInput,
    signalLevel
} from "../lib/ingestion.js";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string" ? body.input :
        typeof body.text === "string" ? body.text :
        "";

    if (!input.trim()) {
        return res.status(400).json({ error: "No input provided" });
    }

    // ----------------------------
    // CLASSIFICATION (FIRST PASS)
    // ----------------------------
    const type = classifyInput(input);

    let text = normalizeInput(input, type);
    let source_type = type;
    let layers = [];

    // ----------------------------
    // PROVIDER
    // ----------------------------
    const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    // ----------------------------
    // YOUTUBE INGESTION
    // ----------------------------
    async function fetchTranscript(videoId) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;

            const t = await yt.fetchTranscript(videoId);

            return t.map(x => x.text).join(" ").replace(/\s+/g, " ").trim();
        } catch {
            return null;
        }
    }

    if (type === "youtube") {

        const videoId = extractYouTubeId(input);

        layers.push({
            layer: "youtube_id",
            status: videoId ? "hit" : "miss"
        });

        const transcript = videoId ? await fetchTranscript(videoId) : null;

        if (transcript) {
            text = transcript;
            layers.push({ layer: "youtube_transcript", status: "hit" });
        } else {
            text = `[METADATA ONLY MODE] youtube:${videoId || "unknown"}`;
            layers.push({ layer: "youtube_transcript", status: "miss" });
        }
    }

    if (type === "web" || type === "tiktok" || type === "tweet") {
        layers.push({ layer: type, status: "hit" });
    }

    // ----------------------------
    // SIGNAL ENGINE
    // ----------------------------
    const signal = signalLevel(text);

    // ----------------------------
    // ⚠️ CRITICAL FIX: Rhetorical scan AFTER text is resolved
    // ----------------------------
    const rhetoric = rhetoricalScan(text);

    // ----------------------------
    // HARD GATE
    // ----------------------------
    if (signal === 1) {
        return res.status(200).json({
            noise_score: null,
            confidence: 0,
            signal_level: signal,
            source_type,
            layers,
            rhetoric, // still expose weak signal structure
            emotional_triggers: [],
            logic_breakdown: {
                summary: "Low signal ingestion. Execution skipped.",
                key_observations: [
                    "No usable linguistic body",
                    "Metadata-only or minimal input"
                ],
                framing_notes: [
                    "Model bypassed for safety"
                ]
            },
            node: provider.name
        });
    }

    // ----------------------------
    // SYSTEM PROMPT (NOW INCLUDES RHETORIC)
    // ----------------------------
    const SYSTEM_PROMPT = `
You are a deterministic linguistic signal analyzer.

You are given:
- raw text
- rhetorical feature scan metadata

Use both.

Return ONLY valid JSON:

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
            const cleaned = (content || "")
                .replace(/```json/g, "")
                .replace(/```/g, "");

            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");

            if (start === -1 || end === -1) return null;

            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    // ----------------------------
    // MODEL CALL
    // ----------------------------
    try {

        const response = await fetch(provider.url, {
            method: "POST",
            headers: provider.headers,
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            text,
                            layers,
                            rhetoric   // 🔥 now properly injected
                        })
                    }
                ]
            })
        });

        const raw = await response.text();

        if (!response.ok) {
            return res.status(500).json({
                error: "Model failure",
                details: raw.slice(0, 500)
            });
        }

        const json = JSON.parse(raw);
        const content = json?.choices?.[0]?.message?.content;

        const parsed = safeParse(content);

        if (!parsed) {
            return res.status(500).json({
                error: "Invalid model output"
            });
        }

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence: parsed.confidence ?? 0,
            signal_level: signal,
            source_type,
            layers,
            rhetoric, // 🔥 now visible in UI graph
            emotional_triggers: parsed.emotional_triggers ?? [],
            logic_breakdown: parsed.logic_breakdown ?? {
                summary: "",
                key_observations: [],
                framing_notes: []
            },
            node: provider.name
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
