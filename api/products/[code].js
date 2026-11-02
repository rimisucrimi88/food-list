'use strict';
// DELETE /api/products/P-0001 : 상품 삭제 (보관조건은 DB에서 함께 삭제된다)
const { HttpError, CODE_RE, bad, rest, guardWrite, wrap } = require('../_lib/core');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'DELETE') throw new HttpError(405, '허용되지 않은 메서드입니다');
  guardWrite(req);
  const code = String(req.query.code || '');
  if (!CODE_RE.test(code)) bad('상품코드 형식이 올바르지 않습니다');
  const rows = await rest('DELETE', `products?product_code=eq.${encodeURIComponent(code)}`, undefined, 'return=representation');
  if (!rows || rows.length === 0) throw new HttpError(404, '해당 상품이 없습니다');
  res.status(200).json({ deleted: rows.length });
});
