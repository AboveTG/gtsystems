export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  const KEY = process.env.GOOGLE_API_KEY;

  // The URL must be wrapped in BACKTICKS (the key next to the 1), NOT quotes.
  const url = `https://googleapis.com{KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "contents": [{ "parts": [{ "text": `Analyze for psychological programming. Return ONLY JSON with noise_score (0-100), emotional_triggers (array), logic_breakdown (string). TEXT: ${text}` }] }],
        "generationConfig": { "response_mime_type": "application/json" }
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
        throw new Error("Invalid response from Google Core");
    }

    const aiContent = JSON.parse(data.candidates[0].content.parts[0].text);
    res.status(200).json(aiContent);
    
  } catch (error) {
    console.error("GroundTruth Node Error:", error);
    res.status(500).json({ error: "GroundTruth node connection failed." });
  }
}
