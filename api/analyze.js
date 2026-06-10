// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  const API_KEY = process.env.GOOGLE_API_KEY;

  try {
    // Using the NATIVE Google Gemini endpoint
    const response = await fetch(`https://googleapis.com{API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "contents": [{
          "parts": [{
            "text": `Analyze this text for psychological programming. Return ONLY a JSON object with: 1. noise_score (0-100), 2. emotional_triggers (array), 3. logic_breakdown (string). TEXT: ${text}`
          }]
        }],
        "generationConfig": { "response_mime_type": "application/json" }
      })
    });

    const data = await response.json();
    
    // Safety check for Google's specific response structure
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
        console.error("Full Google Response:", JSON.stringify(data));
        throw new Error("Invalid response from Google Core");
    }

    const aiContent = JSON.parse(data.candidates[0].content.parts[0].text);
    res.status(200).json(aiContent);
    
  } catch (error) {
    console.error("GroundTruth Node Error:", error);
    res.status(500).json({ error: "GroundTruth node connection failed. Check logs." });
  }
}
