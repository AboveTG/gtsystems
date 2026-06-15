// lib/fusion.js

export function fuseEvidence(results) {

    const segments = [];
    const layers = [];

    for (const result of results) {

        if (!result) continue;

        layers.push({
            layer: result.layer,
            status: result.status,
            weight: result.weight ?? 0.5
        });

        if (result.text) {
            segments.push({
                source: result.layer || "unknown",
                text: result.text
            });
        }
    }

    return {
        canonical: {
            segments
        },
        layers
    };
}
