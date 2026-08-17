// POST/GET /api/send —— 给所有订阅广播一条提醒（供 automation 用 curl 触发）
const { getSubs, setSubs, readJson, json, webpush } = require('./_lib');

module.exports = async (req, res) => {
  let payload = { title: '山丘个人助手', body: '💊 该吃药了！打开 App 点「确认已服药」可重置。' };
  if (req.method === 'POST') {
    try {
      const p = await readJson(req);
      if (p && p.body) payload = { title: p.title || payload.title, body: p.body };
    } catch (e) { /* 用默认文案 */ }
  }

  const subs = await getSubs();
  if (subs.length === 0) return json(res, 200, { ok: true, sent: 0, failed: 0, note: 'no subscriptions yet' });

  let sent = 0, failed = 0;
  const valid = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload));
      sent++; valid.push(s);
    } catch (e) {
      failed++;
      const code = e && e.statusCode;
      // 404/410 = 订阅已失效（卸载/拒绝）→ 丢弃；其他错误暂留
      if (code !== 404 && code !== 410) valid.push(s);
    }
  }));
  await setSubs(valid); // 清理失效订阅
  return json(res, 200, { ok: true, sent, failed, total: subs.length });
};
