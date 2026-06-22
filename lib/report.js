export function generateReport({
    text = "",
    sourceType = "unknown",
    signalLevel = 0,
    analysisQuality = 0,
    rhetoric = {},
    framing = {}
}) {
    const persuasion = rhetoric?.persuasion_score ?? 0;

    let risk = "Low";
    if (persuasion > 0.6) risk = "High";
    else if (persuasion > 0.3) risk = "Moderate";

    const summary = text
        .split(/[.!?]+/)
        .filter(Boolean)
        .slice(0, 3)
        .join(". ")
        .trim();

    const frame = framing?.primary_frame || "unknown";

    return {
        meta: {
            source_type: sourceType,
            signal_level: signalLevel,
            analysis_quality: analysisQuality
        },

        summary: {
            short: summary,
            plain_english: buildLaymanSummary(risk, frame, framing?.missing_perspectives || [])
        },

        influence: {
            persuasion_score: persuasion,
            persuasion_label: risk,
            emotional_vector: rhetoric?.emotional_vector || {}
        },

        framing,

        conclusions: [
            `Main angle: ${frame}`,
            `Persuasion level: ${risk}`,
            ...(framing?.missing_perspectives?.length
                ? [`Missing viewpoints: ${framing.missing_perspectives.join(", ")}`]
                : [])
        ]
    };
}

function buildLaymanSummary(risk, frame, missing) {
    let msg = `This article mainly uses a ${frame} angle. `;

    if (risk === "High") {
        msg += "It strongly pushes a viewpoint. ";
    } else if (risk === "Moderate") {
        msg += "It uses some persuasive language. ";
    } else {
        msg += "It stays mostly informational. ";
    }

    if (missing.length) {
        msg += `It may be missing: ${missing.join(", ")}.`;
    }

    return msg;
}
