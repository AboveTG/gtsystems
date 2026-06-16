export function safeTrim(v) {
    return typeof v === "string" ? v.trim() : "";
}

export function detectRawUrlToken(str) {
    return /https?:\/\/\S+|www\.\S+/i.test(str);
}

export function classifyInput(input) {
    if (!input || typeof input !== "string") {
        return "text";
    }

    const cleaned = input.trim();

    const urlMatch = cleaned.match(/https?:\/\/\S+|www\.\S+/i);

    if (urlMatch) {
        return "web";
    }

    return "text";
}

// KEEP THIS FOR BACKWARD COMPATIBILITY
export function normalizeInput(input) {
    const cleaned = safeTrim(input);

    if (detectRawUrlToken(cleaned)) {
        return cleaned;
    }

    return cleaned;
}

// KEEP THIS FOR ANALYZE.JS
export function signalLevel(text) {
    if (!text) return 0;

    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    if (words < 120) return 0;
    if (sentences < 3) return 1;
    if (words < 300) return 2;
    return 3;
}
