export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string"
            ? body.input.trim()
            : typeof body.text === "string"
            ? body.text.trim()
            : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // =====================================================
    // PROVIDER (MUST EXIST BEFORE USAGE)
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
    // TYPE DETECTION
    // =====================================================
    function detectType(str) {
        try {
            const url = new URL(str);

            if (url.hostname.includes("youtu.be") || url.hostname.includes("youtube.com"))
                return "youtube";

            if (url.hostname.includes("tiktok.com"))
                return "tiktok";

            if (url.hostname.includes("x.com") || url.hostname.includes("twitter.com"))
                return "tweet";

            return "url";
        } catch {
            return "text";
        }
    }

    const type = detectType(input);

    // =====================================================
    // YOUTUBE HELPERS
    // =====================================================
    function extractYouTubeId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    async function tryTranscript(videoId) {
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
    // URL SCRAPER (SAFE FALLBACK)
    // =====================================================
    async function fetchUrlPreview(url) {
        try {
            const r = await fetch(url, { redirect: "follow" });
            const html = await r.text();

            return html
                .replace(/<script[^>]*>.*?<\/script>/gis, "")
                .replace(/<style[^>]*>.*?<\/style>/gis, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .slice(0, 8000);
        } catch {
            return null;
        }
    }

    // =====================================================
    // INGESTION PIPELINE
    // =====================================================
    let text = input;
    let source_type = type;

    if (type === "youtube") {
        const videoId = extractYouTubeId(input);
        const transcript = videoId ? await tryTranscript(videoId) : null;

        if (transcript) {
            text = transcript;
        } else {
            text = `
[YOUTUBE METADATA MODE]
Video ID: ${videoId || "unknown"}

Transcript unavailable.
Analyze only available metadata-level inference.
            `.trim();
        }
    }

    if (type === "url" || type === "tweet" || type === "tiktok") {
        const preview = await fetchUrlPreview(input);

        if (preview) {
            text = preview;
        } else {
            text = `[UNREACHABLE SOURCE] ${input}`;
        }
    }

    // =====================================================
    // SIGNAL SCORING
    // =====================================================
    function signalLevel(t) {
        if (!t) return 0;
        if (t.includes("METADATA MODE")) return 2;
        if (t.length < 300) return 2;
        if (t.length < 1200) return 3;
        return 4;
    }

    const signal_level = signalLevel(text);

    // =====================================================
    // SYSTEM PROMPT
    // =====================================================
    const SYSTEM_PROMPT = `
You are a universal linguistic analysis engine.

Analyze only the provided input.

Do NOT assume missing content.

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
`.trim();

    // =====================================================
    // SAFE PARSER
    // =====================================================
    function safeParse(content) {
        if (!content) return null;

        try {
            const cleaned = content.replace(/```json/g, "").replace(/```/g, "");
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");

            if (start === -1 || end === -1) return null;

            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    function clean(arr = []) {
        return [...new Set(arr)]
            .map(x => String(x).toLowerCase().trim())
            .filter(Boolean);
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
                details: raw.slice(0, 500)
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
            noise_score: parsed.noise_score ?? 0,
            confidence: parsed.confidence ?? 0,
            signal_level,
            source_type,
            emotional_triggers: clean(parsed.emotional_triggers),
            logic_breakdown: {
                summary: parsed.logic_breakdown?.summary || "",
                key_observations: parsed.logic_breakdown?.key_observations || [],
                framing_notes: parsed.logic_breakdown?.framing_notes || []
            },
            node: provider.name
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
