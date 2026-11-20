import { boardFor, points, ROUND_MS, seedFromLink } from '../docs/puzzle.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finalDeliveryMs = 2200;
const pagesOrigin = 'https://carteruh.github.io';
const standingsSql = `
  WITH attempts AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY guest ORDER BY score DESC, ends_at, id) AS attempt
    FROM runs WHERE board = ? AND ends_at <= ? AND score > 0
  ), ranked AS (
    SELECT nickname, score, word_count, guest,
           RANK() OVER (ORDER BY score DESC) AS rank,
           ROW_NUMBER() OVER (ORDER BY score DESC, ends_at, id) AS position
    FROM attempts WHERE attempt = 1
  )
  SELECT nickname, score, word_count AS words, rank, position, guest = ? AS mine
  FROM ranked WHERE position <= 20 OR guest = ? ORDER BY position`;

async function guestFor(request) {
  const token = request.headers.get('X-Garden-Guest');
  if (!token || !uuid.test(token)) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

function nickname(value) {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!clean || [...clean].length > 20 || /[\p{C}<>]/u.test(clean)) return null;
  return clean;
}

export async function serveScores(request, db, now = Date.now()) {
  const url = new URL(request.url);
  const origin=request.headers.get('Origin');
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin===pagesOrigin)headers['Access-Control-Allow-Origin']=pagesOrigin;
  const json=(data,status=200)=>Response.json(data,{status,headers});
  const match = /^\/api\/boards\/([0-9a-z]{1,7})\/(scores|rounds|name)(?:\/([0-9a-f-]{36}))?$/.exec(url.pathname);
  if (!match) return json({error:'Unknown board address.'},404);
  const [, board, action, id] = match;
  const seed = seedFromLink(board);
  if (seed === null || board !== seed.toString(36)) return json({error:'Invalid board.'},400);
  if (origin && origin!==url.origin && origin!==pagesOrigin) return json({error:'Open your board to play.'},403);
  if(request.method==='OPTIONS'){
    return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PUT',
      'Access-Control-Allow-Headers':'Content-Type, X-Garden-Guest','Access-Control-Max-Age':'600'}});
  }
  const guest = await guestFor(request);
  if (action === 'scores' && !id && request.method === 'GET') {
    const {results} = await db.prepare(standingsSql).bind(board,now,guest,guest).all();
    const clean = ({position, mine, ...row}) => ({...row, mine:Boolean(mine)});
    return json({board, leaders:results.filter(row=>row.position <= 20).map(clean), me:results.find(row=>row.mine) ? clean(results.find(row=>row.mine)) : null});
  }
  if (!guest) return json({error:'A guest game key is required.'},401);
  if (!['POST','PUT'].includes(request.method)) return json({error:'Unsupported request.'},405);
  const raw = await request.text();
  if (raw.length > 12000) return json({error:'Round data is too large.'},413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({error:'Invalid form.'},400); }
  if (!body || typeof body !== 'object') return json({error:'Invalid form.'},400);
  if (action === 'rounds' && !id && request.method === 'POST') {
    const name = nickname(body.nickname);
    if (!name || !uuid.test(body.ticket || '')) return json({error:'Choose a nickname of 1 to 20 characters.'},400);
    await db.batch([
      db.prepare('DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE ends_at < ? AND score = 0 LIMIT 25)').bind(now-86400000),
      db.prepare('INSERT INTO runs(id, board, guest, nickname, ends_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(body.ticket,board,guest,name,now+ROUND_MS)
    ]);
    const row = await db.prepare('SELECT ends_at FROM runs WHERE id = ? AND guest = ? AND board = ?').bind(body.ticket,guest,board).first();
    if (!row) return json({error:'Choose a fresh round.'},409);
    return json({ticket:body.ticket,endsAt:row.ends_at,serverTime:now});
  }
  if (action === 'rounds' && uuid.test(id || '') && request.method === 'PUT') {
    if (!Array.isArray(body.words) || body.words.length > 400) return json({error:'Invalid word list.'},400);
    const allowed = boardFor(seed).validWords;
    const words = [...new Set(body.words.filter(w=>typeof w==='string' && allowed.has(w)))];
    const score = words.reduce((sum,w)=>sum+points(w),0);
    const row = await db.prepare('SELECT ends_at,score FROM runs WHERE id = ? AND board = ? AND guest = ?').bind(id,board,guest).first();
    if (!row) return json({error:'Round not found.'},404);
    if (now > row.ends_at + finalDeliveryMs && score > row.score) return json({error:'The minute has ended.'},410);
    if (score > row.score) {
      await db.prepare('UPDATE runs SET score = ?, word_count = ? WHERE id = ? AND score < ? AND ends_at >= ?')
        .bind(score,words.length,id,score,now-finalDeliveryMs).run();
    }
    return json({saved:true});
  }
  if (action === 'name' && !id && request.method === 'PUT') {
    const name = nickname(body.nickname);
    if (!name) return json({error:'Use a nickname of 1 to 20 characters.'},400);
    await db.prepare('UPDATE runs SET nickname = ? WHERE board = ? AND guest = ?').bind(name,board,guest).run();
    return json({nickname:name});
  }
  return json({error:'Unsupported request.'},405);
}
