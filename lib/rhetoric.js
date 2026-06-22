export function rhetoricalScan(text = "") {
    if (!text || typeof text !== "string") {
        return {
            signals: [],
            persuasion_score: 0,
            emotional_vector: { fear: 0, urgency: 0, hope: 0, anger: 0 }
        };
    }

    const t = text.toLowerCase();
    const words = t.split(/\s+/).filter(Boolean).length;

    const patterns = {
        urgency: /(now|immediately|breaking|urgent|today)/g,
        fear: /(threat|danger|war|crisis|risk|collapse)/g,
        authority: /(officials|experts|announced|according to)/g,
        emotion: /(shocking|outrage|horrific|amazing)/g,
        certainty: /(always|never|definitely|undeniable)/g
    };

    const signals = [];
    let total = 0;

    const vector = { fear: 0, urgency: 0, hope: 0, anger: 0 };

    for (const [key, re] of Object.entries(patterns)) {
        const matches = t.match(re);
        if (matches) {
            signals.push({ type: key, count: matches.length });
            total += matches.length;

            if (key === "fear") vector.fear += matches.length;
            if (key === "urgency") vector.urgency += matches.length;
            if (key === "emotion") vector.anger += matches.length;
        }
    }

    const raw = (total / Math.max(1, words)) * 12;

    return {
        signals,
        persuasion_score: Math.min(1, raw),
        emotional_vector: vector
    };
}
