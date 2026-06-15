// lib/layers/webpage.js

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (GroundTruthSystems/1.0; +analysis bot)"
            }
        });

        const html = await res.text();

        // ----------------------------
        // STRIP SCRIPT / STYLE
        // ----------------------------
        let cleaned = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<!--[\s\S]*?-->/g, "");

        // ----------------------------
        // PRIORITIZE ARTICLE CONTENT
        // ----------------------------
        const articleMatch =
            cleaned.match(/<article[\s\S]*?<\/article>/i);

        let textSource = articleMatch ? articleMatch[0] : cleaned;

        // ----------------------------
        // REMOVE TAGS
        // ----------------------------
        let text = textSource
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        // ----------------------------
        // BASIC BOILERPLATE FILTERING
        // ----------------------------
        const noisePatterns = [
            "cookie",
            "subscribe",
            "newsletter",
            "sign in",
            "advertisement",
            "privacy policy",
            "terms of service"
        ];

        for (const n of noisePatterns) {
            const re = new RegExp(n, "gi");
            text = text.replace(re, "");
        }

        // ----------------------------
        // FINAL CLEANUP
        // ----------------------------
        text = text.replace(/\s+/g, " ").trim();

        return text.length > 200 ? text : null;

    } catch (err) {
        return null;
    }
}
