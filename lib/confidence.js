export function computeAnalysisQuality({
    layers = [],
    signalLevel = 0,
    rhetoric = null,
    framing = null,
    textLength = 0
}) {

    const hitLayers =
        layers.filter(
            l => l.status === "hit"
        ).length;

    const layerScore =
        hitLayers /
        Math.max(1, layers.length);

    const signalScore =
        signalLevel / 3;

    const rhetoricScore =
        rhetoric?.persuasion_score || 0;

    const framingScore =
        framing?.balance_score || 0;

    const extractionScore =
        Math.min(
            1,
            textLength / 8000
        );

    const score =
        (layerScore * 0.20) +
        (signalScore * 0.20) +
        (rhetoricScore * 0.20) +
        (framingScore * 0.20) +
        (extractionScore * 0.20);

    return Number(
        score.toFixed(2)
    );
}
