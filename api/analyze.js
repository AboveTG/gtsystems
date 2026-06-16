import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function isValidNarrative(text) {
    if (!text) return false;

    const words = text.trim().split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    return words > 100 && sentences > 2;
}

export default async function handler(req, res) {

    try {

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const input = req.body?.input || "";

        if (!input.trim()) {
            return res.status(400).json({ error: "No input provided" });
        }

        console.log("INPUT:", input);

        const type = classifyInput(input);

        let text = normalizeInput(input, type);
        let layers = [];

        // ----------------------------
        // WEB INGESTION
        // ----------------------------
        if (type === "web") {

            const extracted = await extractWebpageText(input);

            layers.push({
                layer: "webpage",
                status: extracted ? "hit" : "miss",
                weight: extracted ? 1 : 0.2
            });

            if (!extracted) {
                return res.status(200).json({
                    error: "web_extraction_failed",
                    signal_level: 0,
                    analysis_quality: 0,
                    rhetoric: null,
                    framing: null,
                    layers
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
        layer: "input",
        status: "hit",
        weight: 1,
        text
    },
    ...(type === "web"
        ? [{
            layer: "web",
            status: "hit",
            weight: 1,
            text
        }]
        : [])
]);

       const canonicalText = (fused?.text || "").trim();

        // ----------------------------
        // VALIDATION GATE
        // ----------------------------
        if (!canonicalText || canonicalText.length < 60) {
    return res.status(200).json({
        error: "empty_canonical_text",
        signal_level: signal,
        analysis_quality: 0,
        layers: fused.layers,
        debug: {
            reason: "fusion_output_invalid",
            length: canonicalText.length
        }
    });
}

        // ----------------------------
        // ANALYSIS
        // ----------------------------
        const rhetoric = rhetoricalScan(canonicalText);
        let framing = null;

try {
    framing = framingScan(canonicalText);
} catch (e) {
    console.error("framingScan failed:", e.message);
    framing = {
        primary_frame: "unknown",
        balance_score: 0,
        missing_perspectives: ["analysis_failed"]
    };
}

        const analysis_quality = computeAnalysisQuality({
    layers: fused.layers,
    signalLevel: signal,
    modelConfidence: 0.6
});

        return res.status(200).json({
    source_type: type,
    signal_level: signal,
    analysis_quality,

    debug: {
        extracted_length: text?.length || 0,
        canonical_length: canonicalText?.length || 0,
        first_500_chars: canonicalText?.slice(0, 500) || ""
    },

    layers: fused.layers,

    rhetoric,
    framing
});

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
