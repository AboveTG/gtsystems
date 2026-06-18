export function classifyInput(input = "") {
    const trimmed = input.trim();

    if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(trimmed)) {
        return "youtube";
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return "web";
    }

    if (/\.pdf(\?|$)/i.test(trimmed)) {
        return "pdf";
    }

    return "text";
}

export function normalizeInput(input = "") {
    return input
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function signalLevel(text = "") {
    const words = text.split(/\s+/).filter(Boolean).length;

    if (words < 50) return 0;
    if (words < 200) return 1;
    if (words < 500) return 2;
    return 3;
}
