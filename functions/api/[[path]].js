export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 🔑 行長，這是您的 DeepSeek 金鑰
  const DEEPSEEK_KEY = "sk-6b982e0502244ac1ae9ef3ee8fce7178";

  // 設定標準 CORS 標頭，確保與前端通訊穩定
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
    // 🔍 核心診斷：檢查 KV 繫結是否存在
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({ 
        error: "伺服器配置錯誤：[STUDY_DB] 未繫結，請檢查 Cloudflare Pages 設定。" 
      }), { status: 500, headers: corsHeaders });
    }

    // --- 1. 考卷管理功能 ---

    // 取得所有考卷清單
    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 儲存/發布新考卷
    if (path === "/api/saveExam" && request.method === "POST") {
      const newExam = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      
      // 生成唯一的考卷 ID
      exams.push({ id: "ex_" + Date.now(), ...newExam });
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 刪除考卷 (確保主畫面精簡)
    if (path === "/api/deleteExam" && request.method === "POST") {
      const { id } = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      
      // 過濾掉指定的 ID
      const updatedExams = exams.filter(ex => ex.id !== id);
      await env.STUDY_DB.put("all_exams", JSON.stringify(updatedExams));
      
      // 同步清理該卷的成績紀錄，保持資料整潔
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      const updatedRecords = records.filter(r => r.examId !== id);
      await env.STUDY_DB.put("all_records", JSON.stringify(updatedRecords));
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- 2. 成績與數據統計功能 ---

    // 儲存同仁完考紀錄
    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json(); // { examId, score, total, wrongIndices }
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      
      records.push({ ...record, t: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 獲取統計看板數據 (管理者專用)
    if (path === "/api/getRecords") {
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // --- 3. AI 出題代理 (AI Proxy) ---

    if (path === "/api/aiProxy" && request.method === "POST") {
      const body = await request.json();
      
      // ✅ 修正：使用純淨的網址字串，解決先前的 Markdown 連結語法錯誤
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
          // ✅ 修正：此處「不可」開啟 response_format: { type: "json_object" }
          // 否則會強制 AI 只能回傳物件，導致行長要求的「考題陣列」無法傳回。
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
    // 捕獲所有異常並將具體錯誤回傳給前端 Toast
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  // 找不到匹配路徑
  return new Response(JSON.stringify({ error: "路徑無效" }), { 
    status: 404, 
    headers: corsHeaders 
  });
}
