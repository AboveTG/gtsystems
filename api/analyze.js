import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function json(res, status, payload) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return json(res, 405, { ok: false, error: "method_not_allowed" });
        }

        // ---------------- SAFE BODY PARSE ----------------
        let input = "";

        try {
            input = req.body?.input ?? "";
        } catch (e) {
            return json(res, 400, {
                ok: false,
                error: "invalid_body",
                detail: String(e.message)
            });
        }

        if (typeof input !== "string" || !input.trim()) {
            return json(res, 400, {
                ok: false,
                error: "missing_input"
            });
        }

        const type = classifyInput(input);
        let text = normalizeInput(input);

        const debug = {
            input_type: type,
            steps: []
        };

        const layers = [];

        // ---------------- WEB LAYER ----------------
        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch (err) {
                debug.steps.push({
                    stage: "web_extraction_crash",
                    error: String(err.message || err)
                });
                extracted = null;
            }

            layers.push({
                layer: "web",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return json(res, 200, {
                    ok: false,
                    error: "web_extraction_failed",
                    layers,
                    debug
                });
            }

            text = extracted;
        }

        // ---------------- HARD SAFETY CHECK ----------------
        if (!text || typeof text !== "string") {
            return json(res, 500, {
                ok: false,
                error: "invalid_text_after_normalization",
                debug
            });
        }

        // ---------------- SIGNAL ----------------
        const signal = signalLevel(text);

        // ---------------- FUSION ----------------
        let fused;

        try {
            fused = fuseEvidence([
                { layer: type, status: "hit", weight: 1, text }
            ]);
        } catch (err) {
            return json(res, 500, {
                ok: false,
                error: "fusion_crash",
                message: String(err.message || err),
                debug
            });
        }

        const canonicalText = (fused?.text || "").trim();

        if (!canonicalText) {
            return json(res, 200, {
                ok: false,
                error: "empty_canonical_text",
                debug
            });
        }

        // ---------------- ANALYSIS ----------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers || [],
            signalLevel: signal,
            rhetoric,
            framing
        });

        return json(res, 200, {
            ok: true,

            meta: {
                source_type: type,
                signal_level: signal,
                analysis_quality
            },

            content: {
                summary: canonicalText.slice(0, 800),
                persuasion_intensity: rhetoric?.persuasion_score ?? 0,
                framing,
                techniques: rhetoric?.signals ?? []
            },

            layers: fused.layers || [],

            debug: {
                text_length: canonicalText.length,
                input_type: type
            }
        });

    } catch (err) {
        return json(res, 500, {
            ok: false,
            error: "internal_server_error",
            message: String(err?.message || err),
            stack: process.env.NODE_ENV === "development" ? err?.stack : undefined
        });
    }
}
