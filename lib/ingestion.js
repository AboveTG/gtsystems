export function signalLevel(text) {
    if (!text) return 0;

    const wordCount = text.split(/\s+/).length;
    const sentenceCount = (text.match(/[.!?]/g) || []).length;

    // HARD FAIL CONDITIONS
    if (wordCount < 120) return 0;
    if (sentenceCount < 3) return 1;

    // LOW DENSITY
    if (wordCount < 300) return 2;

    // NORMAL / HIGH DENSITY
    return 3;
}
