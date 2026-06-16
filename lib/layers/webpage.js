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

function extractText(html = "") {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractParagraphs(html = "") {
    const matches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];

    return matches
        .map(p =>
            decodeHtml(
                p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            )
        )
        .filter(p => p.length > 40);
}

function scoreBlock(text = "") {
    const words = text.split(/\s+/).length;
    if (words < 25) return 0;

    let score = words;
    if (/[.!?]/.test(text)) score += 10;
    if (/[A-Z]/.test(text)) score += 3;

    return score;
}

function extractBestBlocks(paragraphs = []) {
    return paragraphs
        .map(p => ({
            text: p,
            score: scoreBlock(p)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30)
        .map(x => x.text)
        .join("\n\n");
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

        if (!html || html.length < 1000) return null;

        const cleanedHtml = stripNoise(html);

        const paragraphs = extractParagraphs(cleanedHtml);

        let text = "";

        if (paragraphs.length > 5) {
            text = extractBestBlocks(paragraphs);
        } else {
            text = extractText(cleanedHtml);
        }

        text = decodeHtml(text);

        const words = text.split(/\s+/).length;

        if (words < 120) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("webpage extraction error:", err.message);
        return null;
    }
}
