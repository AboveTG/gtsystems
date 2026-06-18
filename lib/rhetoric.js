export function rhetoricalScan(text = "") {
    if (!text || typeof text !== "string") {
        return {
            signals: [],
            persuasion_score: 0,
            emotional_vector: { fear: 0, urgency: 0, hope: 0, anger: 0 }
        };
    }

    const t = text.toLowerCase();

    const patterns = {
        urgency: /(now|immediately|breaking|urgent|today|fast)/g,
        fear: /(threat|danger|war|crisis|risk|collapse|fear)/g,
        authority: /(officials|experts|announced|according to|sources)/g,
        emotion: /(shocking|outrage|horrific|amazing|disaster)/g,
        certainty: /(always|never|definitely|undeniable|certain)/g
    };

    const signals = [];
    let totalHits = 0;

    const vector = {
        fear: 0,
        urgency: 0,
        hope: 0,
        anger: 0
    };

    const wordCount = t.split(/\s+/).length;

    for (const [key, re] of Object.entries(patterns)) {
        const matches = t.match(re);
        if (matches) {
            const count = matches.length;
            signals.push({ type: key, count });
            totalHits += count;

            if (key === "fear") vector.fear += count;
            if (key === "urgency") vector.urgency += count;
            if (key === "emotion") vector.anger += count;
        }
    }

    const normalizedScore = Math.min(
        1,
        (totalHits / Math.max(1, wordCount)) * 12
    );

    return {
        signals,
        persuasion_score: normalizedScore,
        emotional_vector: vector
    };
}
