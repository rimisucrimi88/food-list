'use strict';
// POST /api/products : 상품 + 보관조건 추가
const { HttpError, cleanProduct, cleanStorage, rest, guardWrite, wrap, bodyOf } = require('../_lib/core');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, '허용되지 않은 메서드입니다');
  guardWrite(req);
  const body = bodyOf(req);
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
  res.status(201).json({ ok: true });
});
