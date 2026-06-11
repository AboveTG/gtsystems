export default async function handler(req, res) {
  const { text } = req.body;
  try {
    const response = await fetch("https://groq.com", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "You are a GroundTruth Systems analyst. Return JSON with: noise_score, emotional_triggers, logic_breakdown." }, { role: "user", content: text }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    res.status(200).json(JSON.parse(data.choices[0].message.content));
  } catch (e) { res.status(500).json({ error: "Groq node failed" }); }
}
