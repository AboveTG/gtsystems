export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const { text } = req.body;

    try {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 20000);

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: `
Analyze the provided text.

Return ONLY valid JSON.

{
  "noise_score": 0,
  "emotional_triggers": [],
  "logic_breakdown": ""
}

Evaluate:
- Emotional manipulation
- Fear appeals
- Authority appeals
- Loaded language
- Missing context
- Unsupported claims

Remain objective.
`
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    response_format: {
                        type: "json_object"
                    }
                })
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Groq Error ${response.status}`);
        }

        const data = await response.json();

        const content =
            data.choices?.[0]?.message?.content;

        const cleanContent = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const result = JSON.parse(cleanContent);

        return res.status(200).json(result);

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Groq node failed"
        });
    }
}
