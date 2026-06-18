export function fuseEvidence(results = []) {

```
const layers = [];
const textParts = [];

for (const r of results) {

    if (!r) continue;

    layers.push({
        layer: r.layer || "unknown",
        status: r.status || "unknown",
        weight: r.weight ?? 0.5
    });

    if (
        typeof r.text === "string" &&
        r.text.trim().length > 0
    ) {
        textParts.push(r.text.trim());
    }
}

return {
    text: textParts.join("\n\n"),
    layers
};
```

}
