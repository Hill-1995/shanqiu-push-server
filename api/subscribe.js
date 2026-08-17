// POST /api/subscribe —— 前端把 PushSubscription 上报并存到 Upstash
const { getSubs, setSubs, readJson, json } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  let sub;
  try { sub = await readJson(req); } catch (e) { return json(res, 400, { error: 'bad json' }); }
  if (!sub || !sub.endpoint) return json(res, 400, { error: 'bad subscription' });

  const subs = await getSubs();
  if (!subs.find((s) => s.endpoint === sub.endpoint)) subs.push(sub);
  await setSubs(subs);
  return json(res, 200, { ok: true, count: subs.length });
};
