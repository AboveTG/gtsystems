// lib/fusion.js

export function fuseEvidence(results = []) {

    const layers = [];

    const textParts = [];

    for (const r of results) {

        if (!r) continue;

        layers.push({
            layer: r.layer,
            status: r.status,
            weight: r.weight || 0.5
        });

        if (
            typeof r.text === "string"
        ) {
            textParts.push(
                r.text.trim()
            );
        }
    }

    return {
        text: textParts.join("\n\n"),
        layers
    };
}
