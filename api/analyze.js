import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function safeJson(res, payload, status = 200) {
    res.status(status).setHeader("Content-Type", "application/json");
    return res.json(payload);
}

function isValidText(text) {
    if (!text || typeof text !== "string") return false;
    const words = text.trim().split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;
    return words >= 100 && sentences >= 2;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return safeJson(res, { error: "Method not allowed" }, 405);
        }

        const input = req.body?.input;

        if (!input || typeof input !== "string" || !input.trim()) {
            return safeJson(res, { error: "No input provided" }, 400);
        }

        const type = classifyInput(input);
        let text = normalizeInput(input, type);

        const layers = [];

        // ---------------- WEB ----------------
        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch (e) {
                extracted = null;
            }

            layers.push({
                layer: "webpage",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return safeJson(res, {
                    source_type: type,
                    signal_level: 0,
                    analysis_quality: 0,
                    error: "web_extraction_failed",
                    layers
                });
            }

            text = extracted;
        }

        const signal = signalLevel(text);

        const fused = fuseEvidence([
            {
                layer: type,
                status: "hit",
                weight: 1,
                text
            }
        ]);

        const canonicalText = (fused.text || "").trim();

        if (!isValidText(canonicalText)) {
            return safeJson(res, {
                source_type: type,
                signal_level: signal,
                analysis_quality: 0,
                error: "insufficient_text",
                layers: fused.layers
            });
        }

        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        return safeJson(res, {
            source_type: type,
            signal_level: signal,
            analysis_quality,

            persuasion_intensity: rhetoric?.persuasion_score ?? 0,
            emotional_vector: rhetoric?.vector ?? null,

            framing,
            rhetoric,
            layers: fused.layers,

            ground_truth: {
                summary: canonicalText.slice(0, 600)
            }
        });

    } catch (err) {
        // CRITICAL: NEVER BREAK JSON CONTRACT
        return safeJson(res, {
            error: "internal_error",
            message: err?.message || "unknown failure"
        }, 500);
    }
}
