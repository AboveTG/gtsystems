export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    let { text } = req.body || {};

    if (!text) {
        return res.status(400).json({
            error: "No text provided"
        });
    }

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

Analyze ONLY language structure.

Do NOT determine truth.

Identify:
- persuasion techniques
- emotional language
- authority appeals
- urgency framing
- fear appeals
- selective framing
- attribution patterns
- narrative shaping

Return ONLY valid JSON.

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

        try {

            const cleaned = content
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");

            if (start === -1 || end === -1) {
                return null;
            }

            return JSON.parse(
                cleaned.slice(start, end + 1)
            );

        } catch {
            return null;
        }
    }

    try {

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
                            content: text
                        }
                    ]
                })
            }
        );

        if (!response.ok) {

            const err =
                await response.text();

            return res.status(500).json({
                error: err
            });
        }

        const api =
            await response.json();

        const content =
            api?.choices?.[0]
                ?.message?.content;

        const parsed =
            safeParse(content);

        if (!parsed) {

            return res.status(500).json({
                error: "Model returned invalid JSON",
                raw: content
            });
        }

        return res.status(200).json({
            noise_score:
                parsed.noise_score ?? 0,

            emotional_triggers:
                parsed.emotional_triggers || [],

            logic_breakdown:
                parsed.logic_breakdown || {
                    summary:
                        "Analysis complete.",
                    key_observations: [],
                    framing_notes: []
                },

            node:
                provider.name
        });

    } catch (err) {

        return res.status(500).json({
            error: err.message
        });
    }
}
