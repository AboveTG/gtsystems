// lib/layers/webpage.js

function decodeHtml(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function stripScripts(html = "") {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function stripTags(html = "") {
    return html.replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(text = "") {
    return text
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
}

// -----------------------------
// QUALITY SCORING (more stable)
// -----------------------------
function scoreParagraph(p) {
    const words = p.split(/\s+/).length;

    if (words < 15) return 0;

    let score = words;

    if (/[.!?]/.test(p)) score += 10;
    if (/[A-Z]/.test(p)) score += 3;

    return score;
}

// -----------------------------
// SEGMENT EXTRACTION (robust)
// -----------------------------
function extractNarrativeBlocks(text = "") {
    const chunks = text
        .split(/\n{2,}|\.\s{2,}/)
        .map(x => x.trim())
        .filter(Boolean);

    const scored = chunks.map(chunk => ({
        text: chunk,
        score: scoreParagraph(chunk)
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map(x => x.text)
        .join("\n\n");
}

// -----------------------------
// HTML CLEANING CORE
// -----------------------------
function extractMainText(html = "") {
    const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
        .replace(/<form[\s\S]*?<\/form>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return decodeHtml(text);
}

// -----------------------------
// SEGMENT FILTERING (looser + safer)
// -----------------------------
function extractBestSegment(text = "") {

    const segments = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 40);

    const scored = segments.map(s => ({
        text: s,
        score: s.split(/\s+/).length
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map(s => s.text)
        .join(" ");
}

// -----------------------------
// MAIN EXPORT
// -----------------------------
export async function extractWebpageText(url) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (!res.ok) return null;

        const html = await res.text();

        if (!html || html.length < 1000) return null;

        // ----------------------------
        // 1. isolate article blocks first
        // ----------------------------
        let articleMatch = html.match(/<article[\s\S]*?<\/article>/i);

        let source = articleMatch ? articleMatch[0] : html;

        // ----------------------------
        // 2. strip scripts/styles
        // ----------------------------
        source = source
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
            .replace(/<header[\s\S]*?<\/header>/gi, " ")
            .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

        // ----------------------------
        // 3. extract paragraphs
        // ----------------------------
        const paragraphs = source
            .match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];

        const cleaned = paragraphs
            .map(p =>
                p
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
            )
            .filter(p => p.length > 40)
            .sort((a, b) => b.length - a.length)
            .slice(0, 30)
            .join("\n\n");

        if (cleaned.split(/\s+/).length < 80) {
            return null;
        }

        return cleaned.slice(0, 20000);

    } catch (err) {
        console.error("extractWebpageText error:", err.message);
        return null;
    }
}

        // -----------------------------
        // SAFE VALIDATION (FIXED)
        // -----------------------------
        const wordCount = cleaned.split(/\s+/).length;
        const hasLetters = /[a-zA-Z]{15,}/.test(cleaned);

        if (!hasLetters) return null;

        // IMPORTANT: lowered threshold to avoid false failures
        if (wordCount < 40) {
            return null;
        }

        // final cleanup
        cleaned = normalizeWhitespace(cleaned);

        return cleaned.slice(0, 20000);

    } catch (err) {

        console.error("extractWebpageText error:", err.message);

        return null;
    }
}
