// Cloudflare Worker: proxies market-research requests to Gemini.
// The Gemini API key lives only in the GEMINI_API_KEY secret on this Worker —
// it is never sent to, or visible from, the browser.

const ALLOWED_ORIGINS = new Set([
    "https://singhar5r5.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]);

const FRAMEWORK_SCHEMA_HINT = `
{
  "currentPhase": "ระบุชื่อช่วง เช่น 2. Growth Opportunity™",
  "nextPhase": "ระบุชื่อช่วงถัดไป",
  "opportunity": "วิเคราะห์โอกาสทางธุรกิจสั้นๆ 2-3 บรรทัด",
  "risk": "วิเคราะห์ความเสี่ยงสั้นๆ 2-3 บรรทัด",
  "strategy": "เสนอแนะกลยุทธ์สั้นๆ 2-3 บรรทัด",
  "framework": {
    "opportunity": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "learning": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "trading": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "insight": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "rare": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "networking": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"],
    "platform": ["ประเด็นที่ 1", "ประเด็นที่ 2", "ประเด็นที่ 3"]
  },
  "moneyFlow": ["เงินมาจากไหน...", "เงินไหลไปหาใคร...", "ใครสร้างกำไรสูงสุด..."]
}`;

function corsHeaders(origin) {
    const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "null";
    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    };
}

function jsonResponse(payload, status, origin) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders(origin) });
        }

        if (!ALLOWED_ORIGINS.has(origin)) {
            return jsonResponse({ error: "Origin not allowed" }, 403, origin);
        }

        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed" }, 405, origin);
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
        }

        const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 200) : "";
        if (!productName) {
            return jsonResponse({ error: "productName is required" }, 400, origin);
        }

        const promptText = `วิเคราะห์ตลาดสำหรับสินค้า: "${productName}"
โปรดวิเคราะห์โดยใช้หลักการ Market Research Framework™ และส่งผลลัพธ์กลับมาเป็น JSON Object โครงสร้างดังนี้เท่านั้น (ไม่ต้องใส่ Markdown Fences เช่น \`\`\`json):
${FRAMEWORK_SCHEMA_HINT}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

        let geminiResponse;
        try {
            geminiResponse = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: "application/json" },
                }),
            });
        } catch (e) {
            return jsonResponse({ error: "Upstream request to Gemini failed" }, 502, origin);
        }

        const data = await geminiResponse.text();
        return new Response(data, {
            status: geminiResponse.status,
            headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
    },
};
