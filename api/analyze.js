import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function safeJson(res, obj, status = 200) {
    res.setHeader("Content-Type", "application/json");
    return res.status(status).json(obj);
}

function isValid(text) {
    return typeof text === "string" && text.split(/\s+/).length >= 60;
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
                return safeJson(res, {
                    ok: false,
                    error: "web_extraction_failed",
                    layers
                });
            }

            text = extracted;
        }

        // ---------------- SIGNAL ----------------
        const signal = signalLevel(text);

        const fused = fuseEvidence([
            {
                layer: type,
                status: "hit",
                weight: 1,
                text
            }
        ]);

        const canonical = fused?.text || "";

        if (!isValid(canonical)) {
            return safeJson(res, {
                ok: false,
                error: "insufficient_text",
                signal_level: signal
            });
        }

        const rhetoric = rhetoricalScan(canonical);
        const framing = framingScan(canonical);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        return safeJson(res, {
            ok: true,

            meta: {
                source_type: type,
                signal_level: signal,
                analysis_quality
            },

            content: {
                summary: canonical.slice(0, 700),
                persuasion_intensity: rhetoric.persuasion_score ?? 0,
                emotional_vector: rhetoric.emotional_vector ?? {
                    fear: 0,
                    urgency: 0,
                    hope: 0,
                    anger: 0
                },
                framing,
                techniques: rhetoric.signals ?? []
            },

            layers: fused.layers,

            debug: {
                text_length: canonical.length
            }
        });

    } catch (err) {
        return safeJson(res, {
            ok: false,
            error: "internal_server_error",
            message: String(err)
        }, 500);
    }
}
