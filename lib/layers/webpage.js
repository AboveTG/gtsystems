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

function clean(text = "") {
    return decodeHtml(text.replace(/\s+/g, " ").trim());
}

function safeUrl(url) {
    try {
        return new globalThis.URL(url).toString();
    } catch {
        return null;
    }
}

export async function extractWebpageText(inputUrl) {
    try {
        const url = safeUrl(inputUrl);

        if (!url) return null;

        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml"
            }
        });

        if (!res.ok) {
            console.log("Fetch failed:", res.status);
            return null;
        }

        const html = await res.text();

        if (!html || html.length < 500) return null;

        // -------------------------
        // Readability pass
        // -------------------------
        try {
            const dom = new JSDOM(html, { url });

            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (article?.textContent) {
                const text = clean(article.textContent);
                if (text.split(/\s+/).length > 40) {
                    return text.slice(0, 20000);
                }
            }
        } catch (e) {
            console.log("Readability failed:", e.message);
        }

        // -------------------------
        // fallback
        // -------------------------
        const dom = new JSDOM(html);
        const text = clean(dom.window.document.body?.textContent || "");

        if (text.split(/\s+/).length < 30) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.log("extract error:", err.message);
        return null;
    }
}
