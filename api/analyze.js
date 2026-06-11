export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Invalid input" });
    }

    const SCHEMA = `
Return ONLY valid JSON.

DO NOT include markdown.
DO NOT include extra keys.

Schema:

{
  "noise_score": number (0-100),
  "emotional_triggers": string[],
  "logic_breakdown": {
    "summary": string,
    "key_observations": string[],
    "framing_notes": string[]
  }
}

Rules:
- Focus on language framing, not truth judgment
- Identify persuasion techniques in wording only
- Keep observations grounded in the text
`;

    const providers = [
        {
            name: "GROQ",
            url: "https://api.groq.com/openai/v1/chat/completions",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: {
                model: "llama-3.3-70b-versatile"
            }
        },
        {
            name: "OPENROUTER",
            url: "https://openrouter.ai/api/v1/chat/completions",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: {
                model: "meta-llama/llama-3-8b-instruct:free"
            }
        }
    ];

    function cleanJSON(content) {
        return content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
    }

    function safeParse(content) {
        try {
            return JSON.parse(cleanJSON(content));
        } catch {
            return null;
        }
    }

    function normalize(data) {
        return {
            noise_score: Number(data?.noise_score ?? 0),

            emotional_triggers: Array.isArray(data?.emotional_triggers)
                ? data.emotional_triggers
                : [],

            logic_breakdown: {
                summary: data?.logic_breakdown?.summary || "No summary available",

                key_observations: Array.isArray(data?.logic_breakdown?.key_observations)
                    ? data.logic_breakdown.key_observations
                    : [],

                framing_notes: Array.isArray(data?.logic_breakdown?.framing_notes)
                    ? data.logic_breakdown.framing_notes
                    : []
            }
        };
    }

    for (const p of providers) {

        try {

            const response = await fetch(p.url, {
                method: "POST",
                headers: p.headers,
                body: JSON.stringify({
                    ...p.body,
                    messages: [
                        {
                            role: "system",
                            content: SCHEMA
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ]
                })
            });

            if (!response.ok) continue;

            const data = await response.json();

            const content =
                data?.choices?.[0]?.message?.content;

            if (!content) continue;

            const parsed = safeParse(content);

            if (!parsed) continue;

            const result = normalize(parsed);

            result.node = p.name;

            return res.status(200).json(result);

        } catch (err) {
            console.error(p.name, err);
        }
    }

    return res.status(500).json({
        error: "All analysis nodes failed"
    });
}
