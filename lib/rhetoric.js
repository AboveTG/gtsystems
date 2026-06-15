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

    const fear = countMatches(t, /\b(danger|threat|risk|crisis|collapse|warning)\b/g);
    const urgency = countMatches(t, /\b(now|immediately|urgent|breaking|last chance|act fast)\b/g);
    const hope = countMatches(t, /\b(opportunity|growth|improve|future|success|solution)\b/g);
    const anger = countMatches(t, /\b(outrage|angry|blame|attack|corrupt)\b/g);

    const authority = countMatches(t, /\b(experts say|studies show|according to|officials|research)\b/g);
    const social = countMatches(t, /\b(everyone|most people|widely|millions|popular)\b/g);
    const binary = countMatches(t, /\b(us vs them|either|only two|no choice)\b/g);
    const certainty = countMatches(t, /\b(always|never|guaranteed|proven|undeniable)\b/g);

    const vector = {
        fear: clamp01(fear / lengthFactor),
        urgency: clamp01(urgency / lengthFactor),
        hope: clamp01(hope / lengthFactor),
        anger: clamp01(anger / lengthFactor),
        authority: clamp01(authority / lengthFactor),
        social_proof: clamp01(social / lengthFactor),
        binary_framing: clamp01(binary / lengthFactor),
        certainty_pressure: clamp01(certainty / lengthFactor)
    };

    const persuasion_intensity =
        Object.values(vector).reduce((a, b) => a + b, 0) / Object.keys(vector).length;

    return {
        vector,
        persuasion_intensity: Math.round(persuasion_intensity * 100)
    };
}
