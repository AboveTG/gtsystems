// lib/rhetoric.js

function countMatches(text, regex) {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

export function rhetoricalScan(text = "") {

    const t = text.toLowerCase();
    const lengthFactor = Math.max(1, t.length / 100);

    // --- EMOTIONAL STEERING ---
    const fearCount = countMatches(t, /\b(danger|threat|risk|crisis|collapse|warning)\b/g);
    const urgencyCount = countMatches(t, /\b(now|immediately|urgent|breaking|last chance|act fast)\b/g);
    const hopeCount = countMatches(t, /\b(opportunity|growth|improve|future|success|solution)\b/g);
    const angerCount = countMatches(t, /\b(outrage|angry|blame|attack|corrupt)\b/g);

    // --- RHETORICAL MECHANISMS ---
    const authorityCount = countMatches(t, /\b(experts say|studies show|researchers|officials|according to)\b/g);
    const socialProofCount = countMatches(t, /\b(everyone|most people|widely|popular|millions)\b/g);
    const binaryCount = countMatches(t, /\b(us vs them|either|only two|no choice)\b/g);
    const certaintyCount = countMatches(t, /\b(always|never|guaranteed|proven|undeniable)\b/g);

    // --- NORMALIZED SCORES (0–1) ---
    const vector = {
        fear: clamp01(fearCount / lengthFactor),
        urgency: clamp01(urgencyCount / lengthFactor),
        hope: clamp01(hopeCount / lengthFactor),
        anger: clamp01(angerCount / lengthFactor),

        authority: clamp01(authorityCount / lengthFactor),
        social_proof: clamp01(socialProofCount / lengthFactor),
        binary_framing: clamp01(binaryCount / lengthFactor),
        certainty_pressure: clamp01(certaintyCount / lengthFactor)
    };

    // --- DERIVED METRIC ---
    const persuasion_intensity =
        (vector.fear +
        vector.urgency +
        vector.anger +
        vector.authority +
        vector.social_proof +
        vector.binary_framing +
        vector.certainty_pressure) / 7;

    return {
        vector,
        persuasion_intensity: Math.round(persuasion_intensity * 100)
    };
}
