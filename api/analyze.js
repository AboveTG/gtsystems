export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
        return res.status(400).json({
            error: "Invalid input"
        });
    }

    const SCHEMA = `
Return ONLY valid JSON with EXACT keys:

{
  "persuasion_level": number (0-100),
  "emotional_triggers": array of strings,
  "persuasion_techniques": array of strings,
  "logic_breakdown": string
}

Rules:
- Do NOT add extra keys
- Do NOT rename keys
- Do NOT wrap in markdown
- Do NOT include commentary
- If unsure, return empty arrays and "No analysis available"
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

    function safeParse(content) {
        try {
            const cleaned = content
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            return JSON.parse(cleaned);
        } catch (e) {
            return null;
        }
    }

    function normalize(data) {
        return {
            persuasion_level:
                Number(data?.persuasion_level ?? 0),

            emotional_triggers:
                Array.isArray(data?.emotional_triggers)
                    ? data.emotional_triggers
                    : [],

            persuasion_techniques:
                Array.isArray(data?.persuasion_techniques)
                    ? data.persuasion_techniques
                    : [],

            logic_breakdown:
                typeof data?.logic_breakdown === "string"
                    ? data.logic_breakdown
                    : "No structured breakdown returned."
        };
    }

    for (const provider of providers) {

        try {

            const response = await fetch(provider.url, {
                method: "POST",
                headers: provider.headers,
                body: JSON.stringify({
                    ...provider.body,
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

            if (!response.ok) {
                continue;
            }

            const data = await response.json();

            const content =
                data?.choices?.[0]?.message?.content;

            if (!content) {
                continue;
            }

            const parsed = safeParse(content);

            if (!parsed) {
                continue;
            }

            const result = normalize(parsed);

            result.node = provider.name;

            return res.status(200).json(result);

        } catch (err) {
            console.error(provider.name, err);
        }
    }

    return res.status(500).json({
        error: "All analysis nodes failed"
    });
}
