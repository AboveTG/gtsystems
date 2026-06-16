export function classifyInput(input) {
    if (!input || typeof input !== "string") {
        return { type: "empty", confidence: 1 };
    }

    const raw = input.trim();

    // --------------------------------------------------
    // HARD URL DETECTION (NO RELIANCE ON new URL())
    // --------------------------------------------------
    const urlMatch = raw.match(/https?:\/\/\S+|www\.\S+/i);

    if (urlMatch) {
        const url = urlMatch[0];

        let host = "";

        try {
            host = new URL(
                url.startsWith("www.") ? "https://" + url : url
            ).hostname.toLowerCase();
        } catch {
            // even malformed URLs still route as web
            return {
                type: "web",
                confidence: 0.6,
                reason: "malformed_url_fallback"
            };
        }

        if (host.includes("youtube.com") || host.includes("youtu.be")) {
            return { type: "youtube", confidence: 0.95 };
        }

        if (host.includes("tiktok.com")) {
            return { type: "tiktok", confidence: 0.95 };
        }

        if (host.includes("x.com") || host.includes("twitter.com")) {
            return { type: "tweet", confidence: 0.9 };
        }

        return { type: "web", confidence: 0.95 };
    }

    return { type: "text", confidence: 1 };
}
