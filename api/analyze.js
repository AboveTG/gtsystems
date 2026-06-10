// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;

  try {
    // Google's OpenAI-compatible endpoint
    const response = await fetch("https://googleapis.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // This tells Google to use your key from the Vercel Environment Variables
        "Authorization": `Bearer ${process.env.GOOGLE_API_KEY}`
      },
      body: JSON.stringify({
        "model": "gemini-2.0-flash-lite-preview-02-05", // Powerful & Free
        "messages": [
          {
            "role": "system", 
            "content": "You are a GroundTruth Systems analyst. Analyze the text for psychological programming. Provide: 1. A 'noise_score' (0-100), 2. A list of 'emotional_triggers', 3. A 'logic_breakdown' of fallacies. Format the response as a single, valid JSON object."
          },
          { "role": "user", "content": text }
        ],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    
    // Safety check for empty or broken responses
    if (!data.choices || !data.choices[0]) {
       throw new Error("Invalid API response structure");
    }

    const aiContent = JSON.parse(data.choices.message.content);
    res.status(200).json(aiContent);
    
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "GroundTruth node connection failed." });
  }
}
