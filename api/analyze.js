import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";
import { extractWebpageText } from "../lib/layers/webpage.js";
import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import { fuseEvidence } from "../lib/fusion.js";

function send(res, obj, code = 200) {
    res.status(code);
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(obj));
}

function isValid(text) {
    if (!text) return false;
    const words = text.trim().split(/\s+/).length;
    const sentences = (text.match(/[.!?]/g) || []).length;
    return words > 80 && sentences > 2;
}

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return send(res, { error: "method_not_allowed" }, 405);
    }

    const input = req.body?.input;

    if (!input || typeof input !== "string") {
        return send(res, { error: "missing_input" }, 400);
    }

    const type = classifyInput(input);
    let text = normalizeInput(input, type);

    let layers = [];

    // ---------------- web ingestion ----------------
    if (type === "web") {

        const extracted = await extractWebpageText(input);

        layers.push({
            layer: "webpage",
            status: extracted ? "hit" : "miss",
            weight: extracted ? 1 : 0.2
        });

        if (!extracted) {
            return send(res, {
                source_type: type,
                signal_level: 0,
                analysis_quality: 0,
                layers,
                rhetoric: null,
                framing: null,
                note: "web_extraction_failed"
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

    const canonical = fused?.text || "";

    if (!isValid(canonical)) {
        return send(res, {
            source_type: type,
            signal_level: signal,
            analysis_quality: 0,
            layers: fused.layers,
            rhetoric: null,
            framing: null,
            note: "insufficient_text"
        });
    }

    let rhetoric = null;
    let framing = null;

    try { rhetoric = rhetoricalScan(canonical); }
    catch { rhetoric = { error: true }; }

    try { framing = framingScan(canonical); }
    catch { framing = { error: true }; }

    let analysis_quality = 0;

    try {
        analysis_quality = computeAnalysisQuality({
            layers: fused.layers,
            signalLevel: signal,
            rhetoric,
            framing
        });
    } catch {
        analysis_quality = 0;
    }

    return send(res, {
        source_type: type,
        signal_level: signal,
        analysis_quality,
        layers: fused.layers,
        rhetoric,
        framing
    });
}
