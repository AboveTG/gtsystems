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
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ");
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
                p.replace(/<[^>]+>/g, " ")
                 .replace(/\s+/g, " ")
                 .trim()
            )
        )
        .filter(p => p.length > 30);
}

function scoreBlock(text = "") {
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 20) return 0;

    let score = words;
    if (/[.!?]/.test(text)) score += 10;
    if (/[A-Z]/.test(text)) score += 2;

    return score;
}

function extractBestBlocks(paragraphs = []) {
    return paragraphs
        .map(p => ({ text: p, score: scoreBlock(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(x => x.text)
        .join("\n\n");
}

function fallbackExtraction(html = "") {
    const text = extractText(html);
    return text.length > 200 ? text : null;
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 GroundTruthBot",
                "Accept": "text/html,application/xhtml+xml"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();

        if (!html || html.length < 500) return null;

        const cleaned = stripNoise(html);

        const paragraphs = extractParagraphs(cleaned);

        let text = "";

        // PRIMARY PATH
        if (paragraphs.length >= 3) {
            text = extractBestBlocks(paragraphs);
        }

        // FALLBACK PATH (CRITICAL FIX)
        if (!text || text.length < 200) {
            text = fallbackExtraction(cleaned);
        }

        if (!text) return null;

        text = decodeHtml(text);

        const words = text.split(/\s+/).filter(Boolean).length;

        if (words < 80) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("webpage extraction error:", err.message);
        return null;
    }
}
