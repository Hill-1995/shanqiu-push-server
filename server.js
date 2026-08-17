// 山丘个人助手 · Web Push 推送服务器
// 部署：推到 GitHub 仓库后连 Render（free），自动 npm install + node server.js
// 环境变量（在 Render 控制台填）：
//   VAPID_PUBLIC_KEY   - 前端订阅用的公钥
//   VAPID_PRIVATE_KEY  - 私钥（切勿泄露）
//   VAPID_SUBJECT      - 任意 mailto:，如 mailto:shanqiu@example.com
//   PORT               - Render 自动注入，可不填

const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const PORT = process.env.PORT || 3000;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:shanqiu@example.com';

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('缺少 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 环境变量');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const SUBS_FILE = path.join(__dirname, 'subs.json');
function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return []; }
}
function saveSubs(subs) {
  try { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2)); } catch (e) { /* 只读盘忽略 */ }
}
let subscriptions = loadSubs();

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
  });
}

// 给所有订阅发一条推送
async function broadcast(payload) {
  const payloadStr = JSON.stringify(payload);
  let sent = 0, failed = 0;
  const tasks = subscriptions.map((sub) =>
    webpush.sendNotification(sub, payloadStr)
      .then(() => { sent++; })
      .catch((err) => {
        failed++;
        // 订阅失效（卸载/拒绝）→ 删掉
        if (err.statusCode === 404 || err.statusCode === 410) {
          subscriptions = subscriptions.filter((s) => s.endpoint !== sub.endpoint);
          saveSubs(subscriptions);
        }
      })
  );
  await Promise.all(tasks);
  return { sent, failed, total: subscriptions.length };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }

  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, subs: subscriptions.length });
  }

  // 订阅：前端把 PushSubscription POST 过来
  if (req.method === 'POST' && req.url === '/subscribe') {
    const body = await readBody(req);
    try {
      const sub = JSON.parse(body);
      if (!sub || !sub.endpoint) return sendJson(res, 400, { error: 'bad subscription' });
      if (!subscriptions.find((s) => s.endpoint === sub.endpoint)) {
        subscriptions.push(sub);
        saveSubs(subscriptions);
      }
      return sendJson(res, 200, { ok: true, count: subscriptions.length });
    } catch (e) {
      return sendJson(res, 400, { error: 'invalid json' });
    }
  }

  // 发推送：支持 POST(JSON 带 body) 或 GET(用默认文案)，方便 automation 用 curl 或直接打开 URL 触发
  if ((req.method === 'POST' || req.method === 'GET') && req.url.startsWith('/api/send')) {
    let payload = { title: '山丘个人助手', body: '💊 该吃药了！打开 App 点「确认已服药」可重置。' };
    if (req.method === 'POST') {
      const body = await readBody(req);
      try {
        const p = JSON.parse(body);
        if (p && p.body) payload = { title: p.title || payload.title, body: p.body };
      } catch { /* 用默认 */ }
    }
    if (subscriptions.length === 0) {
      return sendJson(res, 200, { ok: true, sent: 0, failed: 0, note: 'no subscriptions yet' });
    }
    const result = await broadcast(payload);
    return sendJson(res, 200, { ok: true, ...result });
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log('Push server listening on ' + PORT + ' | subs=' + subscriptions.length);
});
