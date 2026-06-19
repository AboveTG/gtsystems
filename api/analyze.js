import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";
import { buildReport } from "../lib/report.js";

function safeJson(res, payload, status = 200) {
    res.setHeader("Content-Type", "application/json");
    return res.status(status).json(payload);
}

function isValidText(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 80;
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
        // WEB EXTRACTION
        // -------------------------
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
                    meta: {
                        source_type: "web"
                    },
                    layers
                });
            }

            text = extracted;
        }

        // -------------------------
        // SIGNAL
        // -------------------------
        const signal = signalLevel(text);

        let fused;
        try {
            fused = fuseEvidence([
                {
                    layer: type,
                    status: "hit",
                    weight: 1,
                    text
                }
            ]);
        } catch (e) {
            return safeJson(res, {
                ok: false,
                error: "fusion_crash",
                message: e.message,
                meta: { source_type: type, signal_level: signal }
            });
        }

        const canonicalText = fused?.text || "";

        if (!isValidText(canonicalText)) {
            return safeJson(res, {
                ok: false,
                error: "insufficient_text",
                meta: {
                    source_type: type,
                    signal_level: signal
                },
                layers: fused?.layers || []
            });
        }

        // -------------------------
        // ANALYSIS
        // -------------------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const report = buildReport({
            text: canonicalText,
            rhetoric,
            framing
        });

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        // -------------------------
        // SUMMARY (robust fallback)
        // -------------------------
        const sentences = canonicalText.split(/(?<=[.!?])\s+/);
        const summary = sentences.slice(0, 5).join(" ").slice(0, 900);

        return safeJson(res, {
            ok: true,

            meta: {
                source_type: type,
                signal_level: signal,
                analysis_quality
            },

            content: {
                summary: summary || "No summary available.",
                persuasion_intensity: rhetoric?.persuasion_score ?? 0,
                framing,
                techniques: rhetoric?.signals ?? []
            },

            layers: fused.layers || [],

            debug: {
                text_length: canonicalText.length
            }
        });

    } catch (err) {
            return safeJson(res, {

        ok: true,

        meta: {
            source_type: type,
            signal_level: signal,
            analysis_quality
        },

        report,

        debug: {
            text_length: canonicalText.length
        }
    });
