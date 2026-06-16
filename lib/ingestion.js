// lib/ingestion.js

export function classifyInput(input = "") {

    const trimmed = input.trim();

    if (
        /^https?:\/\//i.test(trimmed)
    ) {
        return "web";
    }

    return "text";
}

export function normalizeInput(
    input = ""
) {
    return input
        .replace(/\r/g, "")
        .trim();
}

export function signalLevel(
    text = ""
) {

    const words =
        text.split(/\s+/).length;

    if (words < 50) return 0;

    if (words < 200) return 1;

    if (words < 500) return 2;

    return 3;
}
