export function generateReport({
    text = "",
    sourceType = "unknown",
    signalLevel = 0,
    analysisQuality = 0,
    rhetoric = {},
    framing = {}
}) {

    const persuasion =
        rhetoric?.persuasion_score ?? 0;

    // 0–100 scale (user readable)
    const propagandaScore = Math.round(persuasion * 100);

    let persuasionLabel = "Low";

    if (propagandaScore > 60) persuasionLabel = "High";
    else if (propagandaScore > 30) persuasionLabel = "Moderate";

    const frame = framing?.primary_frame || "unknown";

    // safe summary
    const summary =
        text
            .split(/[.!?]+/)
            .filter(Boolean)
            .slice(0, 3)
            .join(". ")
            .trim()
            .slice(0, 600);

    return {

        meta: {
            source_type: sourceType,
            signal_level: signalLevel,
            analysis_quality: analysisQuality
        },

        summary: {
            short: summary
        },

        analysis: {
            propaganda_score: propagandaScore,
            persuasion_level: persuasionLabel,
            primary_frame: frame
        },

        framing,

        rhetoric,

        conclusions: buildConclusions(
            persuasionLabel,
            frame,
            framing?.missing_perspectives || []
        )
    };
}

function buildConclusions(level, frame, missing) {

    const out = [];

    out.push(`Main framing: ${frame}.`);
    out.push(`Persuasion level: ${level}.`);

    if (missing.length) {
        out.push(`Missing perspectives: ${missing.join(", ")}.`);
    }

    return out;
}
