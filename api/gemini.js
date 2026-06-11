// api/analyze.js
export default async function handler(req, res) {
  const { text } = req.body;

  const response = await fetch('https://openai.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "You are a GroundTruth Systems analyst. Analyze the text for psychological programming. Provide: 1. A 'Noise Score' (0-100), 2. List of emotional triggers, 3. Explanations of logical fallacies found. Format as JSON."
        },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  res.status(200).json(JSON.parse(data.choices[0].message.content));
}
