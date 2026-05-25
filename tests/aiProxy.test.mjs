import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../functions/api/[[path]].js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { onRequest } = await import(moduleUrl);

class FakeKV {
  constructor(initial = {}) {
    this.store = new Map(Object.entries(initial));
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }
}

function makeRequest(body = {}) {
  return new Request("https://deepmystic.net/api/aiProxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Username": "admin",
      "X-Admin-Password": "secret",
      "CF-Connecting-IP": "203.0.113.10",
      "User-Agent": "node-test",
    },
    body: JSON.stringify({
      prompt: "請根據素材產出共 5 題。內容：測試素材",
      count: 5,
      materialLength: 4,
      ...body,
    }),
  });
}

async function runAiProxy(env, body) {
  return onRequest({
    request: makeRequest(body),
    env,
  });
}

async function runGetAiUsageLogs(env, date) {
  return onRequest({
    request: new Request(`https://deepmystic.net/api/getAiUsageLogs?date=${date}`, {
      headers: {
        "X-Admin-Username": "admin",
        "X-Admin-Password": "secret",
      },
    }),
    env,
  });
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const usageKey = `ai_usage:${today}`;
const logKey = `ai_usage_log:${today}`;

{
  const kv = new FakeKV({
    [usageKey]: JSON.stringify({ count: 30 }),
  });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return Response.json({ choices: [] });
  };

  const response = await runAiProxy({
    STUDY_DB: kv,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "secret",
    DEEPSEEK_KEY: "sk-test",
  });

  assert.equal(response.status, 429);
  assert.equal(fetchCalls, 0);
  const payload = await response.json();
  assert.match(payload.error, /今日 AI 出題額度已用完/);

  const logs = JSON.parse(await kv.get(logKey));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].allowed, false);
  assert.equal(logs[0].ip, "203.0.113.10");
  assert.equal(logs[0].userAgent, "node-test");
  assert.equal(logs[0].questionCount, 5);
  assert.equal(logs[0].materialLength, 4);
}

{
  const kv = new FakeKV();
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return Response.json({ choices: [{ message: { content: "[]" } }] });
  };

  const response = await runAiProxy({
    STUDY_DB: kv,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "secret",
    DEEPSEEK_KEY: "sk-test",
  });

  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 1);
  const usage = JSON.parse(await kv.get(usageKey));
  assert.equal(usage.count, 1);
  assert.match(usage.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const logs = JSON.parse(await kv.get(logKey));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].allowed, true);
  assert.equal(logs[0].deepseekStatus, 200);
}

{
  const kv = new FakeKV({
    [usageKey]: JSON.stringify({ count: 12 }),
    [logKey]: JSON.stringify([{ ip: "203.0.113.10", allowed: true }]),
  });

  const response = await runGetAiUsageLogs({
    STUDY_DB: kv,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "secret",
    DEEPSEEK_KEY: "sk-test",
  }, today);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.date, today);
  assert.equal(payload.dailyLimit, 30);
  assert.equal(payload.usedCount, 12);
  assert.deepEqual(payload.logs, [{ ip: "203.0.113.10", allowed: true }]);
}
