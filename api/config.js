'use strict';
// 브라우저에는 URL과 anon 키만 전달한다. service role 키와 비밀번호는 넣지 않는다
const { SUPABASE_URL, ANON_KEY, readReady, writeReady } = require('./_lib/core');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('window.APP_CONFIG = ' + JSON.stringify({
    SUPABASE_URL: readReady ? SUPABASE_URL : '',
    SUPABASE_ANON_KEY: readReady ? ANON_KEY : '',
    WRITE_VIA_SERVER: writeReady,
    NEED_PASSWORD: true,
  }) + ';\n');
};
