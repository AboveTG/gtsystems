import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function isValidText(text) {
    if (!text || typeof text !== "string") return false;

    const words = text.trim().split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    return words >= 100 && sentences >= 2;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const input = req.body?.input;

        if (!input || typeof input !== "string" || !input.trim()) {
            return res.status(400).json({ error: "No input provided" });
        }

        const type = classifyInput(input);
        let text = normalizeInput(input, type);

        const layers = [];

        // ----------------------------
        // INGESTION
        // ----------------------------
        if (type === "web") {
            const extracted = await extractWebpageText(input);

            layers.push({
                layer: "webpage",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.15
            });

            if (!extracted) {
                return res.status(200).json({
                    source_type: type,
                    signal_level: 0,
                    analysis_quality: 0,
                    layers,
                    rhetoric: null,
                    framing: null,
                    error: "web_extraction_failed"
                });
            }

            text = extracted;
        }

        // ----------------------------
        // SIGNAL
        // ----------------------------
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

        // ----------------------------
        // HARD GATE
        // ----------------------------
        if (!isValidText(canonicalText)) {
            return res.status(200).json({
                source_type: type,
                signal_level: signal,
                analysis_quality: 0,
                layers: fused.layers,
                rhetoric: null,
                framing: null,
                error: "insufficient_text",
                debug: {
                    length: canonicalText?.length || 0
                }
            });
        }

        // ----------------------------
        // ANALYSIS LAYERS
        // ----------------------------
        const rhetoric = rhetoricalScan(canonicalText);
        const framing = framingScan(canonicalText);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        // ----------------------------
        // FINAL RESPONSE CONTRACT
        // ----------------------------
        const response = {
    source_type: type,
    signal_level: signal,
    analysis_quality,

    // ----------------------------
    // UI DISPLAY LAYERS (PRIMARY)
    // ----------------------------
    persuasion_intensity: rhetoric?.persuasion_score ?? 0,

    emotional_vector: rhetoric?.vector ?? null,

    framing: framing ?? null,

    techniques: rhetoric?.signals ?? [],

    ground_truth_summary: ground_truth?.summary ?? "",

    // ----------------------------
    // SYSTEM DATA (SECONDARY)
    // ----------------------------
    layers: fused.layers,

    confidence: analysis_quality
};

// DEBUG ONLY (NEVER USED BY UI)
const debug = {
    text_length: canonicalText.length,
    raw_rhetoric_score: rhetoric,
    raw_framing: framing
};

return res.status(200).json({
    ...response,
    debug
});
