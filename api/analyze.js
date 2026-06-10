// api/analyze.js
export default async function handler(req, res) {
  // Ensure we only process POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gtsystems.work", // Optional: identifies your site to OpenRouter
        "X-Title": "GroundTruth Systems"           // Optional: labels your site on their leaderboard
      },
      body: JSON.stringify({
       "model": "meta-llama/llama-3.2-3b-instruct:free",
        "messages": [
          {
            "role": "system", 
            "content": "You are a GroundTruth Systems analyst. Analyze the text for psychological programming. Provide: 1. A 'noise_score' (0-100), 2. A list of 'emotional_triggers', 3. A 'logic_breakdown' explaining fallacies and shaming. Format the final response as a valid, single JSON object."
          },
          { "role": "user", "content": text }
        ],
        "response_format": { "type": "json_object" } // Ensures the AI speaks strictly in code
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenRouter Error:", errorData);
      return res.status(response.status).json({ error: "Upstream API Error" });
    }

    const data = await response.json();
    
    // Safety check: sometimes AI adds markdown backticks, we strip those
    let content = data.choices[0].message.content;
    const cleanJson = content.replace(/```json|```/g, "").trim();
    
    res.status(200).json(JSON.parse(cleanJson));
    
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ error: "GroundTruth node connection failed." });
  }
}
