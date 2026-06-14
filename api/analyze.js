export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const input =
        typeof body.input === "string" ? body.input.trim()
        : typeof body.text === "string" ? body.text.trim()
        : null;

    if (!input) {
        return res.status(400).json({ error: "No input provided" });
    }

    // =====================================================
    // PROVIDER
    // =====================================================

    const provider = {
        name: "GROQ",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        model: "llama-3.3-70b-versatile"
    };

    // =====================================================
    // TYPE DETECTION GRAPH
    // =====================================================

    function detectType(str) {
        try {
            const url = new URL(str);

            const host = url.hostname;

            if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
            if (host.includes("tiktok.com")) return "tiktok";
            if (host.includes("twitter.com") || host.includes("x.com")) return "tweet";
            if (host.endsWith(".pdf")) return "pdf";
            if (host.match(/\.(png|jpg|jpeg|webp)/)) return "image";

            return "url";
        } catch {
            return "text";
        }
    }

    const type = detectType(input);

    // =====================================================
    // INGESTION LAYERS
    // =====================================================

    async function fetchHtml(url) {
        try {
            const r = await fetch(url, { redirect: "follow" });
            const html = await r.text();

            return html
                .replace(/<script[^>]*>.*?<\/script>/gis, "")
                .replace(/<style[^>]*>.*?<\/style>/gis, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .slice(0, 12000);
        } catch {
            return null;
        }
    }

    async function fetchPdf(url) {
        try {
            const r = await fetch(url);
            const buffer = await r.arrayBuffer();

            const mod = await import("pdf-parse");
            const data = await mod.default(Buffer.from(buffer));

            return data.text?.slice(0, 12000) || null;
        } catch {
            return null;
        }
    }

    async function fetchOcr(url) {
        try {
            // lightweight placeholder (swap with Tesseract or external OCR API)
            const r = await fetch(url);
            const buffer = await r.arrayBuffer();

            const mod = await import("tesseract.js");
            const { data } = await mod.recognize(Buffer.from(buffer));

            return data.text?.slice(0, 8000) || null;
        } catch {
            return null;
        }
    }

    function extractYouTubeId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v");
        } catch {
            return null;
        }
    }

    async function fetchYoutubeTranscript(videoId) {
        try {
            const mod = await import("youtube-transcript");
            const yt = mod.YoutubeTranscript;
            const t = await yt.fetchTranscript(videoId);
            return t.map(x => x.text).join(" ").trim();
        } catch {
            return null;
        }
    }

    // =====================================================
    // MULTI-LAYER INGESTION GRAPH
    // =====================================================

    let layers = [];
    let text = input;
    let source_type = type;

    if (type === "youtube") {
        const id = extractYouTubeId(input);

        let transcript = null;
        if (id) transcript = await fetchYoutubeTranscript(id);

        layers.push({
            layer: "youtube_transcript",
            status: transcript ? "hit" : "miss"
        });

        text = transcript || `[youtube_metadata_only:${id}]`;
    }

    if (type === "tiktok" || type === "tweet" || type === "url") {
        const html = await fetchHtml(input);

        layers.push({
            layer: "web_scrape",
            status: html ? "hit" : "miss"
        });

        text = html || `[unreachable_url:${input}]`;
    }

    if (type === "pdf") {
        const pdf = await fetchPdf(input);

        layers.push({
            layer: "pdf_parse",
            status: pdf ? "hit" : "miss"
        });

        text = pdf || `[pdf_unavailable]`;
    }

    if (type === "image") {
        const ocr = await fetchOcr(input);

        layers.push({
            layer: "ocr",
            status: ocr ? "hit" : "miss"
        });

        text = ocr || `[ocr_failed]`;
    }

    // =====================================================
    // SIGNAL MODEL
    // =====================================================

    function signalScore(t) {
        if (!t || t.length < 80) return 0;
        if (t.includes("metadata_only") || t.includes("unreachable")) return 1;
        if (t.length < 500) return 2;
        return 3;
    }

    const signal_level = signalScore(text);

    // HARD STOP
    if (signal_level === 1) {
        return res.status(200).json({
            noise_score: null,
            confidence: 0,
            signal_level,
            source_type,
            layers,
            emotional_triggers: [],
            logic_breakdown: {
                summary: "Insufficient signal for analysis",
                key_observations: [
                    "Only metadata or unreachable content available"
                ],
                framing_notes: [
                    "Execution skipped at ingestion layer"
                ]
            },
            node: provider.name
        });
    }

    // =====================================================
    // GROQ PROMPT
    // =====================================================

    const SYSTEM_PROMPT = `
You are a multi-source linguistic fusion engine.

You analyze:
- scraped web text
- transcripts
- OCR output
- PDFs
- metadata fallback content

Return ONLY JSON:

{
  "noise_score": number,
  "confidence": number,
  "emotional_triggers": string[],
  "logic_breakdown": {
    "summary": string,
    "key_observations": string[],
    "framing_notes": string[]
  }
}
`;

    function safeParse(content) {
        try {
            const cleaned = content.replace(/```json/g, "").replace(/```/g, "");
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");
            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            return null;
        }
    }

    // =====================================================
    // MODEL EXECUTION
    // =====================================================

    try {
        const response = await fetch(provider.url, {
            method: "POST",
            headers: provider.headers,
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: text }
                ]
            })
        });

        const raw = await response.text();

        if (!response.ok) {
            return res.status(500).json({
                error: "Model error",
                details: raw.slice(0, 500)
            });
        }

        const api = JSON.parse(raw);
        const content = api?.choices?.[0]?.message?.content;

        const parsed = safeParse(content);

        if (!parsed) {
            return res.status(500).json({
                error: "Invalid model output"
            });
        }

        // =================================================
        // CONFIDENCE FUSION LAYER
        // =================================================

        const confidence =
            Math.min(1, parsed.confidence || 0) *
            (signal_level / 3);

        return res.status(200).json({
            noise_score: parsed.noise_score ?? 0,
            confidence,
            signal_level,
            layers,
            emotional_triggers: parsed.emotional_triggers || [],
            logic_breakdown: parsed.logic_breakdown || {
                summary: "",
                key_observations: [],
                framing_notes: []
            },
            source_type,
            node: provider.name
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
