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

    // =====================================================
    // DETECTION
    // =====================================================

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

    // =====================================================
    // LAYER 1 — youtube-transcript
    // =====================================================
    async function layer1(videoId) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;

            const t = await yt.fetchTranscript(videoId);

            return t.map(x => x.text).join(" ").replace(/\s+/g, " ").trim();
        } catch {
            return null;
        }
    }

    // =====================================================
    // LAYER 2 — youtubei.js captions
    // =====================================================
    async function layer2(videoId) {
        try {
            const { Innertube } = await import("youtubei.js");

            const yt = await Innertube.create();
            const info = await yt.getInfo(videoId);
            const captions = await info.getTranscript();

            const segments =
                captions?.transcript?.content?.body?.initial_segments;

            if (!segments) return null;

            return segments
                .map(s => s.snippet?.text || "")
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

        } catch {
            return null;
        }
    }

    // =====================================================
    // LAYER 3 — metadata fallback (NO INFERENCE ALLOWED)
    // =====================================================
    async function layer3(videoUrl, videoId) {
        try {
            const res = await fetch(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
            );

            const data = await res.json();

            return `
[METADATA ONLY — NO INTERPRETATION]

TITLE: ${data?.title || "unknown"}
CHANNEL: ${data?.author_name || "unknown"}
VIDEO_ID: ${videoId}

RULE: Do not infer topic, meaning, or intent.
Treat all fields as raw strings only.
            `.trim();

        } catch {
            return `
[MINIMAL SIGNAL]

VIDEO_ID: ${videoId}
RULE: No metadata available. No inference allowed.
            `.trim();
        }
    }

    // =====================================================
    // INGESTION PIPELINE
    // =====================================================

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

    // =====================================================
    // GROQ CONFIG
    // =====================================================

    const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    // =====================================================
    // STRICT SYSTEM PROMPT (NO HALLUCINATION MODE)
    // =====================================================

    const SYSTEM_PROMPT = `
You are a STRICT linguistic feature extractor.

RULES:
- Use ONLY provided text.
- Do NOT infer meaning, topic, intent, or context.
- Do NOT interpret titles, metadata, or sparse signals.
- Do NOT guess what content is "about".
- Only analyze observable language patterns.

FOCUS ONLY ON:
- lexical choice
- repetition patterns
- emotional words explicitly present
- sentence structure
- modality (commands/questions/assertions)

If signal is insufficient:
- explicitly state low signal in summary

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

    // =====================================================
    // SAFE PARSER
    // =====================================================

    function safeParse(content) {
        if (!content) return null;

        try {
            const cleaned = content
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");

            if (start === -1 || end === -1) return null;

            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    // =====================================================
    // FILTER TRIGGERS
    // =====================================================

    function clean(arr = []) {
        return [...new Set(arr)]
            .map(x => x.toLowerCase().trim())
            .filter(x => x.length > 2);
    }

    // =====================================================
    // MODEL CALL
    // =====================================================

    try {
        const response = await fetch(provider.url, {
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

        const raw = await response.text();

        if (!response.ok) {
            return res.status(500).json({
                error: "Model request failed",
                details: raw?.slice(0, 500)
            });
        }

        let api;
        try {
            api = JSON.parse(raw);
        } catch {
            return res.status(500).json({
                error: "Invalid provider response",
                details: raw?.slice(0, 500)
            });
        }

        const content = api?.choices?.[0]?.message?.content;
        const parsed = safeParse(content);

        if (!parsed) {
            return res.status(500).json({
                error: "Invalid model output",
                raw: content
            });
        }

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence: parsed.confidence ?? 0,
            emotional_triggers: clean(parsed.emotional_triggers),
            logic_breakdown: parsed.logic_breakdown ?? {
                summary: "Analysis complete.",
                key_observations: [],
                framing_notes: []
            },
            source_type,
            node: provider.name
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
