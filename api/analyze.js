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
Analyze the supplied text for:

- Persuasive language
- Emotional framing
- Narrative shaping
- Loaded language
- Fear appeals
- Authority appeals
- Social pressure cues
- Selective framing

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

    const providers = [
        {
            name: "GROQ",
            url: "https://api.groq.com/openai/v1/chat/completions",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            model: "llama-3.3-70b-versatile"
        }
    ];

    function extractJSON(raw) {

        if (!raw) return null;

        let cleaned = raw
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");

        if (first === -1 || last === -1) {
            return null;
        }

        cleaned = cleaned.slice(first, last + 1);

        try {
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    function fallback(reason) {

        return {
            noise_score: 0,

            emotional_triggers: [],

            logic_breakdown: {
                summary: `Analysis unavailable (${reason})`,
                key_observations: [],
                framing_notes: []
            }
        };
    }

    function normalize(data) {

        if (!data) {
            return fallback("No structured response");
        }

        return {

            noise_score:
                Number(data.noise_score ?? 0),

            emotional_triggers:
                Array.isArray(data.emotional_triggers)
                    ? data.emotional_triggers
                    : [],

            logic_breakdown: {

                summary:
                    data?.logic_breakdown?.summary ||
                    "Analysis completed.",

                key_observations:
                    Array.isArray(
                        data?.logic_breakdown?.key_observations
                    )
                        ? data.logic_breakdown.key_observations
                        : [],

                framing_notes:
                    Array.isArray(
                        data?.logic_breakdown?.framing_notes
                    )
                        ? data.logic_breakdown.framing_notes
                        : []
            }
        };
    }

    for (const p of providers) {

        try {

            const response = await fetch(
                p.url,
                {
                    method: "POST",

                    headers: p.headers,

                    body: JSON.stringify({
                        model: p.model,

                        temperature: 0.2,

                        response_format: {
                            type: "json_object"
                        },

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
                }
            );

            if (!response.ok) {

                const err =
                    await response.text();

                console.error(
                    `${p.name} HTTP ${response.status}`,
                    err
                );

                continue;
            }

            const apiResponse =
                await response.json();

            const content =
                apiResponse?.choices?.[0]
                    ?.message?.content;

            if (!content) {

                console.error(
                    `${p.name} returned no content`
                );

                continue;
            }

            const parsed =
                extractJSON(content);

            if (!parsed) {

                console.error(
                    `${p.name} returned invalid JSON`,
                    content
                );

                continue;
            }

            const result =
                normalize(parsed);

            return res.status(200).json({
                ...result,
                node: p.name
            });

        } catch (err) {

            console.error(
                `${p.name} exception`,
                err
            );
        }
    }

    return res.status(500).json({
        error: "All analysis nodes failed"
    });
}
