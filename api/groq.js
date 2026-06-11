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

    const response = await fetch('...');
if (!response.ok) {
  console.error(`HTTP error! status: ${response.status}`);
  const text = await response.text(); // Get the raw error message
  console.error('Response body:', text);
  return;
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
