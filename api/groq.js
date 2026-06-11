export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
        messages: [
          { role: "system", content: "Return ONLY a JSON object with: noise_score (0-100), emotional_triggers (array), logic_breakdown (string)." },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      })
    });

    // 1. Check if the HTTP request itself failed (e.g., 401, 429, 500)
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API Error (${response.status}):`, errorText);
      return res.status(response.status).json({ error: "Groq API communication failed" });
    }

    const data = await response.json();

    // 2. Parse the stringified JSON inside the message content
    const result = JSON.parse(data.choices[0].message.content);
    res.status(200).json(result);

  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }

const data = await response.json();

      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Return ONLY a JSON object with: noise_score (0-100), emotional_triggers (array), logic_breakdown (string)." },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    // Safety check: parse the string inside choices[0].message.content
    const result = JSON.parse(data.choices[0].message.content);
    res.status(200).json(result);
  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({ error: "Groq node failed" });
  }
}
