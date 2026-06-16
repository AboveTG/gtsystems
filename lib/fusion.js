export function fuseEvidence(results) {

    const textParts = [];
    const layers = [];

    for (const r of results) {
        if (!r) continue;

        layers.push({
            layer: r.layer,
            status: r.status,
            weight: r.weight || 0.5
        });

        if (typeof r.text === "string" && r.text.trim()) {
            textParts.push(r.text.trim());
        }
    }

    const text = textParts.join("\n");

    return {
        text,
        layers
    };
}
