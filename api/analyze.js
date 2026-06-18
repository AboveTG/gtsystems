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

function isValidText(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 80;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return json(res, 405, { ok: false, error: "method_not_allowed" });
        }

        let input = req.body?.input;

        if (!input || typeof input !== "string") {
            return json(res, 400, { ok: false, error: "missing_input" });
        }

        input = input.trim();
        const type = classifyInput(input);

        let text = normalizeInput(input);

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
                layer: "web",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return json(res, 200, {
                    ok: false,
                    error: "web_extraction_failed",
                    meta: { source_type: "web" },
                    layers
                });
            }

            text = extracted;
        }

        // ---------------- FUSION ----------------
        const fused = fuseEvidence([
            { layer: type, status: "hit", weight: 1, text }
        ]);

        const canonicalText = (fused.text || "").trim();

        if (!isValidText(canonicalText)) {
            return json(res, 200, {
                ok: false,
                error: "insufficient_text",
                meta: { source_type: type },
                layers: fused.layers
            });
        }

        // ---------------- ANALYSIS ----------------
        const signal = signalLevel(canonicalText);
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        // deterministic summary (no brittle splits)
        const summary = canonicalText.slice(0, 800);

        return json(res, 200, {
            ok: true,

            meta: {
                source_type: type,
                signal_level: signal,
                analysis_quality
            },

            content: {
                summary,
                persuasion_intensity: rhetoric.persuasion_score,
                emotional_vector: {
                    fear: 0,
                    urgency: 0,
                    hope: 0,
                    anger: 0
                },
                framing,
                techniques: rhetoric.signals
            },

            layers: fused.layers,

            debug: {
                text_length: canonicalText.length
            }
        });

    } catch (err) {
        return json(res, 500, {
            ok: false,
            error: "internal_error",
            message: String(err?.message || err)
        });
    }
}
