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

    // STEP 1: classify input
    const meta = await extractFromUrl(url);

    // STEP 2: guaranteed text output
    const text = await transcribe(url, meta.type);

    // STEP 3: analysis call (internal)
    const base =
        process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "";

    const analysis = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    const result = await analysis.json();

    return res.status(200).json({
        ...result,
        source_type: meta.type
    });

} catch (err) {

    console.error(err);

    return res.status(500).json({
        error: "Ingestion pipeline failed"
    });
}
}
