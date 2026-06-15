function normalize(text) {

```
return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
```

}

export function dedupeChunks(chunks) {

```
const seen =
    new Set();

return chunks.filter(chunk => {

    const key =
        normalize(chunk);

    if (seen.has(key)) {
        return false;
    }

    seen.add(key);

    return true;
});
```

}
