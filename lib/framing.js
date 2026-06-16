export function framingScan(text = "") {

    if (!text || typeof text !== "string") {
        return {
            primary_frame: "unknown",
            balance_score: 0,
            missing_perspectives: []
        };
    }

    const t = text.toLowerCase();

    const frames = {
        crisis: 0,
        conflict: 0,
        economic: 0,
        political: 0,
        moral: 0,
        opportunity: 0
    };

    const patterns = {
        crisis: /(crisis|collapse|breaking|emergency|war|threat)/g,
        conflict: /(vs|against|clash|fight|battle)/g,
        economic: /(economy|market|inflation|trade|oil|price)/g,
        political: /(government|president|policy|election|senate)/g,
        moral: /(right|wrong|justice|corrupt|ethics)/g,
        opportunity: /(growth|opportunity|improve|boost|recovery)/g
    };

    for (const key in patterns) {
        const matches = t.match(patterns[key]);
        frames[key] = matches ? matches.length : 0;
    }

    const primary_frame =
        Object.entries(frames).sort((a, b) => b[1] - a[1])[0][0];

    const total = Object.values(frames).reduce((a, b) => a + b, 0);

    const balance_score = Math.min(1, total / 20);

    const missing_perspectives = [];

    if (!t.includes("however")) missing_perspectives.push("counterarguments");
    if (!t.includes("critics")) missing_perspectives.push("critical perspective");
    if (!t.includes("experts")) missing_perspectives.push("source diversity");

    return {
        frames,
        primary_frame,
        balance_score,
        missing_perspectives
    };
}
