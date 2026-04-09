export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({ error: "金庫未繫結" }), { status: 500, headers: corsHeaders });
    }

    // --- 1. 考題管理 ---
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- 2. 成績與數據統計 (新增) ---
    // 儲存答題紀錄
    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json(); // { examId, score, total, wrongQuestions: [index] }
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      records.push({ ...record, t: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 獲取所有紀錄
    if (path === "/api/getRecords") {
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- 3. AI 出題 Proxy ---
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
      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Invalid path" }), { status: 404, headers: corsHeaders });
}
