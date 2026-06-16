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

    return words >= 120 && sentences >= 3;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const input = req.body?.input;

        if (!input || !input.trim()) {
            return res.status(400).json({ error: "No input provided" });
        }

        const type = classifyInput(input);
        let text = normalizeInput(input, type);

        const layers = [];

        // ----------------------------
        // WEB EXTRACTION
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
                weight: 1,
                text
            }
        ]);

        const canonicalText = (fused.text || "").trim();

        if (!isValidText(canonicalText)) {
            return res.status(200).json({
                error: "insufficient_text",
                signal_level: signal,
                analysis_quality: 0,
                layers: fused.layers,
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

        return res.status(200).json({
            source_type: type,
            signal_level: signal,
            analysis_quality,

            layers: fused.layers,
            rhetoric,
            framing,

            debug: {
                text_length: canonicalText.length
            }
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
