import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";
import { generateReport } from "../lib/report.js";

function safeJson(res, payload, status = 200) {
    res.setHeader("Content-Type", "application/json");
    return res.status(status).json(payload);
}

function isValidText(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 60;
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

        let layers = [];

        // -------------------------
        // WEB EXTRACTION
        // -------------------------
        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch {
                extracted = null;
            }

            layers.push({
                layer: "webpage",
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

        // -------------------------
        // SIGNAL
        // -------------------------
        const signal = signalLevel(text);

        const fused = fuseEvidence([
            {
                layer: type,
                status: "hit",
                weight: 1,
                text
            }
        ]);

        const canonicalText = fused.text?.trim() || "";

        if (!isValidText(canonicalText)) {
            return safeJson(res, {
                ok: false,
                error: "insufficient_text",
                layers: fused.layers || []
            });
        }

        // -------------------------
        // ANALYSIS CORE
        // -------------------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        // -------------------------
        // REPORT
        // -------------------------
        report: generateReport({
    text: canonicalText,
    sourceType: type,
    signalLevel: signal,
    analysisQuality: analysis_quality,
    rhetoric,
    framing
})

        return safeJson(res, {
            ok: true,
            meta: report.meta,
            report,
            debug: {
                text_length: canonicalText.length
            }
        });

    } catch (err) {
        console.error("ANALYZE CRASH:", err);

        return safeJson(res, {
            ok: false,
            error: "internal_server_error",
            message: err?.message || "unknown_error"
        }, 500);
    }
}
