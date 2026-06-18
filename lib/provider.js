export const provider = {
    name: "GROQ",

    url: "https://api.groq.com/openai/v1/chat/completions",

    model: "llama-3.3-70b-versatile",

    headers: (apiKey) => ({
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    })
};

/**
 * Unified chat completion wrapper
 * - stable request format
 * - safe error handling
 * - prevents silent provider failures
 */
export async function callProvider({
    messages,
    temperature = 0.2,
    max_tokens = 1024
}) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("Missing GROQ_API_KEY");
    }

    const res = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers(apiKey),
        body: JSON.stringify({
            model: provider.model,
            messages,
            temperature,
            max_tokens
        })
    });

    let data;

    try {
        data = await res.json();
    } catch {
        throw new Error("Provider returned invalid JSON");
    }

    if (!res.ok) {
        throw new Error(
            data?.error?.message ||
            "Provider request failed"
        );
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("Empty provider response");
    }

    return content;
}
