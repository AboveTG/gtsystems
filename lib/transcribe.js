function extractVideoId(url) {
    try {
        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.slice(1);
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

        if (!xml || xml.includes("<transcript>")) {
            return "Transcript unavailable for this video.";
        }

        return xml
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    } catch (err) {
        return fallback(url, type);
    }
}

function fallback(url, type) {
    return `
[FALLBACK MODE]

Source: ${url}
Type: ${type}

No transcript available. Requires external transcription service.
`;
}
