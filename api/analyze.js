export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Invalid input" });
    }

    const SCHEMA = `
You are a linguistic pattern analysis engine.

CRITICAL RULES:
- Do NOT interpret subject matter
- Do NOT infer real-world events
- Do NOT summarize news meaning
- ONLY analyze language mechanics

Focus ONLY on:
- emotional framing words
- authority signaling language
- certainty vs ambiguity
- fear/urgency construction
- passive voice usage
- moral framing
- attribution patterns

Return ONLY valid JSON:

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

    function safeArray(v) {
        return Array.isArray(v) ? v : [];
    }

    function normalize(data) {
        return {
            noise_score: Number(data?.noise_score ?? 0),

            emotional_triggers: safeArray(data?.emotional_triggers),

            logic_breakdown: {
                summary: data?.logic_breakdown?.summary ?? "No summary available.",

                key_observations: safeArray(data?.logic_breakdown?.key_observations),

                framing_notes: safeArray(data?.logic_breakdown?.framing_notes)
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

        const raw = await response.text();

        if (!response.ok) {
            return res.status(500).json(fallback(raw));
        }

        const api = JSON.parse(raw);
        const content = api?.choices?.[0]?.message?.content;

        const parsed = extractJSON(content);

        if (!parsed) {
            return res.status(200).json(fallback("invalid model output"));
        }

        return res.status(200).json(normalize(parsed));

    } catch (err) {
        return res.status(500).json(fallback(err.message));
    }
}
