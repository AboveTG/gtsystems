// lib/report.js

function scoreRisk(rhetoric = {}, framing = {}) {

    const persuasion =
        rhetoric?.persuasion_score || 0;

    const missing =
        framing?.missing_perspectives?.length || 0;

    let risk = 0;

    risk += persuasion * 0.7;
    risk += (missing / 5) * 0.3;

    if (risk < 0.33) {
        return {
            level: "LOW",
            explanation:
                "The content shows relatively few persuasion signals and includes a reasonable amount of supporting context."
        };
    }

    if (risk < 0.66) {
        return {
            level: "MODERATE",
            explanation:
                "The content contains noticeable persuasion techniques or missing viewpoints that may influence interpretation."
        };
    }

    return {
        level: "HIGH",
        explanation:
            "The content relies heavily on persuasive framing, emotional language, or limited perspectives."
        };
}

function buildFramingExplanation(framing = {}) {

    const frame =
        framing?.primary_frame || "unknown";

    const explanations = {
        political:
            "The issue is primarily presented through government actions, political leaders, policies, or elections.",

        crisis:
            "The issue is presented as urgent, dangerous, or requiring immediate attention.",

        economic:
            "The story focuses on money, markets, trade, jobs, or financial consequences.",

        moral:
            "The article emphasizes right versus wrong, ethics, fairness, or justice.",

        conflict:
            "The story is framed around disagreement, competition, or confrontation.",

        opportunity:
            "The issue is presented as a chance for improvement, growth, or benefit."
    };

    return explanations[frame] ||
        "No dominant framing pattern was detected.";
}

function summarizeTechniques(signals = []) {

    if (!signals.length) {
        return [
            "No major persuasion techniques were detected."
        ];
    }

    return signals.map(signal => {

        switch (signal.type) {

            case "fear":
                return "Uses language associated with danger, threats, or negative outcomes.";

            case "urgency":
                return "Encourages the reader to view the issue as requiring immediate attention.";

            case "authority":
                return "Relies on experts, officials, or institutions to support claims.";

            case "emotion":
                return "Uses emotionally charged wording to strengthen impact.";

            case "certainty":
                return "Presents claims with high confidence and little uncertainty.";

            default:
                return `Detected ${signal.type} persuasion signals.`;
        }

    });
}

function buildPrimaryClaim(text = "") {

    const sentences =
        text.split(/(?<=[.!?])\s+/);

    return (
        sentences[0] ||
        "Unable to identify a primary claim."
    );
}

function buildSummary(text = "") {

    const sentences =
        text.split(/(?<=[.!?])\s+/)
            .filter(x => x.length > 40);

    return sentences
        .slice(0, 4)
        .join(" ");
}

export function buildReport({
    text,
    rhetoric,
    framing
}) {

    const summary =
        buildSummary(text);

    const primaryClaim =
        buildPrimaryClaim(text);

    const techniques =
        summarizeTechniques(
            rhetoric?.signals || []
        );

    const risk =
        scoreRisk(rhetoric, framing);

    return {

        summary,

        primary_claim:
            primaryClaim,

        framing: {
            primary_frame:
                framing?.primary_frame || "unknown",

            explanation:
                buildFramingExplanation(
                    framing
                ),

            missing_perspectives:
                framing?.missing_perspectives || []
        },

        persuasion: {
            intensity:
                rhetoric?.persuasion_score || 0,

            techniques
        },

        narrative_risk: risk
    };
}
