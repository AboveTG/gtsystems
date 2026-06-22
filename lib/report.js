export function generateReport({
    text = "",
    sourceType = "unknown",
    signalLevel = 0,
    analysisQuality = 0,
    rhetoric = {},
    framing = {}
}) {
    const influenceScore = Math.round((rhetoric?.persuasion_score ?? 0) * 100);

    const influenceLabel = getInfluenceLabel(influenceScore);

    const frame = framing?.primary_frame || "unknown";

    const summary = buildSummary(text, 3);

    return {
        meta: {
            source: sourceType,
            confidence: formatConfidence(analysisQuality)
        },

        overview: {
            summary,
            main_theme: frame,
            framing_explanation: explainFrame(frame)
        },

        influence: {
            score: influenceScore,
            level: influenceLabel
        },

        breakdown: {
            framing,
            signals: rhetoric?.signals || [],
            emotional_tone: rhetoric?.emotional_vector || {}
        },

        missing_context: framing?.missing_perspectives || [],

        verdict: buildVerdict(frame, influenceLabel, framing?.missing_perspectives || [])
    };
}

/* -----------------------------
   HUMAN LANGUAGE LAYERS
------------------------------*/

function getInfluenceLabel(score) {
    if (score < 30) return "Low";
    if (score < 60) return "Moderate";
    return "High";
}

function formatConfidence(score) {
    if (score < 0.25) return "Low";
    if (score < 0.5) return "Medium";
    if (score < 0.75) return "High";
    return "Very high";
}

function explainFrame(frame) {
    const map = {
        crisis: "Focus on urgent or threatening developments",
        conflict: "Focus on disagreement or opposing sides",
        economic: "Focus on financial or cost impact",
        political: "Focus on government or power dynamics",
        moral: "Focus on ethical judgment or wrongdoing",
        opportunity: "Focus on positive outcomes or growth"
    };

    return map[frame] || "General informational framing";
}

function buildVerdict(frame, influence, missing) {
    const parts = [];

    parts.push(`Primary framing: ${frame}.`);
    parts.push(`Influence level: ${influence}.`);

    if (missing.length) {
        parts.push(`Missing perspectives: ${missing.join(", ")}.`);
    }

    return parts.join(" ");
}

/* -----------------------------
   SUMMARY ENGINE
------------------------------*/

function buildSummary(text, maxSentences = 3) {
    if (!text || typeof text !== "string") return "-";

    const cleaned = text
        .replace(/\s+/g, " ")
        .replace(/([.!?])\s+(?=[A-Z])/g, "$1|")
        .split("|")
        .map(s => s.trim())
        .filter(s => s.length > 40);

    return cleaned.slice(0, maxSentences).join(" ");
}
