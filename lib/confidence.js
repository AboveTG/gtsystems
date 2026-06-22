export function computeAnalysisQuality({
    layers = [],
    signalLevel = 0,
    rhetoric = null,
    framing = null
}) {
    const layerScore =
        layers.filter(l => l.status === "hit").length /
        Math.max(1, layers.length);

    const signalScore = signalLevel / 3;

    const rhetoricScore =
        rhetoric?.persuasion_score ?? 0;

    const framingScore =
        framing?.balance_score ?? 0;

    return Number(
        (
            layerScore * 0.25 +
            signalScore * 0.25 +
            rhetoricScore * 0.25 +
            framingScore * 0.25
        ).toFixed(2)
    );
}
