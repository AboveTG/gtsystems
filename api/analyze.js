export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const input =
        typeof body.input === "string" ? body.input.trim()
        : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // =====================================================
    // PROVIDER
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
    // TYPE DETECTOR
    // =====================================================

    function detectType(str) {
        try {
            const u = new URL(str);

            if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) return "youtube";
            if (u.hostname.includes("tiktok.com")) return "tiktok";
            if (u.hostname.includes("x.com") || u.hostname.includes("twitter.com")) return "tweet";
            if (u.pathname.endsWith(".pdf")) return "pdf";
            return "url";
        } catch {
            return "text";
        }
    }

    const type = detectType(input);

    // =====================================================
    // YOUTUBE LAYER STACK (CRITICAL FIX)
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

    async function getTranscript(id) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;
            const t = await yt.fetchTranscript(id);
            return t.map(x => x.text).join(" ").trim();
        } catch {
            return null;
        }
    }

    async function getYoutubeMetadata(videoId) {
        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const r = await fetch(url);
            const html = await r.text();

            const title = (html.match(/<title>(.*?)<\/title>/)?.[1] || "").replace(" - YouTube", "");

            return {
                title,
                raw: html.slice(0, 5000)
            };
        } catch {
            return null;
        }
    }

    // =====================================================
    // WEB LAYER
    // =====================================================

    async function fetchWeb(url) {
        try {
            const r = await fetch(url);
            const html = await r.text();

            return html
                .replace(/<script[\s\S]*?<\/script>/g, "")
                .replace(/<style[\s\S]*?<\/style>/g, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .slice(0, 12000);
        } catch {
            return null;
        }
    }

    // =====================================================
    // INGESTION GRAPH ENGINE
    // =====================================================

    let layers = [];
    let signals = [];

    let text = input;
    let source_type = type;

    if (type === "youtube") {

        const id = extractYouTubeId(input);

        const [transcript, meta] = await Promise.all([
            id ? getTranscript(id) : null,
            id ? getYoutubeMetadata(id) : null
        ]);

        layers.push({
            layer: "youtube_transcript",
            status: transcript ? "hit" : "miss"
        });

        layers.push({
            layer: "youtube_metadata",
            status: meta ? "hit" : "miss"
        });

        // IMPORTANT FIX:
        // metadata is now ALWAYS used even if transcript fails
        text = [
            meta?.title || "",
            transcript || "",
            meta?.raw || ""
        ].join(" ").trim();
    }

    if (type === "url" || type === "tweet" || type === "tiktok") {
        const web = await fetchWeb(input);

        layers.push({
            layer: "web_scrape",
            status: web ? "hit" : "miss"
        });

        text = web || `[unreachable:${input}]`;
    }

    // =====================================================
    // SIGNAL ENGINE (FIXED LOGIC)
    // =====================================================

    function computeSignal(t) {
        if (!t || t.length < 50) return 0;
        if (t.includes("unreachable")) return 1;
        if (t.length < 400) return 2;
        return 3;
    }

    const signal_level = computeSignal(text);

    // =====================================================
    // HARD STOP ONLY FOR TRUE FAILURE
    // =====================================================

    if (signal_level === 1) {
        return res.status(200).json({
            noise_score: null,
            confidence: 0,
            signal_level,
            source_type,
            layers,
            emotional_triggers: [],
            logic_breakdown: {
                summary: "Source unreachable or empty.",
                key_observations: ["No usable content extracted"],
                framing_notes: ["Execution halted at ingestion layer"]
            },
            node: provider.name
        });
    }

    // =====================================================
    // GROQ PROMPT
    // =====================================================

    const SYSTEM_PROMPT = `
You are a multi-source fusion analysis engine.

You must:
- rely only on provided text
- detect persuasion, framing, emotion, structure
- never hallucinate missing context

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

    function safeParse(content) {
        try {
            const cleaned = content.replace(/```json/g, "").replace(/```/g, "");
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");
            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    // =====================================================
    // MODEL EXECUTION
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
                error: "Model error",
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

        // =================================================
        // REAL CONFIDENCE FUSION (FIXED)
        // =================================================

        const evidenceWeight =
            layers.filter(l => l.status === "hit").length +
            (signal_level / 3);

        const confidence =
            Math.min(1, (parsed.confidence || 0.4) * (evidenceWeight / 2));

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence,
            signal_level,
            layers,
            emotional_triggers: parsed.emotional_triggers || [],
            logic_breakdown: parsed.logic_breakdown || {
                summary: "",
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
