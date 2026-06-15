import pdf from "pdf-parse";

export async function pdfLayer(buffer) {

```
try {

    const data = await pdf(buffer);

    const text = (data.text || "")
        .replace(/\s+/g, " ")
        .trim();

    if (text.length < 80) return null;

    return {
        layer: "pdf",
        status: "hit",
        weight: 0.90,
        text: text.slice(0, 15000)
    };

} catch {
    return null;
}
```

}
