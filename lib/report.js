export function buildReport({
    text = "",
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

        summary,

        layman_summary:
            laymanSummary,

        primary_claim:
            extractPrimaryClaim(text),

        persuasion: {
            intensity: persuasion,
            risk: persuasionRisk,
            emotional_vector:
                rhetoric?.emotional_vector || {}
        },

        framing,

        rhetoric,

        narrative_risk: {
            level: persuasionRisk,
            explanation:
                laymanSummary
        },

        conclusions:
            buildConclusions(
                persuasionRisk,
                frame,
                framing?.missing_perspectives || []
            )
    };
}

function extractPrimaryClaim(text = "") {

    const sentence =
        text
            .split(/[.!?]+/)
            .map(x => x.trim())
            .filter(Boolean)[0];

    return sentence || "Unable to determine";
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

    } else if (
        persuasionRisk === "Moderate"
    ) {

        msg +=
            "Some persuasive techniques were detected. ";

    } else {

        msg +=
            "The language appears mostly informational. ";
    }

    if (missing.length) {

        msg +=
            `Potentially missing viewpoints include: ${missing.join(", ")}.`;
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
