export function computeConfidence({
layers,
signalLevel,
modelConfidence = 0.4
}) {

```
const hitCount =
    layers.filter(
        x => x.status === "hit"
    ).length;

const totalLayers =
    Math.max(layers.length, 1);

const evidenceScore =
    hitCount / totalLayers;

const reliabilityScore =
    layers.reduce(
        (sum, layer) =>
            sum + (layer.weight || 0),
        0
    ) /
    totalLayers;

const signalScore =
    signalLevel / 3;

const confidence =
    (
        evidenceScore * 0.45 +
        reliabilityScore * 0.30 +
        signalScore * 0.15 +
        modelConfidence * 0.10
    );

return Number(
    Math.min(
        1,
        Math.max(
            0,
            confidence
        )
    ).toFixed(2)
);
```

}
