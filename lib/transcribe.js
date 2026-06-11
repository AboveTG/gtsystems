import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url) {

    try {
        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.slice(1);
        }

        if (u.searchParams.get("v")) {
            return u.searchParams.get("v");
        }

        return null;

    } catch {
        return null;
    }
}

export async function transcribe(url, type) {

    if (type !== "youtube") {
        return fallbackTranscript(url, type);
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
        return fallbackTranscript(url, type);
    }

    try {

        const transcript =
            await YoutubeTranscript.fetchTranscript(videoId);

        return transcript
            .map(t => t.text)
            .join(" ");

    } catch (err) {

        console.warn("YouTube transcript failed:", err);

        return fallbackTranscript(url, type);
    }
}

function fallbackTranscript(url, type) {

    return `
[Fallback Transcript]

Source: ${url}
Type: ${type}

This video could not be directly transcribed.
The system is operating in fallback mode.

Content likely contains spoken narrative with structured persuasion patterns.
`;
}
