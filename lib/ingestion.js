// lib/ingestion.js

export function safeTrim(v) {
    return typeof v === "string" ? v.trim() : "";
}

export function detectRawUrlToken(str) {
    // catches bare https:// or www. tokens that break ESM or parsing
    return /(^|\s)(https?:\/\/\S+|www\.\S+)/i.test(str);
}

export function safeUrl(str) {
    try {
        const u = new URL(str);
        return u.toString();
    } catch {
        return null;
    }
}

export function classifyInput(input) {
    if (!input) return "empty";

    // hard guard: raw token detection BEFORE URL parsing
    if (detectRawUrlToken(input)) {
        // still allow but mark unsafe pre-normalization state
        return "raw_url_text";
    }

    try {
        const url = new URL(input);

        const host = url.hostname.toLowerCase();

        if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
        if (host.includes("tiktok.com")) return "tiktok";
        if (host.includes("x.com") || host.includes("twitter.com")) return "tweet";
        if (host) return "web";

    } catch {}

    return "text";
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

    // hard safety: strip accidental bare URL fragments in text mode
    if (type === "text" && detectRawUrlToken(cleaned)) {
        return cleaned.replace(/https?:\/\/\S+/g, "[URL_REMOVED]")
                      .replace(/www\.\S+/g, "[URL_REMOVED]");
    }

    return cleaned;
}

export function signalLevel(text) {
    if (!text) return 0;
    if (text.includes("METADATA MODE")) return 1;
    if (text.length < 120) return 1;
    if (text.length < 600) return 2;
    return 3;
}
