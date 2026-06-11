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

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `
Analyze the provided text.

Return ONLY valid JSON.

{
  "noise_score": 0,
  "emotional_triggers": [],
  "logic_breakdown": ""
}

TEXT:

${text}
`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Gemini Error ${response.status}`);
        }

        const data = await response.json();

        const content =
            data.candidates?.[0]?.content?.parts?.[0]?.text;

        const cleanContent = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const result = JSON.parse(cleanContent);

        return res.status(200).json(result);

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Gemini node failed"
        });
    }
}
