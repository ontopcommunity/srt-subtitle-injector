// Test fetchTextVia mới: chạy SONG SONG, đường nào trả nội dung ĐÚNG trước thì lấy;
// trang lỗi (200) bị loại; tất cả chết thì trả null + ghi rõ lý do từng đường.
const fs = require('fs');
const src = fs.readFileSync('/home/hatch/workspace/subtitle-injector/subtitle-injector.js', 'utf8');
const PROXY_BASE = 'https://ontopdz.shop';   // fetchTextVia dùng hằng này (nằm ngoài đoạn slice)
const sV = src.indexOf('function isGoodCatText');
eval(src.slice(sV, src.indexOf('async function catSearch')));
const realSrt = fs.readFileSync('/home/hatch/workspace/subtitle-injector/research/cl-vi.srt', 'utf8');
const realHtml = fs.readFileSync('/home/hatch/workspace/subtitle-injector/research/search-sone.html', 'utf8');
const errPage = '<html><body>Rate limit exceeded, try again later.</body></html>';

const ok = (text) => ({ ok: true, status: 200, text: async () => text });
const fail = (status) => ({ ok: false, status, text: async () => '' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  // Kịch bản 1: trực tiếp lỗi CORS, allorigins trả trang lỗi 200, codetabs 500, cors.lol trả SRT thật (chậm 80ms) -> phải lấy được SRT
  global.fetch = async (u) => {
    if (u.startsWith('https://www.subtitlecat.com/')) throw new TypeError('Failed to fetch');
    if (u.includes('allorigins')) return ok(errPage);
    if (u.includes('codetabs')) return fail(500);
    if (u.includes('cors.lol')) { await sleep(80); return ok(realSrt); }
    throw new Error('unexpected url ' + u);
  };
  const t1 = await fetchTextVia('https://www.subtitlecat.com/subs/1077/x-vi.srt', 'srt');
  if (t1 !== realSrt) throw new Error('race 1: expected real SRT, got ' + (t1 ? t1.slice(0, 40) : t1));
  console.log('RACE SRT: PASS (loại trang lỗi 200 + HTTP 500, lấy cors.lol)');

  // Kịch bản 2: tất cả chết -> null + lastError ghi đủ lý do
  global.fetch = async (u) => {
    if (u.startsWith('https://www.subtitlecat.com/')) throw new TypeError('Failed to fetch');
    if (u.includes('allorigins')) return ok(errPage);
    if (u.includes('codetabs')) return fail(522);
    if (u.includes('cors.lol')) return fail(429);
    throw new Error('unexpected url ' + u);
  };
  const t2 = await fetchTextVia('https://www.subtitlecat.com/subs/1077/x-vi.srt', 'srt');
  if (t2 !== null) throw new Error('race 2: expected null');
  for (const k of ['trực tiếp', 'allorigins', 'codetabs', 'cors.lol']) {
    if (!fetchTextVia.lastError.includes(k)) throw new Error('race 2: lastError thiếu ' + k + ': ' + fetchTextVia.lastError);
  }
  console.log('RACE ALL-FAIL: PASS (null + lastError: ' + fetchTextVia.lastError.slice(0, 120) + '...)');

  // Kịch bản 3: HTML qua jina trả đúng, các đường khác chết -> lấy HTML
  global.fetch = async (u) => {
    if (u.startsWith('https://www.subtitlecat.com/')) throw new TypeError('Failed to fetch');
    if (u.includes('r.jina.ai')) return ok(realHtml);
    if (u.includes('allorigins')) return fail(522);
    if (u.includes('codetabs')) { await sleep(5000); return fail(500); }
    if (u.includes('cors.lol')) return fail(429);
    throw new Error('unexpected url ' + u);
  };
  const t0 = Date.now();
  const t3 = await fetchTextVia('https://www.subtitlecat.com/index.php?search=SONE', 'html', 'sub-table');
  const dt = Date.now() - t0;
  if (t3 !== realHtml) throw new Error('race 3: expected real HTML');
  if (dt > 3000) throw new Error('race 3: phải xong trong ~3s (không đợi đường chậm), thực tế ' + dt + 'ms');
  console.log('RACE HTML: PASS (lấy jina trong ' + dt + 'ms, không đợi codetabs treo)');

  // Kịch bản 4: proxy riêng trả SRT thật -> lấy ngay, KHÔNG gọi proxy công cộng nào
  const called = [];
  global.fetch = async (u) => {
    called.push(u);
    if (u.includes('ontopdz.shop/api/subtitle-proxy')) return ok(realSrt);
    throw new Error('không được gọi proxy công cộng khi proxy riêng đã trả đúng: ' + u);
  };
  const t4 = await fetchTextVia('https://www.subtitlecat.com/subs/1077/x-vi.srt', 'srt');
  if (t4 !== realSrt) throw new Error('race 4: expected real SRT from shop proxy');
  if (called.length !== 1) throw new Error('race 4: chỉ được gọi đúng 1 lần (proxy riêng), thực tế ' + called.length);
  console.log('RACE SHOP-PROXY: PASS (proxy riêng trả SRT thật, không gọi đường khác)');

  // Kịch bản 5: proxy riêng trả trang lỗi (200 nhưng sai nội dung) -> rớt xuống đua, cors.lol thắng
  global.fetch = async (u) => {
    if (u.includes('ontopdz.shop/api/subtitle-proxy')) return ok(errPage);
    if (u.startsWith('https://www.subtitlecat.com/')) throw new TypeError('Failed to fetch');
    if (u.includes('allorigins')) return fail(522);
    if (u.includes('codetabs')) return fail(522);
    if (u.includes('cors.lol')) return ok(realSrt);
    throw new Error('unexpected url ' + u);
  };
  const t5 = await fetchTextVia('https://www.subtitlecat.com/subs/1077/x-vi.srt', 'srt');
  if (t5 !== realSrt) throw new Error('race 5: expected real SRT from cors.lol fallback');
  console.log('RACE SHOP-PROXY-BAD: PASS (proxy riêng trả sai nội dung -> đua tiếp, cors.lol thắng)');
}
run().then(() => console.log('FETCH RACE TEST: ALL PASS')).catch(e => { console.error(e); process.exit(1); });
