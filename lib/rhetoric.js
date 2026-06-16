export function rhetoricalScan(text = "") {

    if (!text || typeof text !== "string") {
        return {
            signals: [],
            persuasion_score: 0
        };
    }

    const t = text.toLowerCase();

    const patterns = [
        { key: "urgency", re: /(now|immediately|breaking|urgent|today)/g },
        { key: "fear", re: /(threat|danger|war|crisis|risk|collapse)/g },
        { key: "authority", re: /(officials|experts|announced|according to)/g },
        { key: "emotion", re: /(shocking|outrage|horrific|amazing)/g },
        { key: "certainty", re: /(always|never|definitely|undeniable)/g }
    ];

    const signals = [];

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
        signals.reduce((a, b) => a + b.count, 0) /
        Math.max(1, t.length / 120);

    return {
        signals,
        persuasion_score: Math.min(1, score)
    };
}
