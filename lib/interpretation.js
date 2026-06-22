export function interpretSignal(level = 0) {
    if (level <= 0) {
        return {
            label: "Low context",
            meaning: "Not enough information to analyze reliably"
        };
    }

    if (level === 1) {
        return {
            label: "Basic context",
            meaning: "Limited but usable informational content"
        };
    }

    if (level === 2) {
        return {
            label: "Strong context",
            meaning: "Clear structure and meaningful content detected"
        };
    }

    return {
        label: "High context",
        meaning: "Dense, information-rich content with strong structure"
    };
}

export function interpretQuality(score = 0) {
    if (score < 0.25) {
        return {
            label: "Low reliability",
            meaning: "Signals are weak or inconsistent"
        };
    }

    if (score < 0.5) {
        return {
            label: "Moderate reliability",
            meaning: "Some confidence, but mixed signal quality"
        };
    }

    if (score < 0.75) {
        return {
            label: "High reliability",
            meaning: "Stable and consistent analytical signals"
        };
    }

    return {
        label: "Very high reliability",
        meaning: "Strong and consistent analytical confidence"
    };
}

export function interpretPersuasion(score = 0) {
    if (score < 0.2) return "Neutral tone";
    if (score < 0.5) return "Mild persuasive language";
    if (score < 0.75) return "Strong persuasive framing";
    return "Highly persuasive / opinion-driven language";
}
