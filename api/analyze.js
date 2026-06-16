import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { fuseEvidence } from "../lib/fusion.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import {
    classifyInput,
    normalizeInput,
    signalLevel
} from "../lib/ingestion.js";

import { extractWebpageText } from "../lib/layers/webpage.js";

console.log("INPUT:", input);
console.log("CLASSIFIED TYPE:", type);

function isValidNarrative(text) {
    if (!text) return false;

    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;

    return words > 150 && sentences > 3;
}

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const input = req.body?.input || "";

    if (!input.trim()) {
        return res.status(400).json({ error: "No input provided" });
    }

    const classification = classifyInput(input);
const type = classification.type;

layers.push({
    layer: "classification",
    status: type,
    weight: classification.confidence || 0.5
});
    let text = normalizeInput(input, type);
    let layers = [];

    // ----------------------------
    // WEB EXTRACTION FIX
    // ----------------------------
const isWeb =
    type === "web" ||
    classification.type === "web";

if (isWeb) {

    const extracted = await extractWebpageText(input);

    layers.push({
        layer: "webpage",
        status: extracted ? "hit" : "miss",
        weight: extracted ? 1 : 0.2
    });

    if (!extracted) {
        return res.status(200).json({
            error: "web_extraction_failed",
            classification,
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
            layer: type,
            status: "hit",
            weight: 0.8,
            text
        }
    ]);

    const canonicalText = fused.canonical.segments
        .map(s => s.text)
        .join(" ");

    // ----------------------------
    // HARD VALIDATION GATE
    // ----------------------------
    if (!isValidNarrative(canonicalText)) {
        return res.status(200).json({
            error: "Insufficient narrative structure for influence analysis",
            signal_level: signal,
            analysis_quality: 0,
            rhetoric: null,
            framing: null,
            layers: fused.layers
        });
    }

    // ----------------------------
    // ANALYSIS
    // ----------------------------
    const rhetoric = rhetoricalScan(canonicalText);
    const framing = framingScan(canonicalText);

    const analysis_quality = computeAnalysisQuality({
        layers: fused.layers,
        signalLevel: signal
    });

    return res.status(200).json({
        source_type: type,
        signal_level: signal,
        analysis_quality,

        layers: fused.layers,

        rhetoric,
        framing,

        canonical: fused.canonical
    });
}
