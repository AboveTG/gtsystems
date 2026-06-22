export function framingScan(text = "") {
    if (!text || typeof text !== "string") {
        return {
            frames: {},
            primary_frame: "unknown",
            frame_strength: 0,
            missing_perspectives: []
        };
    }

    const t = text.toLowerCase();

    const patterns = {
        crisis: /(crisis|collapse|breaking|emergency|war|threat)/g,
        conflict: /(vs|against|clash|fight|battle)/g,
        economic: /(economy|market|inflation|trade|oil|price)/g,
        political: /(government|president|policy|election|senate)/g,
        moral: /(right|wrong|justice|corrupt|ethics)/g,
        opportunity: /(growth|opportunity|improve|boost|recovery)/g
    };

    const frames = {};
    let total = 0;

    for (const key in patterns) {
        const matches = t.match(patterns[key]);
        const count = matches ? matches.length : 0;
        frames[key] = count;
        total += count;
    }

    const primary_frame =
        Object.entries(frames).sort((a, b) => b[1] - a[1])[0][0];

    const frame_strength = Math.min(1, total / 20);

    const missing_perspectives = [];
    if (!t.includes("however")) missing_perspectives.push("counterarguments");
    if (!t.includes("critics")) missing_perspectives.push("critical view");
    if (!t.includes("experts")) missing_perspectives.push("source diversity");

    return {
        frames,
        primary_frame,
        frame_strength,
        missing_perspectives
    };
}
