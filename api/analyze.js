import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { fuseEvidence } from "../lib/fusion.js";
import { computeAnalysisQuality } from "../lib/confidence.js";

export default async function handler(req, res) {

    // ---------------- SAFE ENTRY ----------------
    if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: "method_not_allowed" }));
    }

    try {

        const input = req.body?.input;

        if (!input || typeof input !== "string") {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: "missing_input" }));
        }

        const type = classifyInput(input);
        let text = normalizeInput(input, type);

        let layers = [];

        // ---------------- WEB ----------------
        if (type === "web") {

            const extracted = await extractWebpageText(input);

            layers.push({
                layer: "webpage",
                status: extracted ? "hit" : "miss",
                weight: 1
            });

            if (!extracted) {
                return res.end(JSON.stringify({
                    source_type: type,
                    signal_level: 0,
                    analysis_quality: 0,
                    layers
                }));
            }

            text = extracted;
        }

        const signal = signalLevel(text);

        const fused = fuseEvidence([
            { layer: "input", status: "hit", weight: 1, text }
        ]);

        const canonical = fused?.text || "";

        const rhetoric = rhetoricalScan(canonical);
        const framing = framingScan(canonical);

        const analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });

        return res.end(JSON.stringify({
            source_type: type,
            signal_level: signal,
            analysis_quality,
            layers: fused.layers,
            rhetoric,
            framing
        }));

    } catch (err) {

        return res.end(JSON.stringify({
            error: "internal_error",
            message: err.message
        }));
    }
}
