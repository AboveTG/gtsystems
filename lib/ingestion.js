export function safeTrim(v) {
    return typeof v === "string" ? v.trim() : "";
}

export function detectRawUrlToken(str) {
    return /(^|\s)(https?:\/\/\S+|www\.\S+)/i.test(str);
}

export function safeUrl(str) {
    try {
        return new URL(str).toString();
    } catch {
        return null;
    }
}

export function classifyInput(input) {
    if (!input) return "empty";

    if (detectRawUrlToken(input)) {
        return "raw_url_text";
    }

    try {
        const url = new URL(input);
        const host = url.hostname.toLowerCase();

        if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
        if (host.includes("tiktok.com")) return "tiktok";
        if (host.includes("x.com") || host.includes("twitter.com")) return "tweet";
        return "web";
    } catch {
        return "text";
    }
}

export function extractYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
        return u.searchParams.get("v");
    } catch {
        return null;
    }
}

export function normalizeInput(input, type) {
    const cleaned = safeTrim(input);

    if (type === "text" && detectRawUrlToken(cleaned)) {
        return cleaned
            .replace(/https?:\/\/\S+/g, "[URL_REMOVED]")
            .replace(/www\.\S+/g, "[URL_REMOVED]");
    }

    return cleaned;
}

export function signalLevel(text) {
    if (!text) return 0;

    const wordCount = text.split(/\s+/).length;
    const sentenceCount = (text.match(/[.!?]/g) || []).length;

    if (wordCount < 120) return 0;
    if (sentenceCount < 3) return 1;
    if (wordCount < 300) return 2;
    return 3;
}
