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
    async function layer1_transcript(videoId) {
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
    // LAYER 2 — youtubei.js captions (robust fallback)
    // =====================================================
    async function layer2_youtubei(videoId) {
        try {
            const { Innertube } = await import("youtubei.js");

            const yt = await Innertube.create();

            const info = await yt.getInfo(videoId);
            const captions = await info.getTranscript();

            if (!captions?.transcript?.content?.body?.initial_segments) {
                return null;
            }

            return captions.transcript.content.body.initial_segments
                .map(s => s.snippet?.text || "")
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
        } catch {
            return null;
        }
    }

    // =====================================================
    // LAYER 3 — GUARANTEED METADATA FALLBACK
    // =====================================================
    async function layer3_metadata(videoUrl, videoId) {
        try {
            const oembedUrl =
                `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

            const res = await fetch(oembedUrl);
            const data = await res.json();

            const title = data?.title || "";
            const author = data?.author_name || "";

            return `
YouTube Video Metadata Fallback:
Title: ${title}
Channel: ${author}
Video ID: ${videoId}

Note: Transcript unavailable. Analysis based on metadata only.
            `.trim();
        } catch {
            return `
YouTube Video:
Video ID: ${videoId}
Note: Full extraction failed; operating on minimal signal.
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

        const videoId = extractVideoId(input);

        let extracted =
            await layer1_transcript(videoId) ||
            await layer2_youtubei(videoId) ||
            await layer3_metadata(input, videoId);

        text = extracted;
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

    const SYSTEM_PROMPT = `
You are a linguistic analysis engine.

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
                error: "Model returned invalid JSON",
                raw: content
            });
        }

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence: parsed.confidence ?? 0,
            emotional_triggers: parsed.emotional_triggers ?? [],
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
