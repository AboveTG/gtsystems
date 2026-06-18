function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function strip(html = "") {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractBest(text) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 40);

    return sentences
        .sort((a, b) => b.length - a.length)
        .slice(0, 30)
        .join(" ");
}

export async function extractWebpageText(url) {
    try {
        if (typeof url !== "string" || !url.startsWith("http")) return null;

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

        let text = strip(html);
        text = decodeHtml(text);

        if (!text || text.split(/\s+/).length < 60) return null;

        return extractBest(text).slice(0, 20000);

    } catch (err) {
        console.error("webpage error:", err.message);
        return null;
    }
}
