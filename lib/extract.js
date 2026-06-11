export async function extractFromUrl(url) {

    const parsed = new URL(url);
    const host = parsed.hostname;

    // 1. YouTube (future upgrade hook)
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return {
            type: "youtube",
            transcript: null,
            requires: "caption_service"
        };
    }

    // 2. Direct video file
    if (url.match(/\.(mp4|webm|mov|m4v)/)) {
        return {
            type: "direct_video",
            requires: "download_and_transcribe"
        };
    }

    // 3. TikTok / social (no direct access yet)
    if (
        host.includes("tiktok.com") ||
        host.includes("instagram.com") ||
        host.includes("x.com")
    ) {
        return {
            type: "social_video",
            requires: "external_transcription"
        };
    }

    // 4. fallback
    return {
        type: "unknown",
        requires: "manual_text_fallback"
    };
}
