// lib/layers/webpage.js

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

function cleanText(text = "") {
    return text
        .replace(/\s+/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();
}

function basicFallback(doc) {
    const text = doc.body?.textContent || "";
    return cleanText(text);
}

export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 GroundTruthBot",
                "Accept": "text/html"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();
        if (!html || html.length < 800) return null;

        const dom = new JSDOM(html, { url });
        const document = dom.window.document;

        // Primary: Readability extraction
        const reader = new Readability(document);
        const article = reader.parse();

        let text = "";

        if (article?.textContent) {
            text = cleanText(article.textContent);
        } else {
            text = basicFallback(document);
        }

        // hard filter
        const words = text.split(/\s+/).filter(Boolean).length;
        if (words < 120) return null;

        return text.slice(0, 20000);

    } catch (err) {
        console.error("[webpage extractor error]", err.message);
        return null;
    }
}
