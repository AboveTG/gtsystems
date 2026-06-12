export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    let { text, url } = req.body || {};

    if (!text && !url) {
        return res.status(400).json({
            error: "No input provided"
        });
    }

    // -------------------------
    // YOUTUBE SUPPORT
    // -------------------------

    function extractVideoId(inputUrl) {

        try {

            const u = new URL(inputUrl);

            if (u.hostname.includes("youtu.be")) {
                return u.pathname.slice(1);
            }

            return u.searchParams.get("v");

        } catch {

            return null;
        }
    }

    async function fetchTranscript(videoUrl) {

        const { YoutubeTranscript } =
            await import("youtube-transcript");

        const videoId =
            extractVideoId(videoUrl);

        if (!videoId) {
            throw new Error("Invalid YouTube URL");
        }

        const transcript =
            await YoutubeTranscript.fetchTranscript(videoId);

        return transcript
            .map(x => x.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    if (url) {

        try {

            text = await fetchTranscript(url);

        } catch (err) {

            return res.status(500).json({
                error: "Transcript extraction failed",
                details: err.message
            });
        }
    }

    // -------------------------
    // CHUNKING
    // -------------------------

    function chunkText(str, size = 2500) {

        const chunks = [];

        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.slice(i, i + size));
        }

        return chunks;
    }

    const chunks = chunkText(text);

    // -------------------------
    // MODEL
    // -------------------------

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
You are a language framing analysis engine.

Analyze:

- persuasion tactics
- emotional language
- authority appeals
- fear appeals
- urgency construction
- loaded language
- attribution patterns
- narrative shaping

Return ONLY JSON.

{
  "noise_score": number,
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

        const cleaned = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start === -1 || end === -1) {
            return null;
        }

        try {

            return JSON.parse(
                cleaned.slice(start, end + 1)
            );

        } catch {

            return null;
        }
    }

    async function analyzeChunk(chunk) {

        const response = await fetch(
            provider.url,
            {
                method: "POST",

                headers: provider.headers,

                body: JSON.stringify({
                    model: provider.model,
                    temperature: 0.2,

                    response_format: {
                        type: "json_object"
                    },

                    messages: [
                        {
                            role: "system",
                            content: SYSTEM_PROMPT
                        },
                        {
                            role: "user",
                            content: chunk
                        }
                    ]
                })
            }
        );

        if (!response.ok) {

            const err =
                await response.text();

            console.error(err);

            return null;
        }

        const data =
            await response.json();

        const content =
            data?.choices?.[0]?.message?.content;

        return safeParse(content);
    }

    const results = [];

    for (const chunk of chunks) {

        const result =
            await analyzeChunk(chunk);

        if (result) {
            results.push(result);
        }
    }

    if (!results.length) {

        return res.status(500).json({
            error: "No valid analysis returned"
        });
    }

    const scores =
        results.map(r => Number(r.noise_score || 0));

    const triggers =
        results.flatMap(
            r => r.emotional_triggers || []
        );

    const observations =
        results.flatMap(
            r => r.logic_breakdown?.key_observations || []
        );

    const framing =
        results.flatMap(
            r => r.logic_breakdown?.framing_notes || []
        );

    const summary =
        results[0]?.logic_breakdown?.summary ||
        "Analysis complete.";

    return res.status(200).json({

        noise_score:
            Number(
                (
                    scores.reduce((a,b)=>a+b,0) /
                    scores.length
                ).toFixed(2)
            ),

        emotional_triggers:
            [...new Set(triggers)],

        logic_breakdown: {

            summary,

            key_observations:
                [...new Set(observations)],

            framing_notes:
                [...new Set(framing)]
        },

        node: provider.name
    });
}
