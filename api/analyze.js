export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string"
            ? body.input.trim()
            : "";

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // -----------------------------
    // INPUT TYPE DETECTION
    // -----------------------------
    const isUrl = (str) => {
        try {
            const u = new URL(str);
            return u.protocol.startsWith("http");
        } catch {
            return false;
        }
    };

    let text = input;
    let source_type = "text";

    // -----------------------------
    // YOUTUBE TRANSCRIPT (SAFE IMPORT)
    // -----------------------------
    const extractVideoId = (url) => {
        const u = new URL(url);
        if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
        return u.searchParams.get("v");
    };

    async function fetchTranscript(url) {
        const { YoutubeTranscript } = await import("youtube-transcript");

        const videoId = extractVideoId(url);
        if (!videoId) throw new Error("Invalid YouTube URL");

        const transcript = await YoutubeTranscript.fetchTranscript(videoId);

        return transcript.map(t => t.text).join(" ").replace(/\s+/g, " ").trim();
    }

    if (isUrl(input)) {
        try {
            source_type = "url";

            // only attempt transcript if youtube
            if (input.includes("youtube") || input.includes("youtu.be")) {
                text = await fetchTranscript(input);
                source_type = "youtube";
            }
        } catch (e) {
            return res.status(200).json({
                noise_score: 0,
                confidence: 0,
                emotional_triggers: [],
                logic_breakdown: {
                    summary: "Transcript unavailable.",
                    key_observations: ["Video detected", "Transcript failed"],
                    framing_notes: [e.message]
                },
                source_type,
                node: "TRANSCRIPT_FAIL"
            });
        }
    }

    // -----------------------------
    // GROQ CONFIG
    // -----------------------------
    const provider = {
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

    // -----------------------------
    // CALL MODEL (SINGLE CLEAN PATH)
    // -----------------------------
    let response;
    try {
        response = await fetch(provider.url, {
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
    } catch (e) {
        return res.status(500).json({
            error: "Network failure",
            details: e.message
        });
    }

    const raw = await response.text();

    if (!response.ok) {
        return res.status(500).json({
            error: "Model error",
            details: raw.slice(0, 500)
        });
    }

    let api;
    try {
        api = JSON.parse(raw);
    } catch {
        return res.status(500).json({
            error: "Invalid JSON from model",
            raw: raw.slice(0, 500)
        });
    }

    const content = api?.choices?.[0]?.message?.content;

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        return res.status(500).json({
            error: "Model returned invalid structured JSON",
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
        node: "GROQ"
    });
}
