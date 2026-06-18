import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function safeJson(res, payload, status = 200) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(status).json(payload);
}

function isValidText(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 60;
}

export default async function handler(req, res) {
    try {
        res.setHeader("Content-Type", "application/json");

        if (req.method !== "POST") {
            return res.status(405).json({ ok: false, error: "method_not_allowed" });
        }

        const input = req.body?.input;

        if (!input || typeof input !== "string") {
            return res.status(400).json({ ok: false, error: "missing_input" });
        }

        const type = classifyInput(input);
        let text = normalizeInput(input);

        const layers = [];

        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch (e) {
                console.error("extract crash:", e);
                extracted = null;
            }

            layers.push({
                layer: "web",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return res.status(200).json({
                    ok: false,
                    error: "web_extraction_failed",
                    layers
                });
            }

            text = extracted;
        }

        const signal = signalLevel(text);

        let fused;
        try {
            fused = fuseEvidence([{ layer: type, status: "hit", weight: 1, text }]);
        } catch (e) {
            console.error("fusion crash:", e);
            return res.status(200).json({
                ok: false,
                error: "fusion_failed",
                signal_level: signal
            });
        }

        const canonicalText = fused?.text || "";

        if (canonicalText.split(/\s+/).length < 60) {
            return res.status(200).json({
                ok: false,
                error: "insufficient_text",
                signal_level: signal
            });
        }

        let rhetoric = {};
        let framing = {};

        try {
            rhetoric = rhetoricalScan(canonicalText);
            framing = framingScan(canonicalText);
        } catch (e) {
            console.error("analysis crash:", e);
        }

        const analysis_quality = 0.5; // temporary stable fallback

        return res.status(200).json({
            ok: true,

            meta: {
                source_type: type,
                signal_level: signal,
                analysis_quality
            },

            content: {
                summary: canonicalText.slice(0, 600),
                persuasion_intensity: rhetoric?.persuasion_score ?? 0,
                emotional_vector: rhetoric?.emotional_vector ?? {},
                framing,
                techniques: rhetoric?.signals ?? []
            },

            layers,

            debug: {
                text_length: canonicalText.length
            }
        });

    } catch (err) {
        console.error("GLOBAL FAIL:", err);

        return res.status(200).json({
            ok: false,
            error: "fatal_server_error",
            message: String(err)
        });
    }
}
