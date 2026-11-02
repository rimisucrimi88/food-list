'use strict';
// 로컬 전용 서버: .env.local을 읽어 페이지를 서빙하고, 추가·삭제는 service role 키로 처리한다
// 실행: node server.js (설치할 패키지 없음, Node 20.12 이상)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
try {
  process.loadEnvFile(path.join(DIR, '.env.local'));
} catch (e) {
  if (e.code === 'ENOENT') console.warn('.env.local 파일이 없습니다. 데모 모드로 시작합니다.');
  else throw e;
}

const PORT = Number(process.env.PORT) || 5173;
const HOST = '127.0.0.1'; // 이 PC에서만 접속할 수 있게 한다
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const urlOk = /^https?:\/\/[^\s/]+/.test(SUPABASE_URL);
if (SUPABASE_URL && !urlOk) {
  console.warn('SUPABASE_URL 형식이 올바르지 않습니다. https://<프로젝트>.supabase.co 형식이어야 합니다 (DB 접속 문자열이나 session pooler 주소가 아닙니다).');
}
const readReady = urlOk && !!ANON_KEY;
const writeReady = readReady && !!SERVICE_KEY;

const CODE_RE = /^P-\d{4}$/;
const STR_REQ = ['product_code', 'name', 'size_unit', 'description', 'ingredients', 'storage_method', 'source_doc'];
const STR_NULL = ['pack_info', 'origin', 'storage_prohibition', 'allergens', 'cross_contamination', 'usage_guide', 'caution'];

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.hint = extra.hint;
    this.code = extra.code;
  }
}
const bad = message => { throw new HttpError(400, message); };

// 허용한 컬럼만 통과시킨다 (나머지 제약은 DB의 check 조건이 확인한다)
function cleanProduct(p) {
  if (!p || typeof p !== 'object') bad('상품 데이터가 없습니다');
  const o = {};
  for (const k of STR_REQ) {
    if (typeof p[k] !== 'string' || !p[k].trim()) bad(`${k} 값이 필요합니다`);
    o[k] = p[k];
  }
  for (const k of STR_NULL) {
    if (p[k] != null && typeof p[k] !== 'string') bad(`${k} 형식이 올바르지 않습니다`);
    o[k] = p[k] ?? null;
  }
  if (!CODE_RE.test(o.product_code)) bad('상품코드는 P- 뒤에 숫자 4자리여야 합니다');
  if (!Number.isInteger(p.price_krw)) bad('price_krw는 정수여야 합니다');
  if (typeof p.size_value !== 'number' || !Number.isFinite(p.size_value)) bad('size_value는 숫자여야 합니다');
  o.price_krw = p.price_krw;
  o.size_value = p.size_value;
  o.is_dummy = p.is_dummy !== false;
  return o;
}
function cleanStorage(list, code) {
  if (!Array.isArray(list) || list.length > 20) bad('보관조건 형식이 올바르지 않습니다');
  return list.map(s => {
    if (!s || typeof s.condition !== 'string' || typeof s.duration_unit !== 'string' || !Number.isInteger(s.duration_value)) bad('보관조건 값이 올바르지 않습니다');
    if (s.note != null && typeof s.note !== 'string') bad('보관조건 비고 형식이 올바르지 않습니다');
    return { product_code: code, condition: s.condition, duration_value: s.duration_value, duration_unit: s.duration_unit, note: s.note ?? null };
  });
}

// service role 키로 Supabase REST(PostgREST)를 호출한다
async function rest(method, query, body, prefer) {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new HttpError(502, 'Supabase에 연결하지 못했습니다: ' + (e.cause?.message || e.message));
  }
  const text = await r.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 200) }; } }
  if (!r.ok) throw new HttpError(r.status >= 400 && r.status < 500 ? 400 : 502, data?.message || r.statusText, { hint: data?.hint, code: data?.code });
  return data;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 200_000) { reject(new HttpError(413, '요청이 너무 큽니다')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON 형식이 아닙니다')); }
    });
    req.on('error', reject);
  });
}

// 브라우저에는 URL과 anon 키만 전달한다. service role 키는 여기에 넣지 않는다
const configJs = () => 'window.APP_CONFIG = ' + JSON.stringify({
  SUPABASE_URL: readReady ? SUPABASE_URL : '',
  SUPABASE_ANON_KEY: readReady ? ANON_KEY : '',
  WRITE_VIA_SERVER: writeReady,
}) + ';\n';

const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

function guardApi(req) {
  // 다른 사이트에서 이 서버로 요청을 보내는 것을 막는다 (custom 헤더 + Origin 확인)
  if (req.headers['x-requested-with'] !== 'product-manager') throw new HttpError(403, '허용되지 않은 요청입니다');
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new HttpError(403, '허용되지 않은 출처입니다');
  if (!writeReady) throw new HttpError(503, '.env.local에 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 모두 채우고 서버를 다시 시작하세요');
}

async function handle(req, res) {
  // DNS rebinding 방어: 주소창 호스트가 127.0.0.1 · localhost가 아니면 거부
  if (!allowedHosts.has(req.headers.host)) throw new HttpError(403, '허용되지 않은 호스트입니다');
  const p = new URL(req.url, `http://${req.headers.host}`).pathname;

  // 정해 둔 경로만 응답한다 (.env.local, server.js 등은 내려주지 않는다)
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(DIR, 'index.html')));
  }
  if (req.method === 'GET' && p === '/config.js') return send(res, 200, 'text/javascript; charset=utf-8', configJs());

  if (p === '/api/products') {
    if (req.method !== 'POST') throw new HttpError(405, '허용되지 않은 메서드입니다');
    guardApi(req);
    const body = await readJson(req);
    const product = cleanProduct(body.product);
    const storage = cleanStorage(body.storage ?? [], product.product_code);
    await rest('POST', 'products', product, 'return=minimal');
    if (storage.length) {
      try {
        await rest('POST', 'storage_conditions', storage, 'return=minimal');
      } catch (e) {
        // 보관조건 저장에 실패하면 방금 넣은 상품도 되돌린다
        await rest('DELETE', `products?product_code=eq.${encodeURIComponent(product.product_code)}`).catch(() => {});
        throw e;
      }
    }
    return sendJson(res, 201, { ok: true });
  }
  if (p.startsWith('/api/products/')) {
    if (req.method !== 'DELETE') throw new HttpError(405, '허용되지 않은 메서드입니다');
    guardApi(req);
    let code;
    try { code = decodeURIComponent(p.slice('/api/products/'.length)); } catch { bad('상품코드 형식이 올바르지 않습니다'); }
    if (!CODE_RE.test(code)) bad('상품코드 형식이 올바르지 않습니다');
    const rows = await rest('DELETE', `products?product_code=eq.${encodeURIComponent(code)}`, undefined, 'return=representation');
    if (!rows || rows.length === 0) throw new HttpError(404, '해당 상품이 없습니다');
    return sendJson(res, 200, { deleted: rows.length });
  }
  throw new HttpError(404, '찾을 수 없습니다');
}

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) sendJson(res, status, { message: status === 500 ? '서버 오류' : e.message, hint: e.hint, code: e.code });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`상품 관리: http://localhost:${PORT}`);
  console.log(`  Supabase URL      : ${readReady ? new URL(SUPABASE_URL).host : '(없음, 데모 모드)'}`);
  console.log(`  anon 키 (읽기)    : ${ANON_KEY ? '설정됨' : '없음'}`);
  console.log(`  service role (쓰기): ${SERVICE_KEY ? '설정됨' : '없음'}${readReady && !SERVICE_KEY ? ' -> 추가·삭제를 쓰려면 필요' : ''}`);
});
