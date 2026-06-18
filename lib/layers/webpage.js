function decodeHtml(t = "") {
    return t
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
        .replace(/<[^>]+>/g, " ");
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 GroundTruthBot"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();
        if (!html || html.length < 500) return null;

        let text = strip(html);
        text = decodeHtml(text).replace(/\s+/g, " ").trim();

        if (text.split(/\s+/).length < 60) return null;

        return text.slice(0, 20000);

    } catch (e) {
        return null;
    }
}
