import { YoutubeTranscript } from "youtube-transcript";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    let { text, url } = req.body;

    if (!text && !url) {
        return res.status(400).json({ error: "No input provided" });
    }

    // -----------------------------
    // TRANSCRIPT EXTRACTION
    // -----------------------------

    function chunkText(text, size = 1200) {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.slice(i, i + size));
        }
        return chunks;
    }

    async function extractVideoId(inputUrl) {
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

        const videoId = await extractVideoId(videoUrl);

        if (!videoId) {
            throw new Error("Invalid YouTube URL");
        }

        const transcript = await YoutubeTranscript.fetchTranscript(videoId);

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

    const chunks = chunkText(text, 1200);

    // -----------------------------
    // MODEL CONFIG
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
Return ONLY JSON.

Analyze ONLY language structure.

Do NOT interpret meaning or events.

{
  "noise_score": number,
  "triggers": string[],
  "observations": string[]
}
`;

    // -----------------------------
    // SAFE PARSER
    // -----------------------------

    function safeParse(raw) {
        if (!raw) return null;

        const cleaned = raw
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start === -1 || end === -1) return null;

        try {
            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    // -----------------------------
    // CHUNK ANALYSIS
    // -----------------------------

    async function analyzeChunk(chunk) {

        const response = await fetch(provider.url, {
            method: "POST",
            headers: provider.headers,
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: chunk }
                ]
            })
        });

        const raw = await response.text();

        if (!response.ok) return null;

        const api = JSON.parse(raw);
        const content = api?.choices?.[0]?.message?.content;

        return safeParse(content);
    }

    // -----------------------------
    // AGGREGATION ENGINE
    // -----------------------------

    function aggregate(results) {

        const triggers = [];
        const observations = [];
        let scoreSum = 0;
        let count = 0;

        for (const r of results) {

            if (!r) continue;

            scoreSum += Number(r.noise_score || 0);
            count++;

            triggers.push(...(r.triggers || []));
            observations.push(...(r.observations || []));
        }

        return {
            noise_score: Math.round(scoreSum / Math.max(count, 1)),

            emotional_triggers: [...new Set(triggers)],

            logic_breakdown: {
                summary: "Multi-pass chunked linguistic analysis.",
                key_observations: [...new Set(observations)],
                framing_notes: [
                    "Derived from distributed chunk analysis",
                    "No single-pass inference used"
                ]
            }
        };
    }

    // -----------------------------
    // EXECUTION
    // -----------------------------

    try {

        const results = [];

        for (const chunk of chunks) {
            const r = await analyzeChunk(chunk);
            results.push(r);
        }

        const final = aggregate(results);

        return res.status(200).json({
            ...final,
            node: provider.name
        });

    } catch (err) {

        return res.status(500).json({
            error: "Processing failure",
            details: err.message
        });
    }
}
