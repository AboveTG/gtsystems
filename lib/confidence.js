// lib/confidence.js

export function computeAnalysisQuality({
    layers,
    signalLevel
}) {

    const total = Math.max(layers.length, 1);

    const hitRatio =
        layers.filter(l => l.status === "hit").length / total;

    const layerReliability =
        layers.reduce((sum, l) => sum + (l.weight || 0.5), 0) / total;

    const signalScore =
        signalLevel / 3;

    const quality =
        (hitRatio * 0.5) +
        (layerReliability * 0.3) +
        (signalScore * 0.2);

    return Math.round(Math.max(0, Math.min(1, quality)) * 100) / 100;
}
