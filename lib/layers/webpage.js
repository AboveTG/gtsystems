export async function webpageLayer(input) {

```
try {

    const url = new URL(input);

    const res = await fetch(url.toString(), {
        redirect: "follow",
        headers: {
            "User-Agent": "GTSystems-Ingestion/1.0"
        }
    });

    const html = await res.text();

    const cleaned = html
        .replace(/<script[^>]*>.*?<\/script>/gis, "")
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<nav[^>]*>.*?<\/nav>/gis, "")
        .replace(/<footer[^>]*>.*?<\/footer>/gis, "")
        .replace(/<header[^>]*>.*?<\/header>/gis, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length < 80) return null;

    return {
        layer: "webpage",
        status: "hit",
        weight: 0.70,
        text: cleaned.slice(0, 12000)
    };

} catch {
    return null;
}
```

}
