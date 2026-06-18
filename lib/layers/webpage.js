function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function stripNoise(html = "") {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
        .replace(/<form[\s\S]*?<\/form>/gi, " ");
}

function extractParagraphs(html = "") {
    const matches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];

    return matches
        .map(p =>
            decodeHtml(
                p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            )
        )
        .filter(p => p.length > 25);
}

function extractText(html = "") {
    return decodeHtml(
        html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

function scoreBlock(text = "") {
    const words = text.split(/\s+/).length;
    let score = words;

    if (words > 30) score += 10;
    if (/[.!?]/.test(text)) score += 5;

    return score;
}

function extractBest(paragraphs = [], fallbackText = "") {
    if (paragraphs.length > 3) {
        return paragraphs
            .map(p => ({ text: p, score: scoreBlock(p) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 25)
            .map(x => x.text)
            .join("\n\n");
    }

    return fallbackText;
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 GroundTruthBot",
                "Accept": "text/html"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();

        if (!html || html.length < 500) return null;

        const cleaned = stripNoise(html);

        const paragraphs = extractParagraphs(cleaned);
        const fallbackText = extractText(cleaned);

        let text = extractBest(paragraphs, fallbackText);

        text = decodeHtml(text);

        const words = text.split(/\s+/).length;

        if (words < 60) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("webpage extraction error:", err.message);
        return null;
    }
}
