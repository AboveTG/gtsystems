// lib/framing.js

function count(text, regex) {
    const m = text.match(regex);
    return m ? m.length : 0;
}

function clamp(x) {
    return Math.max(0, Math.min(1, x));
}

export function framingScan(text = "") {

    const t = text.toLowerCase();
    const lengthFactor = Math.max(1, t.length / 100);

    // --- FRAME DETECTION PATTERNS ---

    const crisis =
        count(t, /\b(crisis|collapse|emergency|breaking|disaster|threat)\b/g);

    const opportunity =
        count(t, /\b(opportunity|growth|solution|future|progress|innovation)\b/g);

    const conflict =
        count(t, /\b(battle|fight|war|vs|against|opposition|enemy)\b/g);

    const moral =
        count(t, /\b(right|wrong|evil|justice|should|must|responsibility)\b/g);

    const inevitability =
        count(t, /\b(inevitable|unavoidable|destined|will happen|cannot be avoided)\b/g);

    const economic =
        count(t, /\b(market|economy|jobs|inflation|growth|financial)\b/g);

    const political =
        count(t, /\b(government|policy|election|law|state|administration)\b/g);

    const frames = {
        crisis: clamp(crisis / lengthFactor),
        opportunity: clamp(opportunity / lengthFactor),
        conflict: clamp(conflict / lengthFactor),
        moral: clamp(moral / lengthFactor),
        inevitability: clamp(inevitability / lengthFactor),
        economic: clamp(economic / lengthFactor),
        political: clamp(political / lengthFactor)
    };

    // --- PRIMARY FRAME ---
    let primary = "neutral";
    let max = 0;

    for (const [k, v] of Object.entries(frames)) {
        if (v > max) {
            max = v;
            primary = k;
        }
    }

    return {
        frames,
        primary_frame: primary,
        frame_strength: Math.round(max * 100)
    };
}
