export function computeAnalysisQuality({
    layers = [],
    signalLevel = 0,
    rhetoric = null,
    framing = null
}) {

    const layerScore =
        layers.length
            ? layers.filter(l => l.status === "hit").length / layers.length
            : 0;

    const signalScore = signalLevel / 3;

    const rhetoricScore =
        rhetoric?.persuasion_score ?? 0;

    const framingScore =
        framing?.balance_score ?? 0;

    const raw =
        (layerScore + signalScore + rhetoricScore + framingScore) / 4;

    return {
        score: Number(raw.toFixed(2)),
        label:
            raw > 0.75 ? "High confidence"
            : raw > 0.4 ? "Medium confidence"
            : "Low confidence"
    };
}
