import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { fuseEvidence } from "../lib/fusion.js";

function isValidText(text) {
    return typeof text === "string" &&
        text.trim().split(/\s+/).length >= 80;
}

function safeJson(res, payload, status = 200) {
    res.setHeader("Content-Type", "application/json");
    return res.status(status).json(payload);
}

/**
 * SIMPLE DETERMINISTIC SCORING MODEL (replace ML guesswork)
 */
function computeScores({ signal, rhetoric, framing, length }) {

    const persuasion = Math.min(
        1,
        (rhetoric?.persuasion_score ?? 0) * 0.6 +
        (signal / 3) * 0.2 +
        Math.min(length / 8000, 1) * 0.2
    );

    const framingBalance = framing?.balance_score ?? 0;

    const risk = Math.min(
        1,
        persuasion * (1 - framingBalance * 0.3)
    );

    return {
        persuasion,
        risk,
        confidence: Math.min(1, 0.5 + (length / 10000))
    };
}

/**
 * EXTRACT CLAIM-LIKE STRUCTURE (lightweight, no NLP deps)
 */
function extractClaims(text) {
    const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 30);

    return sentences
        .filter(s => s.length > 60)
        .slice(0, 8)
        .map(s => ({
            claim: s.trim(),
            type: /said|claims|according|reports/i.test(s)
                ? "attributed"
                : "assertion"
        }));
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
        let text = normalizeInput(input, type);

        const layers = [];

        // -----------------------
        // WEB PIPELINE
        // -----------------------
        if (type === "web") {
            let extracted = null;

            try {
                extracted = await extractWebpageText(input);
            } catch {
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
                    report: null
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

        const canonicalText = fused?.text || "";

        if (!isValidText(canonicalText)) {
            return safeJson(res, {
                ok: false,
                error: "insufficient_text",
                report: null
            });
        }

        // -----------------------
        // ANALYSIS MODULES
        // -----------------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);
        const claims = extractClaims(canonicalText);

        const scores = computeScores({
            signal,
            rhetoric,
            framing,
            length: canonicalText.length
        });

        // -----------------------
        // FINAL REPORT OBJECT
        // -----------------------
        const report = {
            meta: {
                source_type: type,
                signal_level: signal,
                text_length: canonicalText.length
            },

            summary: {
                brief: canonicalText.slice(0, 600),
                claims
            },

            influence: {
                persuasion_intensity: scores.persuasion,
                risk_index: scores.risk,
                confidence: scores.confidence
            },

            rhetoric: {
                signals: rhetoric?.signals ?? [],
                persuasion_score: rhetoric?.persuasion_score ?? 0
            },

            framing: {
                primary_frame: framing?.primary_frame ?? "unknown",
                balance_score: framing?.balance_score ?? 0,
                missing_perspectives: framing?.missing_perspectives ?? []
            },

            layers
        };

        return safeJson(res, {
            ok: true,
            report
        });

    } catch (err) {
        return safeJson(res, {
            ok: false,
            error: "internal_error",
            message: err?.message || "unknown"
        }, 500);
    }
}
