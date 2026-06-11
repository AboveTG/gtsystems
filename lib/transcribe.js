function extractVideoId(url) {

    try {
        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.replace("/", "");
        }

        return u.searchParams.get("v");

    } catch {
        return null;
    }
}

export async function transcribe(url, type) {

    if (type !== "youtube") {
        return fallback(url, type);
    }

    const id = extractVideoId(url);

    if (!id) return fallback(url, type);

    try {

        const res = await fetch(
            `https://video.google.com/timedtext?lang=en&v=${id}`
        );

        const xml = await res.text();

        if (!xml || !xml.includes("<text")) {
            return fallback(url, type);
        }

        return xml
            .replace(/<text[^>]*>/g, " ")
            .replace(/<\/text>/g, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    } catch (err) {
        return fallback(url, type);
    }
}

function fallback(url, type) {

    return `
[INGESTION FALLBACK]

Source: ${url}
Type: ${type}

No transcript available.
`;
}
