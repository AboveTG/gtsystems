export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string"
            ? body.input.trim()
            : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // -----------------------------
    // PROVIDER (MUST BE FIRST)
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

    // -----------------------------
    // HELPERS
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
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    // -----------------------------
    // YOUTUBE TRANSCRIPT (SAFE)
    // -----------------------------
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

    let text = input;
    let source_type = "text";
    let videoId = null;

    // YouTube ingestion
    if (isYouTubeUrl(input)) {
        source_type = "youtube";
        videoId = extractVideoId(input);

        let transcript = null;

        if (videoId) {
            transcript = await fetchTranscript(videoId);
        }

        // HARD FIX: NEVER fall back to "metadata only mode"
        // Instead we preserve URL context as analyzable text
        text =
            transcript ||
            `YouTube video reference:
Video ID: ${videoId}
URL: ${input}

No transcript available. Analyze metadata + structure only.`;
    }

    // Safety guard
    if (!text || text.length < 5) {
        return res.status(200).json({
            noise_score: 0,
            confidence: 0,
            source_type,
            emotional_triggers: [],
            logic_breakdown: {
                summary: "Insufficient input signal.",
                key_observations: [],
                framing_notes: []
            },
            node: provider.name
        });
    }

    const SYSTEM_PROMPT = `
You are a linguistic feature extractor.

Analyze ONLY explicit language.

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
                error: "Invalid model output",
                raw: content
            });
        }

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence: parsed.confidence ?? 0,
            source_type,
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
