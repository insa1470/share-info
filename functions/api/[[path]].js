export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const DEEPSEEK_KEY = env.DEEPSEEK_KEY;
  const AI_DAILY_LIMIT = 30;
  const AI_LOG_LIMIT = 200;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Username, X-Admin-Password",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const verifyAdmin = () => {
    const user = request.headers.get("X-Admin-Username");
    const pw = request.headers.get("X-Admin-Password");
    return user && pw && user === env.ADMIN_USERNAME && pw === env.ADMIN_PASSWORD;
  };

  const getUsageDate = () => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  };

  const getClientIp = () => {
    const forwardedFor = request.headers.get("X-Forwarded-For");
    return request.headers.get("CF-Connecting-IP") || forwardedFor?.split(",")[0]?.trim() || "unknown";
  };

  const getQuestionCount = (body) => {
    if (Number.isFinite(body.count)) return body.count;
    const match = String(body.prompt || "").match(/共\s*(\d+)\s*[題题]/);
    return match ? Number(match[1]) : null;
  };

  const appendAiUsageLog = async (usageDate, entry) => {
    const logKey = `ai_usage_log:${usageDate}`;
    let logs = [];
    try {
      logs = JSON.parse(await env.STUDY_DB.get(logKey) || "[]");
      if (!Array.isArray(logs)) logs = [];
    } catch {
      logs = [];
    }
    logs.push(entry);
    if (logs.length > AI_LOG_LIMIT) {
      logs = logs.slice(logs.length - AI_LOG_LIMIT);
    }
    await env.STUDY_DB.put(logKey, JSON.stringify(logs));
  };

  try {
    if (!env.STUDY_DB) {
      return new Response(JSON.stringify({
        error: "伺服器配置錯誤：[STUDY_DB] 未繫結，請檢查 Cloudflare Pages 設定。"
      }), { status: 500, headers: corsHeaders });
    }

    if (path === "/api/verifyAdmin" && request.method === "POST") {
      if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "伺服器尚未設定管理員帳密，請至 Cloudflare 環境變數設定 ADMIN_USERNAME 與 ADMIN_PASSWORD" }), { status: 500, headers: corsHeaders });
      }
      if (verifyAdmin()) {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: "帳號或密碼錯誤" }), { status: 401, headers: corsHeaders });
    }

    if (path === "/api/getExams") {
      const data = await env.STUDY_DB.get("all_exams");
      return new Response(data || "[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    if (path === "/api/renameExam" && request.method === "POST") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const { id, title } = await request.json();
      let exams = JSON.parse(await env.STUDY_DB.get("all_exams") || "[]");
      const idx = exams.findIndex(ex => ex.id === id);
      if (idx === -1) return new Response(JSON.stringify({ error: "找不到卷宗" }), { status: 404, headers: corsHeaders });
      exams[idx].title = title;
      await env.STUDY_DB.put("all_exams", JSON.stringify(exams));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (path === "/api/saveRecord" && request.method === "POST") {
      const record = await request.json();
      let records = JSON.parse(await env.STUDY_DB.get("all_records") || "[]");
      records.push({ ...record, t: Date.now() });
      await env.STUDY_DB.put("all_records", JSON.stringify(records));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (path === "/api/getRecords") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const data = await env.STUDY_DB.get("all_records");
      return new Response(data || "[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 查詢 AI 出題呼叫紀錄（管理員專用）
    if (path === "/api/getAiUsageLogs") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      const requestedDate = url.searchParams.get("date") || getUsageDate();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return new Response(JSON.stringify({ error: "日期格式需為 YYYY-MM-DD" }), { status: 400, headers: corsHeaders });
      }
      const usage = JSON.parse(await env.STUDY_DB.get(`ai_usage:${requestedDate}`) || '{"count":0}');
      const logs = JSON.parse(await env.STUDY_DB.get(`ai_usage_log:${requestedDate}`) || "[]");
      return new Response(JSON.stringify({
        date: requestedDate,
        dailyLimit: AI_DAILY_LIMIT,
        usedCount: Number(usage.count) || 0,
        logs: Array.isArray(logs) ? logs : [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- 3. AI 出題代理（管理員專用）---
    if (path === "/api/aiProxy" && request.method === "POST") {
      if (!verifyAdmin()) {
        return new Response(JSON.stringify({ error: "未授權" }), { status: 401, headers: corsHeaders });
      }
      if (!DEEPSEEK_KEY) {
        return new Response(JSON.stringify({ error: "伺服器配置錯誤：DEEPSEEK_KEY 環境變數未設定，請至 Cloudflare Pages 設定。" }), { status: 500, headers: corsHeaders });
      }
      const body = await request.json();
      const usageDate = getUsageDate();
      const usageKey = `ai_usage:${usageDate}`;
      const currentUsage = JSON.parse(await env.STUDY_DB.get(usageKey) || '{"count":0}');
      const usedCount = Number(currentUsage.count) || 0;
      const baseLog = {
        timestamp: new Date().toISOString(),
        ip: getClientIp(),
        userAgent: request.headers.get("User-Agent") || "unknown",
        questionCount: getQuestionCount(body),
        materialLength: Number.isFinite(body.materialLength) ? body.materialLength : String(body.prompt || "").length,
        promptLength: String(body.prompt || "").length,
      };

      if (usedCount >= AI_DAILY_LIMIT) {
        await appendAiUsageLog(usageDate, {
          ...baseLog,
          allowed: false,
          reason: "daily_limit_exceeded",
          dailyLimit: AI_DAILY_LIMIT,
          usedCount,
        });
        return new Response(JSON.stringify({
          error: `今日 AI 出題額度已用完（每日 ${AI_DAILY_LIMIT} 次），請明日再試或聯絡管理員。`
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await env.STUDY_DB.put(usageKey, JSON.stringify({
        count: usedCount + 1,
        updatedAt: new Date().toISOString(),
      }));

      const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: body.prompt }],
          temperature: 0.7
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        await appendAiUsageLog(usageDate, {
          ...baseLog,
          allowed: true,
          deepseekStatus: aiResponse.status,
          error: errorText.slice(0, 500),
          usedCount: usedCount + 1,
          dailyLimit: AI_DAILY_LIMIT,
        });
        throw new Error(`AI 大腦連線失敗：${errorText}`);
      }

      const aiData = await aiResponse.json();
      await appendAiUsageLog(usageDate, {
        ...baseLog,
        allowed: true,
        deepseekStatus: aiResponse.status,
        usedCount: usedCount + 1,
        dailyLimit: AI_DAILY_LIMIT,
      });
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
