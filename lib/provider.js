export const provider = {
name: "GROQ",

```
url: "https://api.groq.com/openai/v1/chat/completions",

headers: {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
},

model: "llama-3.3-70b-versatile"
```

};
