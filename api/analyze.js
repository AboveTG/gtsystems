export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  const KEY = process.env.GOOGLE_API_KEY;
  const url = `https://googleapis.com{KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Analyze for psychological programming. Return ONLY a JSON object with noise_score, emotional_triggers, and logic_breakdown. TEXT: " + text }] }]
      })
    });

    // CRITICAL: If Google sends an error, we read it as text first to avoid the JSON crash
    const responseText = await response.text();
    
    if (!response.ok) {
        console.error("GOOGLE REJECTED REQUEST. Response starts with:", responseText.substring(0, 100));
        return res.status(response.status).json({ error: "Google rejected the key or API is disabled." });
    }

    const data = JSON.parse(responseText);
    const rawAiText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawAiText.replace(/```json|```/g, "").trim();
    
    res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("GroundTruth Node Error:", error.message);
    res.status(500).json({ error: "Check Vercel Logs for the 'GOOGLE REJECTED' message." });
  }
}
