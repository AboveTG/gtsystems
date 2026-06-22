export function framingScan(text = "") {
    if (!text || typeof text !== "string") {
        return {
            primary_frame: "unknown",
            narrative_mix: {},
            missing_perspectives: []
        };
    }

    const t = text.toLowerCase();

    const patterns = {
        crisis: /(crisis|collapse|breaking|emergency|war|threat)/g,
        conflict: /(vs|against|clash|fight|battle)/g,
        economic: /(economy|market|inflation|trade|price)/g,
        political: /(government|president|policy|election)/g,
        moral: /(justice|corrupt|ethics|wrong|right)/g,
        opportunity: /(growth|recovery|opportunity|boost)/g
    };

    const scores = {};
    let total = 0;

    for (const k in patterns) {
        const m = t.match(patterns[k]);
        scores[k] = m ? m.length : 0;
        total += scores[k];
    }

    const primary_frame =
        Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

    const missing_perspectives = [];
    if (!t.includes("however")) missing_perspectives.push("counterpoint missing");
    if (!t.includes("critics")) missing_perspectives.push("critical view missing");
    if (!t.includes("experts")) missing_perspectives.push("source diversity low");

    return {
        primary_frame,
        narrative_mix: scores,
        balance_score: Math.min(1, total / 25),
        missing_perspectives
    };
}
