export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 🔑 行長，這是您的 DeepSeek 金鑰
  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  // 設定標準 CORS 標頭，確保跨網域通訊穩定
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // 處理瀏覽器 Preflight 預檢請求
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔍 診斷檢查：確認 Cloudflare KV 空間是否已正確繫結至 STUDY_DB
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({ 
        error: "金庫未繫結！請在 Cloudflare Pages 設定中完成 [STUDY_DB] 的 KV 繫結。" 
      }), { status: 500, headers: corsHeaders });
    }

    // --- 1. 考題管理 (CRUD) ---

    // 獲取所有考卷
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 儲存新發布的考卷
    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let currentData = await env.STUDY_DB.get("all_exams");
      let exams = currentData ? JSON.parse(currentData) : [];
      
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 🚀 精準管理：刪除考卷
    if (path === "/api/deleteExam" && request.method === "POST") {
      const { id } = await request.json();
      let currentExams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      
      const updatedExams = currentExams.filter(ex => ex.id !== id);
      await env.STUDY_DB.put("all_exams", JSON.stringify(updatedExams));
      
      // 同步清理相關紀錄，節省空間
      let currentRecords = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      const updatedRecords = currentRecords.filter(r => r.examId !== id);
      await env.STUDY_DB.put("all_records", JSON.stringify(updatedRecords));
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // --- 2. 成績與統計數據 ---

    // 儲存答題紀錄
    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json();
      let currentRecords = await env.STUDY_DB.get("all_records");
      let records = currentRecords ? JSON.parse(currentRecords) : [];
      
      records.push({ ...record, timestamp: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 獲取數據看板所需的紀錄
    if (path === "/api/getRecords") {
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // --- 3. AI 出題代理 (AI Proxy) ---

    if (path === "/api/aiProxy" && request.method === "POST") {
      const body = await request.json();
      
      // ✅ 修正：使用純字串網址，並移除強制物件格式，以支援考題陣列回傳
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
          // 這裡不再限制 response_format，讓 AI 能根據提示詞自由輸出 JSON 陣列
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`DeepSeek API 回傳錯誤: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

  } catch (err) {
    // 捕獲所有層級的錯誤並回傳給前端 Toast 展示
    return new Response(JSON.stringify({ error: "伺服器處理異常: " + err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  // 找不到路徑時的回應
  return new Response(JSON.stringify({ error: "API 路徑無效: " + path }), { 
    status: 404, 
    headers: corsHeaders 
  });
}
