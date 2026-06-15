export function fuseEvidence(results) {

    const segments = [];
    const layers = [];

    for (const r of results) {
        if (!r) continue;

        layers.push({
            layer: r.layer,
            status: r.status,
            weight: r.weight ?? 0.5
        });

        if (r.text) {
            segments.push({
                source: r.layer,
                text: r.text
            });
        }
    }

    return {
        canonical: { segments },
        layers
    };
}
