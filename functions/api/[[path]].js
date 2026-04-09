export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 🔑 行長，這是您的 DeepSeek 金鑰
  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  // 全面支援行動端與跨域通訊的標頭
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // 處理瀏覽器預檢請求
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔍 核心診斷：確認 Cloudflare Pages 的 KV 繫結是否存在
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({ 
        error: "金庫未授權！請在 Cloudflare Pages 設定中完成 [STUDY_DB] 的 KV 繫結。" 
      }), { status: 500, headers: corsHeaders });
    }

    // --- 1. 考題管理 (CRUD) ---

    // 獲取所有考卷 (學員端與管理端同步使用)
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 發布/儲存新考卷
    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let currentData = await env.STUDY_DB.get("all_exams");
      let exams = currentData ? JSON.parse(currentData) : [];
      
      // 生成唯一 ID 並推入陣列
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
      
      // 移除特定 ID 的卷宗
      const updatedExams = currentExams.filter(ex => ex.id !== id);
      await env.STUDY_DB.put("all_exams", JSON.stringify(updatedExams));
      
      // 同步清理相關的成績紀錄，保持金庫整潔
      let currentRecords = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      const updatedRecords = currentRecords.filter(r => r.examId !== id);
      await env.STUDY_DB.put("all_records", JSON.stringify(updatedRecords));
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // --- 2. 數據統計與成績單 ---

    // 儲存答題紀錄 (同仁完考後自動觸發)
    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json(); // 結構: { examId, score, total, wrongIndices }
      let currentRecords = await env.STUDY_DB.get("all_records");
      let records = currentRecords ? JSON.parse(currentRecords) : [];
      
      records.push({ ...record, timestamp: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 獲取統計看板數據
    if (path === "/api/getRecords") {
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // --- 3. AI 出題代理 (AI Proxy) ---

    if (path === "/api/aiProxy" && request.method === "POST") {
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
          temperature: 0.7,
          response_format: { type: "json_object" } // 強制 AI 回傳 JSON
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error("AI 服務暫時無法連線: " + errorText);
      }

      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

  } catch (err) {
    // 捕捉所有異常並回傳具體錯誤訊息給前端診斷
    return new Response(JSON.stringify({ error: "伺服器異常: " + err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  // 若無路徑匹配
  return new Response(JSON.stringify({ error: "路徑無效: " + path }), { 
    status: 404, 
    headers: corsHeaders 
  });
}
