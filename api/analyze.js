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
    // HELPERS
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

    async function fetchTranscript(videoId) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;

            const transcript = await yt.fetchTranscript(videoId);

            return transcript
                .map(t => t.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
        } catch {
            return null;
        }
    }

    // =========================
    // INGESTION
    // =========================
    let text = input;
    let source_type = "text";
    let signal_level = 3;

    if (isYouTubeUrl(input)) {
        source_type = "youtube";

        const videoId = extractVideoId(input);

        let transcript = null;

        if (videoId) {
            transcript = await fetchTranscript(videoId);
        }

        if (transcript) {
            text = transcript;
        } else {
            signal_level = 1;

            return res.status(200).json({
                noise_score: null,
                confidence: 0,
                signal_level: 1,
                source_type,
                emotional_triggers: [],
                logic_breakdown: {
                    summary: "Metadata-only input. Transcript unavailable.",
                    key_observations: [
                        "YouTube URL detected",
                        "Transcript blocked or disabled",
                        "No linguistic content available"
                    ],
                    framing_notes: [
                        "Model execution skipped due to insufficient signal"
                    ]
                },
                node: provider.name
            });
        }
    }

    // =========================
    // PROMPT
    // =========================
    const SYSTEM_PROMPT = `
You are a strict linguistic feature extractor.

Analyze ONLY explicit text.

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
        return [...new Set(arr.map(x => String(x).toLowerCase().trim()))];
    }

    // =========================
    // MODEL CALL
    // =========================
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
