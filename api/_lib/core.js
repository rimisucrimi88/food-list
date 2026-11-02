'use strict';
// Vercel 서버리스 공용 코드: 환경변수 읽기, 입력 검사, 비밀번호 확인, Supabase 호출
// 환경변수는 Vercel 프로젝트의 Settings에서 입력한다 (코드나 GitHub에 키를 넣지 않는다)
const crypto = require('node:crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const APP_PASSWORD = process.env.APP_PASSWORD || '';

const readReady = /^https?:\/\/[^\s/]+/.test(SUPABASE_URL) && !!ANON_KEY;
// 비밀번호가 없으면 쓰기를 열지 않는다 (공개 주소이므로 반드시 필요)
const writeReady = readReady && !!SERVICE_KEY && !!APP_PASSWORD;

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

const sha = s => crypto.createHash('sha256').update(String(s)).digest();

// 쓰기 요청 검사: 사용자 지정 헤더 + Origin + 공유 비밀번호
function guardWrite(req) {
  if (req.headers['x-requested-with'] !== 'product-manager') throw new HttpError(403, '허용되지 않은 요청입니다');
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* 형식 오류는 아래에서 거부 */ }
    if (host !== req.headers.host) throw new HttpError(403, '허용되지 않은 출처입니다');
  }
  if (!writeReady) throw new HttpError(503, 'Vercel 환경변수(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_PASSWORD)를 모두 입력하고 다시 배포하세요');
  const given = req.headers['x-app-password'] || '';
  if (!crypto.timingSafeEqual(sha(given), sha(APP_PASSWORD))) throw new HttpError(401, '비밀번호가 맞지 않습니다');
}

// 핸들러를 감싸서 오류를 JSON으로 돌려준다
function wrap(fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await fn(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.status(status).json({ message: status === 500 ? '서버 오류' : e.message, hint: e.hint, code: e.code });
    }
  };
}

function bodyOf(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { /* 아래에서 거부 */ } }
  throw new HttpError(400, 'JSON 형식이 아닙니다');
}

module.exports = { SUPABASE_URL, ANON_KEY, readReady, writeReady, CODE_RE, HttpError, bad, cleanProduct, cleanStorage, rest, guardWrite, wrap, bodyOf };
