export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 🔑 行長，請確保這裡是您的 DeepSeek 金鑰
  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 🔍 關鍵診斷：檢查金庫是否已繫結
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({ 
        error: "金庫未繫結！請在 Cloudflare 設定中新增 KV 命名空間繫結，變數名稱設為 STUDY_DB" 
      }), { status: 500, headers: corsHeaders });
    }

    // 1. 讀取考題
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. 儲存考題
    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let currentData = await env.STUDY_DB.get("all_exams");
      let exams = currentData ? JSON.parse(currentData) : [];
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 3. AI 出題 Proxy
    if (path === "/api/aiProxy" && request.method === "POST") {
      const body = await request.json();
      const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: body.prompt }],
          temperature: 0.7
        })
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        throw new Error("DeepSeek 服務異常: " + errText);
      }

      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: "系統內部異常: " + err.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "路徑無效: " + path }), { status: 404, headers: corsHeaders });
}
