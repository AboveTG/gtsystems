export function classifyInput(input) {
    if (!input || typeof input !== "string") return "text";

    const raw = input.trim();

    const urlMatch = raw.match(/https?:\/\/\S+|www\.\S+/i);

    if (urlMatch) return "web";

    return "text";
}

export function normalizeInput(input) {
    if (!input || typeof input !== "string") return "";

    return input.trim();
}

export function signalLevel(text) {
    if (!text) return 0;

    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    if (words < 120) return 0;
    if (sentences < 2) return 1;
    if (words < 400) return 2;
    return 3;
}
