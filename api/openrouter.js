export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const { text } = req.body;

    try {

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 20000);

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                signal: controller.signal,
                headers: {
                    Authorization:
                        `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model:
                        "meta-llama/llama-3-8b-instruct:free",
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

Remain objective.
`
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ]
                })
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(
                `OpenRouter Error ${response.status}`
            );
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
            error: "OpenRouter node failed"
        });
    }
}
