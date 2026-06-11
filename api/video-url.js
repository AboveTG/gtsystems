import { extractFromUrl } from "../lib/extract.js";
import { transcribe } from "../lib/transcribe.js";

export default async function handler(req, res) {

if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
}

const { url } = req.body;

if (!url) {
    return res.status(400).json({ error: "URL required" });
}

try {

    const meta = await extractFromUrl(url);
    const text = await transcribe(url, meta.type);

    const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";

    const response = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    const raw = await response.text();

    let result;

    try {
        result = JSON.parse(raw);
    } catch {
        return res.status(500).json({
            error: "Analysis returned invalid JSON"
        });
    }

    return res.status(200).json({
        ...result,
        source_type: meta.type
    });

} catch (err) {

    console.error(err);

    return res.status(500).json({
        error: "Video pipeline failed"
    });
}
}
