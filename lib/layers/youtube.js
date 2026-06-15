export async function youtubeLayer(input) {

```
try {

    const url =
        new URL(input);

    if (
        !url.hostname.includes("youtube.com") &&
        !url.hostname.includes("youtu.be")
    ) {
        return null;
    }

    let videoId;

    if (
        url.hostname.includes("youtu.be")
    ) {
        videoId =
            url.pathname.slice(1);
    } else {
        videoId =
            url.searchParams.get("v");
    }

    let transcript = null;

    try {

        const mod =
            await import(
                "youtube-transcript"
            );

        transcript =
            await mod
            .YoutubeTranscript
            .fetchTranscript(videoId);

    } catch {}

    if (
        transcript &&
        transcript.length
    ) {

        return {

            layer:
                "youtube_transcript",

            status:
                "hit",

            weight:
                0.95,

            text:
                transcript
                .map(
                    x => x.text
                )
                .join(" ")
        };
    }

    const watch =
        await fetch(
            `https://www.youtube.com/watch?v=${videoId}`
        );

    const html =
        await watch.text();

    const title =
        html.match(
            /<title>(.*?)<\/title>/i
        )?.[1] || "";

    return {

        layer:
            "youtube_metadata",

        status:
            "hit",

        weight:
            0.25,

        text:
            title
    };

} catch {

    return null;
}
```

}
