import { rhetoricalScan } from "../lib/rhetoric.js";
import { framingScan } from "../lib/framing.js";
import { fuseEvidence } from "../lib/fusion.js";
import { computeAnalysisQuality } from "../lib/confidence.js";
import {
    classifyInput,
    extractYouTubeId,
    normalizeInput,
    signalLevel
} from "../lib/ingestion.js";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string" ? body.input :
        typeof body.text === "string" ? body.text :
        "";

    if (!input.trim()) {
        return res.status(400).json({ error: "No input provided" });
    }

    // -----------------------------
    // CLASSIFY
    // -----------------------------
    const type = classifyInput(input);
    let text = normalizeInput(input, type);

    let layers = [];
    let source_type = type;

    // -----------------------------
    // YOUTUBE EXTRACTION (optional)
    // -----------------------------
    async function fetchTranscript(videoId) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;
            const t = await yt.fetchTranscript(videoId);
            return t.map(x => x.text).join(" ").replace(/\s+/g, " ").trim();
        } catch {
            return null;
        }
    }

    if (type === "youtube") {

        const videoId = extractYouTubeId(input);

        layers.push({
            layer: "youtube_id",
            status: videoId ? "hit" : "miss",
            weight: 0.8
        });

        const transcript = videoId ? await fetchTranscript(videoId) : null;

        if (transcript) {
            text = transcript;
            layers.push({ layer: "youtube_transcript", status: "hit", weight: 1 });
        } else {
            text = "";
            layers.push({ layer: "youtube_transcript", status: "miss", weight: 0 });
        }
    }

    if (type === "web" || type === "tiktok" || type === "tweet") {
        layers.push({ layer: type, status: "hit", weight: 0.7 });
    }

    if (!text || text.trim().length === 0) {
        return res.status(200).json({
            error: "No analyzable content extracted",
            source_type: type,
            layers,
            signal_level: 0,
            rhetoric: null,
            framing: null,
            analysis_quality: 0
        });
    }

    // -----------------------------
    // SIGNAL GATE
    // -----------------------------
    const signal = signalLevel(text);

    // -----------------------------
    // FUSE EVIDENCE
    // -----------------------------
    const fused = fuseEvidence(
        layers.map(l => ({
            ...l,
            text: text
        }))
    );

    // -----------------------------
    // RHETORIC + FRAMING
    // -----------------------------
    const rhetoric = rhetoricalScan(fused.canonical.segments.map(s => s.text).join("\n\n"));
    const framing = framingScan(fused.canonical.segments.map(s => s.text).join("\n\n"));

    // -----------------------------
    // QUALITY SCORE
    // -----------------------------
    const analysis_quality = computeAnalysisQuality({
        layers: fused.layers,
        signalLevel: signal
    });

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({

        source_type: type,
        signal_level: signal,

        layers: fused.layers,

        rhetoric,
        framing,
        analysis_quality,

        canonical: fused.canonical
    });
}
