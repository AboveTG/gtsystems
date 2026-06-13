export default async function handler(req, res) {

```
if (req.method !== "POST") {
    return res.status(405).json({
        error: "Method not allowed"
    });
}

const body = req.body || {};

const input =
    typeof body.input === "string"
        ? body.input.trim()
        : "";

if (!input) {
    return res.status(400).json({
        error: "No input provided"
    });
}

function isYouTubeUrl(str) {

    try {

        const url = new URL(str);

        return (
            url.hostname.includes("youtube.com") ||
            url.hostname.includes("youtu.be")
        );

    } catch {

        return false;
    }
}

function extractVideoId(url) {

    try {

        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.slice(1);
        }

        return u.searchParams.get("v");

    } catch {

        return null;
    }
}

async function fetchTranscript(videoUrl) {

    const mod =
        await import("youtube-transcript");

    const YoutubeTranscript =
        mod.YoutubeTranscript;

    const videoId =
        extractVideoId(videoUrl);

    if (!videoId) {
        throw new Error(
            "Invalid YouTube URL"
        );
    }

    const transcript =
        await YoutubeTranscript
            .fetchTranscript(videoId);

    return transcript
        .map(x => x.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

let text = input;

let sourceType =
    "article";

if (isYouTubeUrl(input)) {

    sourceType =
        "youtube";

    try {

        text =
            await fetchTranscript(input);

    } catch (err) {

        return res.status(200).json({

            noise_score: 0,

            confidence: 0,

            emotional_triggers: [],

            logic_breakdown: {

                summary:
                    "Transcript unavailable for this video.",

                key_observations: [
                    "Video detected",
                    "Transcript unavailable"
                ],

                framing_notes: [
                    err.message
                ]
            },

            source_type:
                sourceType,

            node:
                "TRANSCRIPT"
        });
    }
}

const provider = {

    name: "GROQ",

    url:
        "https://api.groq.com/openai/v1/chat/completions",

    headers: {

        Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`,

        "Content-Type":
            "application/json"
    },

    model:
        "llama-3.3-70b-versatile"
};

const SYSTEM_PROMPT = `
```

Analyze linguistic structure only.

Evaluate:

* persuasion techniques
* emotional language
* authority appeals
* fear appeals
* urgency cues
* attribution patterns
* narrative framing
* certainty language
* ambiguity language

Do not determine factual truth.

Return ONLY JSON.

{
"noise_score": number,
"confidence": number,
"emotional_triggers": string[],
"logic_breakdown": {
"summary": string,
"key_observations": string[],
"framing_notes": string[]
}
}
`;

````
function safeParse(content) {

    try {

        const cleaned =
            content
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

        const start =
            cleaned.indexOf("{");

        const end =
            cleaned.lastIndexOf("}");

        if (
            start === -1 ||
            end === -1
        ) {
            return null;
        }

        return JSON.parse(
            cleaned.slice(
                start,
                end + 1
            )
        );

    } catch {

        return null;
    }
}

try {

    const response =
        await fetch(
            provider.url,
            {
                method: "POST",

                headers:
                    provider.headers,

                body:
                    JSON.stringify({

                        model:
                            provider.model,

                        temperature:
                            0.2,

                        response_format: {
                            type:
                                "json_object"
                        },

                        messages: [
                            {
                                role:
                                    "system",

                                content:
                                    SYSTEM_PROMPT
                            },
                            {
                                role:
                                    "user",

                                content:
                                    text
                            }
                        ]
                    })
            }
        );

    const raw =
        await response.text();

    if (!response.ok) {

        return res.status(500).json({

            error:
                "Model error",

            details:
                raw
        });
    }

    const api =
        JSON.parse(raw);

    const content =
        api?.choices?.[0]
            ?.message?.content;

    const parsed =
        safeParse(content);

    if (!parsed) {

        return res.status(500).json({

            error:
                "Invalid model output",

            raw:
                content
        });
    }

    return res.status(200).json({

        noise_score:
            parsed.noise_score ?? 0,

        confidence:
            parsed.confidence ?? 0,

        emotional_triggers:
            parsed.emotional_triggers ?? [],

        logic_breakdown:
            parsed.logic_breakdown ?? {

                summary:
                    "Analysis complete.",

                key_observations: [],

                framing_notes: []
            },

        source_type:
            sourceType,

        node:
            provider.name
    });

} catch (err) {

    return res.status(500).json({

        error:
            err.message
    });
}
````

}
