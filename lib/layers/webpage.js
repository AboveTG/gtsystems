import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function cleanText(text = "") {
    return decodeHtml(
        text
            .replace(/\s+/g, " ")
            .trim()
    );
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (GroundTruth Analyzer)",
                "Accept":
                    "text/html,application/xhtml+xml"
            }
        });

        if (!res.ok) {
            console.log("Fetch failed:", res.status);
            return null;
        }

        const html = await res.text();

        if (!html || html.length < 500) {
            console.log("HTML too small");
            return null;
        }

        // -------------------------
        // PRIMARY: Readability
        // -------------------------
        try {
            const dom = new JSDOM(html, { url });

            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (article?.textContent) {

                const text = cleanText(article.textContent);

                if (text.split(/\s+/).length > 40) {
                    return text.slice(0, 20000);
                }
            }

        } catch (e) {
            console.log("Readability failed:", e.message);
        }

        // -------------------------
        // FALLBACK: raw extraction
        // -------------------------
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const rawText = cleanText(document.body?.textContent || "");

        const words = rawText.split(/\s+/).length;

        if (words < 30) {
            console.log("Fallback too small:", words);
            return null;
        }

        return rawText.slice(0, 20000);

    } catch (err) {
        console.log("webpage extraction error:", err.message);
        return null;
    }
}
