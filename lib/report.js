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

    let persuasionRisk = "Low";

    if (persuasion > 0.60)
        persuasionRisk = "High";
    else if (persuasion > 0.30)
        persuasionRisk = "Moderate";

    const frame =
        framing?.primary_frame || "unknown";

    const summary =
        text
            .split(/[.!?]+/)
            .filter(Boolean)
            .slice(0, 4)
            .join(". ")
            .trim();

    const laymanSummary =
        buildLaymanSummary(
            persuasionRisk,
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
            layman: laymanSummary
        },

        influence: {
            persuasion_intensity: persuasion,
            risk: persuasionRisk,
            emotional_vector:
                rhetoric?.emotional_vector || {}
        },

        framing: framing,

        rhetoric: rhetoric,

        conclusions: buildConclusions(
            persuasionRisk,
            frame,
            framing?.missing_perspectives || []
        )
    };
}

function buildLaymanSummary(
    persuasionRisk,
    frame,
    missing
) {

    let msg =
        `This content primarily presents events through a ${frame} lens. `;

    if (persuasionRisk === "High") {
        msg +=
            "Strong persuasive language was detected. ";
    } else if (persuasionRisk === "Moderate") {
        msg +=
            "Some persuasive techniques were detected. ";
    } else {
        msg +=
            "The language appears mostly informational. ";
    }

    if (missing.length) {
        msg +=
            `Missing viewpoints may include: ${missing.join(", ")}.`;
    }

    return msg;
}

function buildConclusions(
    persuasionRisk,
    frame,
    missing
) {

    const conclusions = [];

    conclusions.push(
        `Primary framing detected: ${frame}.`
    );

    conclusions.push(
        `Persuasion risk assessed as ${persuasionRisk}.`
    );

    if (missing.length) {
        conclusions.push(
            `Potential missing viewpoints: ${missing.join(", ")}.`
        );
    }

    return conclusions;
}
