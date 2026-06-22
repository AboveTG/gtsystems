export function framingScan(text = "") {

    if (!text || typeof text !== "string") {
        return {
            frames: {},
            primary_frame: "unknown",
            frame_density: 0,
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

    for (const key in patterns) {
        const matches = t.match(patterns[key]);
        frames[key] = matches ? matches.length : 0;
    }

    const primary_frame =
        Object.entries(frames).sort((a, b) => b[1] - a[1])[0][0];

    const total = Object.values(frames).reduce((a, b) => a + b, 0);

    return {
        frames,
        primary_frame,
        frame_density: Math.min(1, total / 20),
        missing_perspectives: [
            ...(!t.includes("however") ? ["counterarguments"] : []),
            ...(!t.includes("critics") ? ["critical perspective"] : []),
            ...(!t.includes("experts") ? ["source diversity"] : [])
        ]
    };
}
