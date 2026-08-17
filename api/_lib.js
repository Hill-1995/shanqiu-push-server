// 共享模块：VAPID 配置 + Upstash Redis 订阅存储（Vercel serverless）
const webpush = require('web-push');

const U = process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:shanqiu@example.com';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// 读取全部订阅（存于 Upstash 的 key=subs，值为 JSON 数组字符串）
async function getSubs() {
  try {
    const r = await fetch(`${U}/get/subs`, { headers: { Authorization: `Bearer ${T}` } });
    const j = await r.json();
    if (!j.result) return [];
    return JSON.parse(j.result);
  } catch (e) { return []; }
}

// 写回全部订阅
async function setSubs(arr) {
  await fetch(`${U}/set/subs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(arr)
  });
}

// 解析请求体（Vercel Node 函数需手动读流）
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString();
  return txt ? JSON.parse(txt) : {};
}

function json(res, code, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = code;
  res.end(JSON.stringify(obj));
}

module.exports = { getSubs, setSubs, readJson, json, webpush };
