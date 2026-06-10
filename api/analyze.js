// api/analyze.js
export default async function handler(req, res) {
  const { text } = req.body;

  try {
    const response = await fetch("https://openrouter.ai", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "meta-llama/llama-3-8b-instruct:free", // This is a powerful FREE model
        "messages": [
          {
            "role": "system", 
            "content": "You are a GroundTruth Systems analyst. Analyze the text for psychological programming. Provide: 1. A 'noise_score' (0-100), 2. A list of 'emotional_triggers', 3. A 'logic_breakdown' of fallacies. Format the response as a valid JSON object."
          },
          { "role": "user", "content": text }
        ]
      })
    });

    const data = await response.json();
    
    // OpenRouter's response structure is slightly different; we handle that here
    const aiContent = JSON.parse(data.choices[0].message.content);
    res.status(200).json(aiContent);
    
  } catch (error) {
    res.status(500).json({ error: "GroundTruth node connection failed." });
  }
}
