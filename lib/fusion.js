export function fuseEvidence(results = []) {
    const layers = [];
    const textParts = [];

    // HARD GUARD: normalize input shape
    if (!Array.isArray(results)) {
        return {
            text: "",
            layers: []
        };
    }

    for (const r of results) {
        if (!r || typeof r !== "object") continue;

        const layer = typeof r.layer === "string" ? r.layer : "unknown";

        const status = r.status === "hit" ? "hit" : "miss";

        const weight =
            typeof r.weight === "number" && isFinite(r.weight)
                ? r.weight
                : 0.5;

        layers.push({
            layer,
            status,
            weight
        });

        // STRICT TEXT SAFETY
        if (typeof r.text === "string") {
            const cleaned = r.text
                .replace(/\u0000/g, "")
                .trim();

            if (cleaned.length > 0) {
                textParts.push(cleaned);
            }
        }
    }

    // FINAL SAFE JOIN
    return {
        text: textParts.join("\n\n").trim(),
        layers
    };
}
