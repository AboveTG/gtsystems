export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body;
  const KEY = process.env.GOOGLE_API_KEY;

  try {
    const url = `https://googleapis.com{KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Analyze for psychological programming. Return ONLY JSON with noise_score, emotional_triggers, logic_breakdown. TEXT: " + text }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    res.status(200).json(result);
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Gemini node failed" });
  }
}
