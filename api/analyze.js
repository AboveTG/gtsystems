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

    // -----------------------------
    // Detect YouTube URL
    // -----------------------------
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
            if (u.hostname.includes("youtu.be")) {
                return u.pathname.slice(1);
            }
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    // -----------------------------
    // Transcript extraction (SAFE)
    // -----------------------------
    async function fetchTranscript(videoUrl) {
        try {
            const mod = await import("youtube-transcript");
            const YoutubeTranscript = mod.YoutubeTranscript;

            const videoId = extractVideoId(videoUrl);
            if (!videoId) throw new Error("Invalid YouTube URL");

            const transcript = await YoutubeTranscript.fetchTranscript(videoId);

            return transcript
                .map(t => t.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

        } catch {
            // HARD FALLBACK (critical fix)
            return null;
        }
    }

    let text = input;
    let source_type = "text";

    if (isYouTubeUrl(input)) {
        source_type = "youtube";

        const transcript = await fetchTranscript(input);

        if (!transcript) {
            return res.status(200).json({
                noise_score: 0,
                confidence: 0,
                emotional_triggers: [],
                logic_breakdown: {
                    summary: "Transcript unavailable (disabled or blocked).",
                    key_observations: [
                        "YouTube URL detected",
                        "Transcript extraction failed",
                        "Fallback analysis only"
                    ],
                    framing_notes: [
                        "No transcript data available"
                    ]
                },
                source_type,
                node: "FALLBACK"
            });
        }

        text = transcript;
    }

    // -----------------------------
    // GROQ CONFIG
    // -----------------------------
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

    // -----------------------------
    // CALL MODEL
    // -----------------------------
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
