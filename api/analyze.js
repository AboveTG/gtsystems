export default async function handler(req, res) {

if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
}

const { text } = req.body;

if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid input" });
}

const SCHEMA = `
Return ONLY valid JSON. No markdown. No explanation.

Required format:
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

// ---------------- CLEANER PARSER ----------------

function extractJSON(raw) {
    if (!raw) return null;

    // remove code fences
    let cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    // extract first JSON object (critical fix)
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first === -1 || last === -1) return null;

    cleaned = cleaned.slice(first, last + 1);

    try {
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

// ---------------- NORMALIZATION ----------------

function normalize(data) {

    if (!data) {
        return fallback("No valid model output");
    }

    return {
        noise_score: Number(data.noise_score ?? 0),

        emotional_triggers: Array.isArray(data.emotional_triggers)
            ? data.emotional_triggers
            : [],

        logic_breakdown: {
            summary:
                data?.logic_breakdown?.summary ||
                "Analysis completed with limited signal quality.",

            key_observations: Array.isArray(data?.logic_breakdown?.key_observations)
                ? data.logic_breakdown.key_observations
                : [],

            framing_notes: Array.isArray(data?.logic_breakdown?.framing_notes)
                ? data.logic_breakdown.framing_notes
                : []
        }
    };
}

// ---------------- FALLBACK (IMPORTANT FIX) ----------------

function fallback(reason) {
    return {
        noise_score: 0,
        emotional_triggers: [],
        logic_breakdown: {
            summary: `No structured output generated (${reason}).`,
            key_observations: [],
            framing_notes: []
        }
    };
}

// ---------------- MAIN LOOP ----------------

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
            console.warn(p.name, "HTTP error:", raw);
            continue;
        }

        const parsed = extractJSON(raw);

        const normalized = normalize(parsed);

        return res.status(200).json({
            ...normalized,
            node: p.name
        });

    } catch (err) {
        console.error(p.name, err);
    }
}

return res.status(500).json({
    error: "All nodes failed"
});
}
