export async function extractFromUrl(url) {

    const parsed = new URL(url);
    const host = parsed.hostname;

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return { type: "youtube" };
    }

    if (url.match(/\.(mp4|mov|webm|m4v)/)) {
        return { type: "direct_video" };
    }

    if (
        host.includes("tiktok.com") ||
        host.includes("instagram.com") ||
        host.includes("x.com")
    ) {
        return { type: "social_video" };
    }

    return { type: "unknown" };
}
