function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<[^>]+>/g, " ");
}

function cleanText(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/(cookie|subscribe|newsletter|sign up|advertisement)/gi, "")
        .trim();
}

function isValid(text) {
    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;
    return words > 120 && sentences > 2;
}

export async function extractWebpageText(url) {
    try {

        const res = await fetch(url, {
            headers: {
                "User-Agent": "GroundTruthSystems/1.0"
            }
        });

        const html = await res.text();

        let text = stripHtml(html);
        text = cleanText(text);

        if (!isValid(text)) return null;

        return text.slice(0, 12000);

    } catch {
        return null;
    }
}
