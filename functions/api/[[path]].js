export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 管理員密碼驗證函式
  const verifyAdmin = () => {
    const pw = request.headers.get("X-Admin-Password");
    return pw && pw === env.ADMIN_PASSWORD;
  };

  try {
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({
        error: "伺服器配置錯誤：[STUDY_DB] 未繫結，請檢查 Cloudflare Pages 設定。"
      }), { status: 500, headers: corsHeaders });
    }

    // --- 管理員登入驗證 ---
    if (path === "/api/verifyAdmin" && request.method === "POST") {
      if (verifyAdmin()) {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: "密碼錯誤" }), { status: 401, headers: corsHeaders });
    }

    // --- 1. 考卷管理功能 ---

    // 取得所有考卷清單（公開，學員可存取）
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 儲存/發布新考卷（管理員專用）
    if (path === "/api/saveExam" && request.method === "POST") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const newExam = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 刪除考卷（管理員專用）
    if (path === "/api/deleteExam" && request.method === "POST") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const { id } = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      const updatedExams = exams.filter(ex => ex.id !== id);
      await env.STUDY_DB.put("all_exams", JSON.stringify(updatedExams));
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      const updatedRecords = records.filter(r => r.examId !== id);
      await env.STUDY_DB.put("all_records", JSON.stringify(updatedRecords));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- 2. 成績與數據統計功能 ---

    // 儲存同仁完考紀錄（公開，學員可存取）
    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json();
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      records.push({ ...record, t: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 獲取統計看板數據（管理員專用）
    if (path === "/api/getRecords") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- 3. AI 出題代理（管理員專用）---
    if (path === "/api/aiProxy" && request.method === "POST") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const body = await request.json();
      const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: body.prompt }],
          temperature: 0.7
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI 大腦連線失敗：${errorText}`);
      }

      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }

  return new Response(JSON.stringify({ error: "路徑無效" }), {
    status: 404,
    headers: corsHeaders
  });
}
