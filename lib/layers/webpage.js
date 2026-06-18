function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

/* -------------------------------
   BASIC CLEANING
--------------------------------*/
function stripNoise(html = "") {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ");
}

/* -------------------------------
   NODE EXTRACTION
--------------------------------*/
function extractNodes(html = "") {
    const blocks = [];

    const regex = /<(p|div|section)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const raw = match[2]
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (raw.length > 40) {
            blocks.push(raw);
        }
    }

    return blocks;
}

/* -------------------------------
   READABILITY SCORING CORE
--------------------------------*/
function scoreNode(text = "") {
    const words = text.split(/\s+/).length;

    if (words < 20) return 0;

    let score = words;

    // sentence structure boost
    if (/[.!?]/.test(text)) score += 15;

    // penalize navigation-like text
    const navNoise = (text.match(/(menu|login|subscribe|section|sports|games|weather)/gi) || []).length;
    score -= navNoise * 8;

    // penalize link-heavy blocks
    const linkCount = (text.match(/http|www|\.com/gi) || []).length;
    score -= linkCount * 5;

    return score;
}

/* -------------------------------
   MAIN CONTENT ESTIMATION
--------------------------------*/
function extractBestContent(nodes = []) {
    return nodes
        .map(n => ({
            text: n,
            score: scoreNode(n)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(x => x.text)
        .join("\n\n");
}

/* -------------------------------
   FALLBACK CLEAN TEXT
--------------------------------*/
function fallback(html = "") {
    return decodeHtml(
        html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

/* -------------------------------
   PUBLIC API
--------------------------------*/
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

        if (!html || html.length < 1200) return null;

        const cleaned = stripNoise(html);

        const nodes = extractNodes(cleaned);

        let text;

        if (nodes.length >= 6) {
            text = extractBestContent(nodes);
        } else {
            text = fallback(cleaned);
        }

        text = decodeHtml(text)
            .replace(/\s+/g, " ")
            .trim();

        const words = text.split(/\s+/).length;

        if (words < 120) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("Readability extraction error:", err.message);
        return null;
    }
}
