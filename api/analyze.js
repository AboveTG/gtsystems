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

{
  "noise_score": number (0-100),
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
    },
    {
        name: "OPENROUTER",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "meta-llama/llama-3-8b-instruct:free"
    }
];

// -------------------- SAFE PARSING --------------------

function safeJSONParse(raw, provider) {

    if (!raw) {
        console.warn(`${provider}: empty response`);
        return null;
    }

    const trimmed = raw.trim();

    if (trimmed.startsWith("<")) {
        console.warn(`${provider}: HTML response blocked`);
        return null;
    }

    try {
        return JSON.parse(trimmed);
    } catch (err) {
        console.warn(`${provider}: invalid JSON`);
        return null;
    }
}

// -------------------- NORMALIZATION --------------------

function normalize(data) {

    return {
        noise_score: Number(data?.noise_score ?? 0),

        emotional_triggers: Array.isArray(data?.emotional_triggers)
            ? data.emotional_triggers
            : [],

        logic_breakdown: {
            summary:
                data?.logic_breakdown?.summary ||
                "No summary available",

            key_observations: Array.isArray(data?.logic_breakdown?.key_observations)
                ? data.logic_breakdown.key_observations
                : [],

            framing_notes: Array.isArray(data?.logic_breakdown?.framing_notes)
                ? data.logic_breakdown.framing_notes
                : []
        }
    };
}

// -------------------- MAIN LOOP --------------------

for (const p of providers) {

    try {

        const response = await fetch(p.url, {
            method: "POST",
            headers: p.headers,
            body: JSON.stringify({
                model: p.model,
                messages: [
                    { role: "system", content: SCHEMA },
                    { role: "user", content: text }
                ]
            })
        });

        const raw = await response.text();

        if (!response.ok) {
            console.warn(`${p.name} HTTP error:`, raw);
            continue;
        }

        const parsed = safeJSONParse(raw, p.name);

        if (!parsed) continue;

        const result = normalize(parsed);

        return res.status(200).json({
            ...result,
            node: p.name
        });

    } catch (err) {
        console.error(`${p.name} crash:`, err);
    }
}

return res.status(500).json({
    error: "All analysis nodes failed"
});
}
