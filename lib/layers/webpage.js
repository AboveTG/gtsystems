function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<[^>]+>/g, " ");
}

function cleanText(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/(cookie|subscribe|newsletter|sign up|advertisement)/gi, "")
        .trim();
}

function isValid(text) {
    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;
    return words > 120 && sentences > 2;
}

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export async function extractWebpageText(url) {

    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; GroundTruth/1.0)"
            }
        });

        const html = await res.text();

        // ----------------------------
        // STEP 1: DOM PARSING
        // ----------------------------
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);

        const article = reader.parse();

        if (article?.textContent && article.textContent.length > 200) {
            return article.textContent.trim().slice(0, 15000);
        }

        // ----------------------------
        // STEP 2: FALLBACK CLEAN HTML STRIP
        // ----------------------------
        const fallback = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (fallback.length > 300) {
            return fallback.slice(0, 12000);
        }

        return null;

    } catch (err) {
        return null;
    }
}
