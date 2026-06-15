export function rhetoricalScan(text = "") {

    const t = text.toLowerCase();

    const signals = [];

    const patterns = [
        { key: "urgency", re: /\b(now|immediately|urgent|breaking|last chance)\b/g },
        { key: "fear", re: /\b(danger|threat|risk|collapse|crisis)\b/g },
        { key: "authority", re: /\b(experts say|studies show|scientists confirm|official)\b/g },
        { key: "certainty", re: /\b(always|never|proven|guaranteed)\b/g },
        { key: "emotion", re: /\b(amazing|shocking|incredible|horrifying)\b/g },
        { key: "binary_framing", re: /\b(us vs them|either|only two options)\b/g }
    ];

    for (const p of patterns) {
        const matches = t.match(p.re);
        if (matches) {
            signals.push({
                type: p.key,
                count: matches.length
            });
        }
    }

    const score =
        signals.reduce((a, b) => a + b.count, 0) / Math.max(1, text.length / 100);

    return {
        signals,
        persuasion_score: Math.min(1, score)
    };
}
