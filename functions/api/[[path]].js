export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 🔑 行長，這是您的金鑰
  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let currentData = await env.STUDY_DB.get("all_exams");
      let exams = currentData ? JSON.parse(currentData) : [];
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (path === "/api/aiProxy" && request.method === "POST") {
      const body = await request.json();
      const aiResponse = await fetch("[https://api.deepseek.com/chat/completions](https://api.deepseek.com/chat/completions)", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: body.prompt }], temperature: 0.7 })
      });
      const aiData = await aiResponse.text();
      return new Response(aiData, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ error: "API Path Error" }), { status: 404, headers: corsHeaders });
}
