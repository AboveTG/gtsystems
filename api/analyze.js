export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string" ? body.input.trim()
        : typeof body.text === "string" ? body.text.trim()
        : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // =========================
    // DETECTION
    // =========================

    function isYouTubeUrl(str) {
        try {
            const u = new URL(str);
            return (
                u.hostname.includes("youtube.com") ||
                u.hostname.includes("youtu.be")
            );
        } catch {
            return false;
        }
    }

    function extractVideoId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    // =========================
    // LAYERS
    // =========================

    async function layer1(id) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;

            const t = await yt.fetchTranscript(id);
            return t.map(x => x.text).join(" ").replace(/\s+/g, " ").trim();
        } catch {
            return null;
        }
    }

    async function layer2(id) {
        try {
            const { Innertube } = await import("youtubei.js");

            const yt = await Innertube.create();
            const info = await yt.getInfo(id);
            const captions = await info.getTranscript();

            const seg = captions?.transcript?.content?.body?.initial_segments;
            if (!seg) return null;

            return seg.map(s => s.snippet?.text || "").join(" ");
        } catch {
            return null;
        }
    }

    async function layer3(url, id) {
        try {
            const r = await fetch(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
            );
            const d = await r.json();

            return `
[METADATA MODE - NO INFERENCE]

TITLE: ${d?.title || "unknown"}
CHANNEL: ${d?.author_name || "unknown"}
VIDEO_ID: ${id}

RULE: Do not infer meaning or topic.
            `.trim();
        } catch {
            return `
[MINIMAL MODE]

VIDEO_ID: ${id}
            `.trim();
        }
    }

    // =========================
    // INGESTION
    // =========================

    let text = input;
    let source_type = "text";

    if (isYouTubeUrl(input)) {
        source_type = "youtube";

        const id = extractVideoId(input);

        text =
            await layer1(id) ||
            await layer2(id) ||
            await layer3(input, id);
    }

    // =========================
    // SIGNAL CLASSIFIER
    // =========================

    function detectSignalLevel(t, type) {
        if (!t || t.length < 60) return 0;

        if (type === "youtube") {
            if (t.includes("[METADATA MODE")) return 1;
            if (t.length < 300) return 2;
            return 3;
        }

        return t.length > 800 ? 3 : 2;
    }

    const signal_level = detectSignalLevel(text, source_type);

    // =========================
    // GROQ
    // =========================

    export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string" ? body.input.trim()
        : typeof body.text === "string" ? body.text.trim()
        : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // =========================
    // PROVIDER (MUST BE FIRST)
    // =========================

    const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    // =========================
    // INGESTION LOGIC
    // =========================

    function isYouTubeUrl(str) {
        try {
            const u = new URL(str);
            return u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be");
        } catch {
            return false;
        }
    }

    function extractVideoId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    let text = input;
    let source_type = "text";

    if (isYouTubeUrl(input)) {
        source_type = "youtube";

        const id = extractVideoId(input);

        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;

            const t = await yt.fetchTranscript(id);

            text = t.map(x => x.text).join(" ");
        } catch {
            text = `
[METADATA ONLY MODE]
VIDEO_ID: ${id}
            `.trim();
        }
    }

    // =========================
    // SIGNAL LEVEL
    // =========================

    function detectSignalLevel(t, type) {
        if (!t || t.length < 60) return 0;
        if (type === "youtube" && t.includes("METADATA ONLY")) return 1;
        if (t.length < 300) return 2;
        return 3;
    }

    const signal_level = detectSignalLevel(text, source_type);

    // =========================
    // HARD GATE (CRITICAL FIX)
    // =========================

    if (signal_level === 1) {
        return res.status(200).json({
            noise_score: null,
            confidence: 0,
            signal_level: 1,
            emotional_triggers: [],
            logic_breakdown: {
                summary: "Metadata-only input. Model skipped.",
                key_observations: [
                    "No transcript available",
                    "No linguistic body present"
                ],
                framing_notes: [
                    "Execution halted at signal gate"
                ]
            },
            source_type,
            node: provider.name
        });
    }

    // =========================
    // CONTINUE MODEL CALL ONLY IF SIGNAL IS VALID
    // =========================

    // (rest of GROQ call goes here)
}
        const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    const SYSTEM_PROMPT = `
You are a STRICT linguistic feature extractor.

RULES:
- Use ONLY provided text.
- Do NOT infer meaning or topic.
- Do NOT guess context.
- Only analyze explicit language features.

Return ONLY JSON:

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

    function safeParse(c) {
        if (!c) return null;
        try {
            const cleaned = c.replace(/```json/g, "").replace(/```/g, "");
            const s = cleaned.indexOf("{");
            const e = cleaned.lastIndexOf("}");
            if (s === -1 || e === -1) return null;
            return JSON.parse(cleaned.slice(s, e + 1));
        } catch {
            return null;
        }
    }

    function clean(arr = []) {
        return [...new Set(arr)]
            .map(x => x.toLowerCase().trim())
            .filter(x => x.length > 2);
    }

    // =========================
    // MODEL CALL
    // =========================

    try {
        const r = await fetch(provider.url, {
            method: "POST",
            headers: provider.headers,
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: text }
                ]
            })
        });

        const raw = await r.text();

        if (!r.ok) {
            return res.status(500).json({
                error: "Model request failed",
                details: raw?.slice(0, 400)
            });
        }

        const api = JSON.parse(raw);
        const content = api?.choices?.[0]?.message?.content;

        const parsed = safeParse(content);

        if (!parsed) {
            return res.status(500).json({
                error: "Invalid model output"
            });
        }

        return res.status(200).json({
            noise_score:
                signal_level === 1 ? null : parsed.noise_score ?? 0,

            confidence:
                signal_level === 1 ? 0 : parsed.confidence ?? 0,

            signal_level,

            emotional_triggers: clean(parsed.emotional_triggers),

            logic_breakdown: {
                summary:
                    signal_level === 1
                        ? "Insufficient signal (metadata-only input)."
                        : parsed.logic_breakdown?.summary,

                key_observations:
                    signal_level === 1
                        ? ["No transcript or linguistic body available"]
                        : parsed.logic_breakdown?.key_observations || [],

                framing_notes:
                    signal_level === 1
                        ? ["Scoring disabled due to low signal"]
                        : parsed.logic_breakdown?.framing_notes || []
            },

            source_type,
            node: provider.name
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
