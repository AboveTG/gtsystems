export default async function handler(req, res) {

if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
}

const { text } = req.body;

try {

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "Return ONLY JSON: noise_score, emotional_triggers, logic_breakdown"
                },
                { role: "user", content: text }
            ]
        })
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    res.status(200).json(JSON.parse(content));

} catch (err) {
    res.status(500).json({ error: "Groq failed" });
}
}
