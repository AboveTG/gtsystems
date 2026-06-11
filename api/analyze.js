export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const { text } = req.body;

    const prompt = `
Analyze the provided text.

Return ONLY valid JSON.

{
  "noise_score": 0,
  "emotional_triggers": [],
  "logic_breakdown": ""
}

Evaluate:

- Emotional language
- Fear appeals
- Authority appeals
- Loaded terminology
- Missing context
- Unsupported claims

Remain objective.
`;

    const providers = [

        {
            name: 'GROQ',

            url:
                'https://api.groq.com/openai/v1/chat/completions',

            headers: {
                Authorization:
                    `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type':
                    'application/json'
            },

            body: {
                model:
                    'llama-3.3-70b-versatile'
            }
        },

        {
            name: 'OPENROUTER',

            url:
                'https://openrouter.ai/api/v1/chat/completions',

            headers: {
                Authorization:
                    `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type':
                    'application/json'
            },

            body: {
                model:
                    'meta-llama/llama-3-8b-instruct:free'
            }
        }
    ];

    for (const provider of providers) {

        try {

            const response =
                await fetch(
                    provider.url,
                    {
                        method: 'POST',

                        headers:
                            provider.headers,

                        body: JSON.stringify({
                            ...provider.body,

                            messages: [
                                {
                                    role: 'system',
                                    content: prompt
                                },
                                {
                                    role: 'user',
                                    content: text
                                }
                            ]
                        })
                    }
                );

            if (!response.ok) {
                continue;
            }

            const data =
                await response.json();

            const content =
                data.choices?.[0]
                    ?.message?.content;

            if (!content) {
                continue;
            }

            const result =
                JSON.parse(
                    content
                        .replace(
                            /```json/g,
                            ''
                        )
                        .replace(
                            /```/g,
                            ''
                        )
                        .trim()
                );

            result.node =
                provider.name;

            return res
                .status(200)
                .json(result);

        } catch (err) {

            console.error(
                provider.name,
                err
            );
        }
    }

    return res.status(500).json({
        error:
            'All GroundTruth nodes unavailable'
    });
}
