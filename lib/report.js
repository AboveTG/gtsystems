export function generateReport({
    text = "",
    sourceType = "unknown",
    signalLevel = 0,
    analysisQuality = 0,
    rhetoric = {},
    framing = {}
}) {
    const persuasion = rhetoric?.persuasion_score ?? 0;

    // -----------------------------
    // PROPAGANDA SCALE (NEW CORE METRIC)
    // -----------------------------
    const propagandaScore = Math.round(persuasion * 100);

    let propagandaLabel = "Low influence";

    if (propagandaScore > 70) {
        propagandaLabel = "High influence";
    } else if (propagandaScore > 40) {
        propagandaLabel = "Moderate influence";
    }

    const frame = framing?.primary_frame || "unknown";

    const summary = buildSummary(text, 3);

    const laymanSummary = buildLaymanSummary(
        propagandaLabel,
        frame,
        framing?.missing_perspectives || []
    );

    return {
        meta: {
            source_type: sourceType,
            signal_level: signalLevel,
            analysis_quality: analysisQuality
        },

        summary: {
            brief: summary,
            explanation: laymanSummary
        },

        influence: {
            propaganda_score: propagandaScore,
            label: propagandaLabel,
            emotional_vector: rhetoric?.emotional_vector || {}
        },

        framing,

        rhetoric,

        conclusions: buildConclusions(
            propagandaLabel,
            frame,
            framing?.missing_perspectives || []
        )
    };
}

// -----------------------------
// SAFE SUMMARY ENGINE (FIXED)
// -----------------------------
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

function buildLaymanSummary(propLabel, frame, missing) {
    let msg = `This content is mainly framed as ${frame}. `;

    msg += `Influence level: ${propLabel}. `;

    if (missing.length) {
        msg += `Missing viewpoints may include: ${missing.join(", ")}.`;
    }

    return msg;
}

function buildConclusions(propLabel, frame, missing) {
    const conclusions = [];

    conclusions.push(`Primary framing: ${frame}.`);
    conclusions.push(`Influence level: ${propLabel}.`);

    if (missing.length) {
        conclusions.push(`Missing perspectives: ${missing.join(", ")}.`);
    }

    return conclusions;
}
