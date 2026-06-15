// lib/layers/webpage.js

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "");
}

function extractMainBlocks(html) {

    // try article first (highest signal)
    const article = html.match(/<article[\s\S]*?<\/article>/i);
    if (article) return article[0];

    // fallback: main content containers
    const main =
        html.match(/<main[\s\S]*?<\/main>/i) ||
        html.match(/<div[^>]*(content|article|story|post)[^>]*>[\s\S]*?<\/div>/i);

    if (main) return main[0];

    return html;
}

function htmlToText(html) {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function removeBoilerplate(text) {

    const noise = [
        "cookie",
        "subscribe",
        "newsletter",
        "sign up",
        "privacy policy",
        "terms of service",
        "advertisement",
        "login",
        "register"
    ];

    let cleaned = text;

    for (const n of noise) {
        const re = new RegExp(n, "gi");
        cleaned = cleaned.replace(re, "");
    }

    return cleaned.replace(/\s+/g, " ").trim();
}

function isValidArticle(text) {
    if (!text) return false;

    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    return words > 120 && sentences > 3;
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (GroundTruthSystems/1.0; analysis engine)"
            }
        });

        const html = await res.text();

        let cleaned = stripHtml(html);
        let mainBlock = extractMainBlocks(cleaned);
        let text = htmlToText(mainBlock);
        text = removeBoilerplate(text);

        if (!isValidArticle(text)) {
            return null;
        }

        // hard cap to avoid token explosion
        return text.slice(0, 12000);

    } catch (err) {
        return null;
    }
}
