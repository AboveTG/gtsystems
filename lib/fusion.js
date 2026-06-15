export function fuseEvidence(results) {

```
const textParts = [];

const layers = [];

for (const result of results) {

    if (!result) continue;

    layers.push({
        layer: result.layer,
        status: result.status,
        weight: result.weight || 0.5
    });

    if (result.text) {
        textParts.push(result.text);
    }
}

return {
    text: textParts.join("\n\n"),
    layers
};
```

}
