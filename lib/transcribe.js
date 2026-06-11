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

    const videoId = extractVideoId(url);

    if (!videoId) return fallback(url, type);

    try {

        // YouTube official captions endpoint
        const captionUrl =
            `https://video.google.com/timedtext?lang=en&v=${videoId}`;

        const res = await fetch(captionUrl);

        const xml = await res.text();

        // If no captions exist
        if (!xml || !xml.includes("<text")) {
            return fallback(url, type);
        }

        // Parse XML captions into readable text
        const text = xml
            .replace(/<text[^>]*>/g, " ")
            .replace(/<\/text>/g, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return text || fallback(url, type);

    } catch (err) {
        console.error("transcription error:", err);
        return fallback(url, type);
    }
}

function fallback(url, type) {

    return `
[INGESTION FALLBACK MODE]

Source: ${url}
Type: ${type}

No transcript available.

System behavior:
- Video may not contain captions
- Platform may restrict access
- Content will be analyzed as metadata-only narrative structure

Note: This is expected for many social videos.
`;
}
