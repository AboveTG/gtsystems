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

function stripTags(html = "") {
    return html.replace(/<[^>]+>/g, " ");
}

function normalize(text = "") {
    return text.replace(/\s+/g, " ").trim();
}

function scoreBlock(t = "") {
    const words = t.split(/\s+/).length;
    if (words < 20) return 0;

    let score = words;

    if (/[.!?]/.test(t)) score += 10;
    if (/[A-Z]/.test(t)) score += 2;

    return score;
}

function extractBest(text = "") {
    const parts = text
        .split(/(?<=[.!?])\s+/)
        .filter(p => p && p.length > 40);

    return parts
        .map(p => ({ t: p, s: scoreBlock(p) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 30)
        .map(x => x.t)
        .join(" ");
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

        if (!html || html.length < 800) return null;

        let text = stripNoise(html);
        text = stripTags(text);
        text = decodeHtml(text);
        text = normalize(text);

        if (text.split(/\s+/).length < 100) return null;

        const best = extractBest(text);

        if (!best || best.split(/\s+/).length < 80) {
            return text.slice(0, 20000);
        }

        return best.slice(0, 20000);

    } catch (err) {
        console.error("web extraction error:", err?.message);
        return null;
    }
}
