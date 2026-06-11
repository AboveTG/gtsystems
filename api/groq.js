export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  try {
    // 2. Call the Groq API
    const response = await fetch("https://groq.com", {
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
            content: "Return ONLY a JSON object with: noise_score (0-100), emotional_triggers (array), logic_breakdown (string)." 
          },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      })
    });

    // 3. Handle API Errors (like 401 Unauthorized or 429 Rate Limit)
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Groq API Error: ${response.status}`, errorData);
      return res.status(response.status).json({ error: "Communication with Groq failed" });
    }

    const data = await response.json();

    // 4. Extract and parse the content from the model's response
    // Groq's response follows the OpenAI format: choices[0].message.content
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content returned from Groq");
    }

    const result = JSON.parse(content);
    return res.status(200).json(result);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal server error during processing" });
  }
}
