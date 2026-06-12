export default async function handler(req, res) {

```
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
```

Analyze the text for:

* Persuasive language
* Emotional framing
* Narrative shaping
* Fear appeals
* Authority appeals
* Social pressure cues
* Selective framing
* Loaded language

Return ONLY valid JSON.

{
"noise_score": 0,
"emotional_triggers": [
"trigger"
],
"logic_breakdown": {
"summary": "2-4 sentence analysis",
"key_observations": [
"observation 1",
"observation 2",
"observation 3"
],
"framing_notes": [
"framing note 1",
"framing note 2"
]
}
}

All fields are required.
Do not omit fields.
Do not return null values.
`;

````
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

function normalize(data) {

    return {

        noise_score:
            Number(data?.noise_score ?? 0),

        emotional_triggers:
            Array.isArray(data?.emotional_triggers)
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
                `${p.name} HTTP ERROR`,
                err
            );

            continue;
        }

        const apiResponse =
            await response.json();

        console.log(
            "FULL API RESPONSE:",
            JSON.stringify(apiResponse, null, 2)
        );

        const content =
            apiResponse?.choices?.[0]
                ?.message?.content;

        console.log(
            "MODEL CONTENT:",
            content
        );

        if (!content) {

            console.error(
                `${p.name} returned no content`
            );

            continue;
        }

        const parsed =
            extractJSON(content);

        console.log(
            "PARSED JSON:",
            JSON.stringify(parsed, null, 2)
        );

        if (!parsed) {

            console.error(
                `${p.name} returned invalid JSON`
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
````

}
