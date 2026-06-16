import { classifyInput, normalizeInput, signalLevel } from "../lib/ingestion.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const input = req.body?.input || "";

    const type = classifyInput(input);
    const text = normalizeInput(input, type);
    const signal = signalLevel(text);

    return res.status(200).json({
        ok: true,
        debug: {
            input_type: type,
            signal_level: signal,
            text_length: text.length
        }
    });
}
