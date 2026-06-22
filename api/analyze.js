import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function safeJson(res, payload, status = 200) {
    res.setHeader("Content-Type", "application/json");
    return res.status(status).json(payload);
}

function isValidText(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 60;
}

/**
 * Clean + stabilize extracted content
 */
function sanitizeText(text = "") {
    return text
        .replace(/Watch:/gi, "")
        .replace(/Subscribe|Sign up|Cookie|Advertisement/gi, "")
        .replace(/\s+/g, " ")
        .replace(/\[[^\]]+\]/g, "")
        .trim();
}

/**
 * Stable summary builder (no UI contamination)
 */
function buildSummary(text) {
    const cleaned = sanitizeText(text);

    const sentences = cleaned
        .split(/(?<=[.!?])\s+/)
        .filter(s =>
            s.length > 40 &&
            !s.includes("http") &&
            !/cookie|subscribe|sign up|advert/i.test(s)
        );

    return sentences.slice(0, 3).join(" ").slice(0, 650);
}

/**
 * User-friendly framing label
 */
function mapFrameLabel(frame) {
    const map = {
        crisis: "Crisis / urgency framing",
        conflict: "Conflict framing",
        economic: "Economic framing",
        political: "Political framing",
        moral: "Moral framing",
        opportunity: "Opportunity framing"
    };
    return map[frame] || "Unclassified framing";
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
        }

        const input = req.body?.input;

        if (!input || typeof input !== "string") {
            return safeJson(res, { ok: false, error: "missing_input" }, 400);
        }

        const type = classifyInput(input);
        let text = normalizeInput(input);

        const layers = [];

        // -------------------------
        // EXTRACTION
        // -------------------------
        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch {
                extracted = null;
            }

            layers.push({
                layer: "web_content",
                status: extracted ? "success" : "failed",
                reliability: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return safeJson(res, {
                    ok: false,
                    error: "extraction_failed",
                    hint: "Could not reliably extract article content"
                });
            }

            text = extracted;
        }

        const signal = signalLevel(text);

        const fused = fuseEvidence([
            {
                layer: type,
                status: "success",
                weight: 1,
                text
            }
        ]);

        const canonicalText = sanitizeText(fused.text || "");

        if (!isValidText(canonicalText)) {
            return safeJson(res, {
                ok: false,
                error: "insufficient_content",
                hint: "Not enough usable text after cleaning"
            });
        }

        // -------------------------
        // ANALYSIS
        // -------------------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysisQuality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        // -------------------------
        // OUTPUT
        // -------------------------
        const summary = buildSummary(canonicalText);

        const response = {
            ok: true,

            meta: {
                content_type: type,
                signal_strength: signal,
                analysis_quality: analysisQuality
            },

            content: {
                summary,

                persuasion_score: rhetoric?.persuasion_score ?? 0,

                emotional_profile: rhetoric?.emotional_vector ?? {
                    fear: 0,
                    urgency: 0,
                    hope: 0,
                    anger: 0
                },

                framing: {
                    primary: mapFrameLabel(framing.primary_frame),
                    raw: framing.frames,
                    missing_perspectives: framing.missing_perspectives
                },

                techniques: rhetoric?.signals ?? []
            },

            debug: {
                text_length: canonicalText.length
            }
        };

        return safeJson(res, response);

    } catch (err) {
        console.error("ANALYZE ERROR:", err);

        return safeJson(res, {
            ok: false,
            error: "internal_error",
            message: err?.message || "unknown"
        }, 500);
    }
}
