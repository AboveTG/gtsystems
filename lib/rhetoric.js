import { callProvider } from "./provider.js";

/**
 * FAST deterministic scan (kept for stability baseline)
 */
function localScan(text = "") {
    const t = text.toLowerCase();

    const patterns = [
        { type: "urgency", re: /(now|immediately|breaking|urgent|today)/g },
        { type: "fear", re: /(threat|danger|war|crisis|collapse|risk)/g },
        { type: "authority", re: /(officials|experts|according to|announced)/g },
        { type: "certainty", re: /(always|never|definitely|undeniable)/g },
        { type: "moral_pressure", re: /(should|must|wrong|right|justice|blame)/g }
    ];

    const signals = [];

    for (const p of patterns) {
        const matches = t.match(p.re);
        if (matches) {
            signals.push({
                type: p.type,
                count: matches.length
            });
        }
    }

    const raw =
        signals.reduce((a, b) => a + b.count, 0) /
        Math.max(1, t.length / 150);

    return {
        signals,
        local_score: Math.min(1, raw)
    };
}

/**
 * LLM semantic interpretation layer
 */
async function llmScan(text) {
    const prompt = [
        {
            role: "system",
            content:
                "You are a strict rhetorical analyst. Output ONLY valid JSON."
        },
        {
            role: "user",
            content: `
Analyze this text for persuasion and narrative structure.

Return ONLY JSON in this schema:

{
  "persuasion_intensity": number (0-1),
  "dominant_strategy": "fear" | "authority" | "moral" | "economic" | "neutral",
  "narrative_role": "informational" | "framing" | "advocacy" | "propaganda",
  "emotional_tone": {
    "fear": number,
    "anger": number,
    "urgency": number,
    "hope": number
  },
  "manipulation_signals": string[]
}

TEXT:
"""${text.slice(0, 12000)}"""
`
        }
    ];

    const raw = await callProvider({
        messages: prompt,
        temperature: 0.1,
        max_tokens: 800
    });

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * HYBRID Rhetoric Engine
 */
export async function rhetoricalScan(text = "") {
    if (!text || typeof text !== "string") {
        return {
            signals: [],
            persuasion_score: 0,
            mode: "empty"
        };
    }

    const local = localScan(text);
    const llm = await llmScan(text);

    // fallback safe structure
    if (!llm) {
        return {
            signals: local.signals,
            persuasion_score: local.local_score,
            mode: "local_only"
        };
    }

    // hybrid fusion (weighted)
    const persuasion =
        (local.local_score * 0.4) +
        ((llm.persuasion_intensity || 0) * 0.6);

    return {
        signals: local.signals,

        llm: {
            dominant_strategy: llm.dominant_strategy,
            narrative_role: llm.narrative_role,
            emotional_tone: llm.emotional_tone,
            manipulation_signals: llm.manipulation_signals
        },

        persuasion_score: Math.min(1, persuasion),
        mode: "hybrid"
    };
}
