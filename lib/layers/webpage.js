// lib/layers/webpage.js

function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function stripScripts(html = "") {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function stripTags(html = "") {
    return html.replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(text = "") {
    return text
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
}

function scoreParagraph(p) {

    const words = p.split(/\s+/).length;

    if (words < 25) return 0;

    let score = words;

    if (/[.!?]/.test(p)) score += 20;

    if (/[A-Z]/.test(p)) score += 5;

    return score;
}

function extractNarrativeBlocks(text = "") {

    const chunks = text
        .split(/\n{2,}|\.\s{2,}/)
        .map(x => x.trim())
        .filter(Boolean);

    return chunks
        .map(chunk => ({
            text: chunk,
            score: scoreParagraph(chunk)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map(x => x.text)
        .join("\n\n");
}

export async function extractWebpageText(url) {

    try {

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 GroundTruthSystems"
            }
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();

        let text = stripScripts(html);

        text = decodeHtml(text);

        text = stripTags(text);

        text = normalizeWhitespace(text);

        text = extractNarrativeBlocks(text);

        if (!text) {
            return null;
        }

        const words =
            text.split(/\s+/).length;

        if (words < 100) {
            return null;
        }

        return text.slice(0, 15000);

    } catch (err) {

        console.error(
            "extractWebpageText:",
            err.message
        );

        return null;
    }
}
