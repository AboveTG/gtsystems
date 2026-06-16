import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

/**
 * STANDARD RESPONSE CONTRACT
 * Every response MUST match this shape
 */
function ok(data) {
    return {
        ok: true,
        timestamp: Date.now(),
        ...data
    };
}

function fail(error, extra = {}) {
    return {
        ok: false,
        timestamp: Date.now(),
        error,
        ...extra
    };
}

/**
 * SAFE JSON RESPONSE (guaranteed valid)
 */
function send(res, payload, status = 200) {
    res.status(status);
    res.setHeader("Content-Type", "application/json");
    return res.json(payload);
}

function isValidNarrative(text) {
    if (!text || typeof text !== "string") return false;

    const words = text.trim().split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    return words > 80 && sentences > 2;
}

export default async function handler(req, res) {

    try {

        // ----------------------------
        // METHOD GUARD
        // ----------------------------
        if (req.method !== "POST") {
            return send(res, fail("method_not_allowed"), 405);
        }

        const input = req.body?.input;

        if (!input || typeof input !== "string" || !input.trim()) {
            return send(res, fail("missing_input"), 400);
        }

        const type = classifyInput(input);
        let text = normalizeInput(input, type);

        let layers = [];

        // ----------------------------
        // WEB EXTRACTION
        // ----------------------------
        if (type === "web") {

            const extracted = await extractWebpageText(input);

            layers.push({
                layer: "webpage",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return send(res, ok({
                    source_type: type,
                    signal_level: 0,
                    analysis_quality: 0,
                    layers,
                    rhetoric: null,
                    framing: null,
                    note: "web_extraction_failed"
                }));
            }

            text = extracted;
        }

        // ----------------------------
        // SIGNAL ENGINE
        // ----------------------------
        const signal = signalLevel(text);

        const fused = fuseEvidence([
            {
                layer: "input",
                status: "hit",
                weight: 1,
                text
            }
        ]);

        const canonicalText = fused?.text || "";

        if (!isValidNarrative(canonicalText)) {
            return send(res, ok({
                source_type: type,
                signal_level: signal,
                analysis_quality: 0,
                layers: fused.layers,
                rhetoric: null,
                framing: null,
                note: "insufficient_narrative"
            }));
        }

        // ----------------------------
        // ANALYSIS LAYERS
        // ----------------------------
        let rhetoric = null;
        let framing = null;

        try {
            rhetoric = rhetoricalScan(canonicalText);
        } catch (e) {
            rhetoric = { error: "rhetoric_failed" };
        }

        try {
            framing = framingScan(canonicalText);
        } catch (e) {
            framing = { error: "framing_failed" };
        }

        // ----------------------------
        // QUALITY SCORE
        // ----------------------------
        let analysis_quality = 0;

        try {
            analysis_quality = computeAnalysisQuality({
                layers: fused.layers,
                signalLevel: signal,
                rhetoric,
                framing
            });
        } catch (e) {
            analysis_quality = 0;
        }

        // ----------------------------
        // FINAL RESPONSE
        // ----------------------------
        return send(res, ok({
            source_type: type,
            signal_level: signal,
            analysis_quality,

            layers: fused.layers,

            rhetoric,
            framing,

            debug: {
                input_length: text.length,
                canonical_length: canonicalText.length
            }
        }));

    } catch (err) {

        // ----------------------------
        // GLOBAL CATCH (NEVER BREAK JSON)
        // ----------------------------
        return send(res, fail("internal_error", {
            message: err.message
        }), 500);
    }
}
