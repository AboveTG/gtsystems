export function normalizeAnalysis(data, node = "unknown") {

    return {
        noise_score: Number(data?.noise_score ?? 0),

        emotional_triggers: Array.isArray(data?.emotional_triggers)
            ? data.emotional_triggers
            : [],

        logic_breakdown: {
            summary:
                data?.logic_breakdown?.summary ||
                "No summary available",

            key_observations:
                data?.logic_breakdown?.key_observations || [],

            framing_notes:
                data?.logic_breakdown?.framing_notes || []
        },

        node
    };
}
