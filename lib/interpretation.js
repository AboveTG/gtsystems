export function interpretSignal(level = 0) {
    if (level <= 0) return { label: "Low context", meaning: "Limited usable content detected" };
    if (level === 1) return { label: "Basic context", meaning: "Some usable information extracted" };
    if (level === 2) return { label: "Strong context", meaning: "Clear informational structure detected" };
    return { label: "High context", meaning: "Dense, high-quality informational content" };
}

export function interpretQuality(score = 0) {
    if (score < 0.25) return { label: "Low reliability", meaning: "Signals are weak or inconsistent" };
    if (score < 0.5) return { label: "Moderate reliability", meaning: "Mixed confidence in analysis" };
    if (score < 0.75) return { label: "High reliability", meaning: "Stable and consistent signal patterns" };
    return { label: "Very high reliability", meaning: "Strong analytical confidence" };
}

export function interpretPersuasion(score = 0) {
    if (score < 0.2) return "Neutral language";
    if (score < 0.5) return "Mild persuasive tone";
    if (score < 0.75) return "Strong persuasive framing";
    return "Highly persuasive / opinion-driven language";
}
