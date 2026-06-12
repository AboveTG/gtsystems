export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Invalid input" });
    }

    const SCHEMA = `
You are a language analysis engine.

Return ONLY valid JSON.

Required schema:
{
  "noise_score": number,
  "emotional_triggers": string[],
  "logic_breakdown": {
    "summary": string,
    "key_observations": string[],
    "framing_notes": string[]
  }
}

Rules:
- Always include ALL fields
- Never omit nested objects
- Never return markdown
- Output must be strict JSON only
`;

    const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    function extractJSON(raw) {
        if (!raw) return null;

        let cleaned = raw
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

    function normalize(data) {

        const safe = (d) => Array.isArray(d) ? d : [];

        return {
            noise_score: Number(data?.noise_score ?? 0),

            emotional_triggers: safe(data?.emotional_triggers),

            logic_breakdown: {
                summary:
                    data?.logic_breakdown?.summary ??
                    "No summary generated.",

                key_observations:
                    safe(data?.logic_breakdown?.key_observations),

                framing_notes:
                    safe(data?.logic_breakdown?.framing_notes)
            },

            node: provider.name
        };
    }

    function fallback(reason) {
        return {
            noise_score: 0,
            emotional_triggers: [],
            logic_breakdown: {
                summary: `Analysis failed: ${reason}`,
                key_observations: [],
                framing_notes: []
            },
            node: provider.name
        };
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
                    { role: "system", content: SCHEMA },
                    { role: "user", content: text }
                ]
            })
        });

        const rawText = await response.text();

        if (!response.ok) {
            return res.status(500).json(fallback(rawText));
        }

        const apiResponse = JSON.parse(rawText);
        const content = apiResponse?.choices?.[0]?.message?.content;

        const parsed = extractJSON(content);

        if (!parsed) {
            return res.status(200).json(fallback("invalid JSON from model"));
        }

        return res.status(200).json(normalize(parsed));

    } catch (err) {
        return res.status(500).json(fallback(err.message));
    }
}
