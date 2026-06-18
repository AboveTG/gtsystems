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
        .replace(/<form[\s\S]*?<\/form>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

// Extract ONLY paragraph-like content
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
        .filter(p => p.length > 60);
}

// Score paragraph quality (filters nav junk)
function scoreParagraph(text = "") {
    const words = text.split(/\s+/).length;

    if (words < 25) return 0;

    let score = words;

    // real sentences
    if (/[.!?]/.test(text)) score += 15;

    // penalize menu-like text
    if ((text.match(/(menu|login|sign in|subscribe|games|sports)/gi) || []).length > 2) {
        score -= 30;
    }

    return score;
}

function extractBest(paragraphs = []) {
    return paragraphs
        .map(p => ({ text: p, score: scoreParagraph(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(x => x.text)
        .join("\n\n");
}

function fallbackText(html = "") {
    return decodeHtml(
        html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();

        if (!html || html.length < 1500) return null;

        const cleaned = stripNoise(html);

        const paragraphs = extractParagraphs(cleaned);

        let text;

        if (paragraphs.length >= 5) {
            text = extractBest(paragraphs);
        } else {
            text = fallbackText(cleaned);
        }

        text = text.replace(/\s+/g, " ").trim();

        const words = text.split(/\s+/).length;

        if (words < 120) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("webpage extraction error:", err.message);
        return null;
    }
}
