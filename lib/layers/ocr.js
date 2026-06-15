import Tesseract from "tesseract.js";

export async function ocrLayer(imageBuffer) {

```
try {

    const result =
        await Tesseract.recognize(
            imageBuffer,
            "eng"
        );

    const text =
        (result?.data?.text || "")
            .replace(/\s+/g, " ")
            .trim();

    if (text.length < 20) return null;

    return {
        layer: "ocr",
        status: "hit",
        weight: 0.75,
        text
    };

} catch {
    return null;
}
```

}
