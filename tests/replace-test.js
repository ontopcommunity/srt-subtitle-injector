// Test thay player (v2.4): iframe player được thế bằng <video> gốc (HLS),
// phụ đề bám đúng giờ video — tua tới đâu đúng đoạn phụ đề tới đó; khôi
// phục thì iframe cũ quay lại. Chrome (không phát HLS gốc) thì từ chối.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/home/hatch/workspace/subtitle-injector/subtitle-injector.js', 'utf8');
const assert = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const TEST_SRT = `1
00:00:00,500 --> 00:00:03,000
CAU MOT

2
00:00:03,500 --> 00:00:06,000
CAU HAI
`;
const MASTER = 'https://wogplayer.top/videos/6630bad23354c7121700a860/master.m3u8?d=example.com&e=1&s=abc';
const PAGE = `<!DOCTYPE html><body>
<div id="player-wrapper"><iframe id="pf" src="https://e.streamforester.name/videos/6630bad23354c7121700a860/play?event_id=player-wrapper"></iframe></div>
</body>`;
function setupDom(canPlayHls) {
  const dom = new JSDOM(PAGE, { url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const win = dom.window, doc = win.document;
  win.localStorage.setItem('srtInjectorSettings', JSON.stringify({ autoPortrait: false }));
  win.Element.prototype.getBoundingClientRect = function () {
    return this.id === 'pf' ? { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }
      : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
  };
  // Giả lập Safari (phát HLS gốc) hoặc Chrome (không phát được)
  win.HTMLVideoElement.prototype.canPlayType = function (t) {
    return (canPlayHls && t === 'application/vnd.apple.mpegurl') ? 'probably' : '';
  };
  const fetched = [];
  win.fetch = async (url) => {
    fetched.push(url);
    return { json: async () => ({ sources: [{ label: 'HLS', type: 'application/vnd.apple.mpegurl', file: MASTER }] }) };
  };
  const s = doc.createElement('script');
  s.textContent = src;
  doc.body.appendChild(s);
  return { dom, win, doc, fetched };
}
(async () => {
// --- Safari: thay player thành công, tua thì phụ đề đổi theo ---
const { win, doc, fetched } = setupDom(true);
const panel = doc.getElementById('srt-injector-panel');
const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const btn = (t) => Array.from(panel.querySelectorAll('button')).find(b => b.textContent.includes(t));
const subText = () => { const el = doc.getElementById('srt-injector-text'); return el.style.display === 'none' ? '' : el.textContent; };
win.__srtInjector.loadText(TEST_SRT, 'test.srt');
click(btn('Quét lại'));
const sel = panel.querySelector('select');
sel.value = '0';
sel.dispatchEvent(new win.Event('change', { bubbles: true }));
assert(btn('Thay player').style.display !== 'none', 'Safari: chọn Khung 1 thì nút Thay player phải hiện');
const frame = doc.getElementById('pf');   // giữ tham chiếu iframe GỐC trước khi nó bị thay ra
click(btn('Thay player'));
await sleep(100);
assert(fetched.length === 1 && fetched[0].includes('/api/player-config?id=6630bad23354c7121700a860&d=example.com'),
  'phải gọi proxy cấu hình đúng id + domain, thực tế: ' + JSON.stringify(fetched));
assert(!doc.contains(frame), 'Safari: iframe gốc phải bị gỡ khỏi trang');
const v = doc.querySelector('#player-wrapper video');
assert(v, 'Safari: phải có <video> thế chỗ trong #player-wrapper');
assert(v.src === MASTER, 'Safari: video phải dùng link HLS gốc, thực tế: ' + v.src);
assert(v.controls === true, 'Safari: video gốc phải có thanh điều khiển (để tua)');
assert(win.__srtInjector.video === v && win.__srtInjector.nativeVideo === v, 'Safari: __srtInjector.video phải là video gốc');
assert(win.__srtInjector.running === true && win.__srtInjector.iframeMode === false, 'Safari: phải chạy ở chế độ video (không phải đồng hồ)');
assert(btn('Khôi phục player').style.display !== 'none', 'Safari: sau khi thay phải hiện nút Khôi phục player');
// Tua tới 4s -> câu 2; tua ngược về 1s -> câu 1 (đây là cái user cần)
v.currentTime = 4;
v.dispatchEvent(new win.Event('timeupdate'));
assert(subText() === 'CAU HAI', 'tua tới 4s phải hiện CAU HAI, thực tế: ' + JSON.stringify(subText()));
v.currentTime = 1;
v.dispatchEvent(new win.Event('seeked'));
assert(subText() === 'CAU MOT', 'tua ngược về 1s phải hiện CAU MOT, thực tế: ' + JSON.stringify(subText()));
// Khôi phục: iframe cũ quay lại, video gốc biến mất
click(btn('Khôi phục player'));
assert(doc.contains(frame) && doc.querySelector('#player-wrapper iframe') === frame, 'khôi phục: iframe gốc phải quay lại đúng chỗ');
assert(!doc.querySelector('#player-wrapper video'), 'khôi phục: video gốc phải biến mất');
assert(win.__srtInjector.running === false && win.__srtInjector.nativeVideo === null, 'khôi phục: phải dừng và nativeVideo null');
console.log('REPLACE SAFARI TEST: PASS (thay player -> video gốc, tua đổi phụ đề theo, khôi phục được)');
// --- Chrome: không phát được HLS gốc -> từ chối, giữ nguyên iframe ---
const c2 = setupDom(false);
const w2 = c2.win, d2 = c2.doc;
const panel2 = d2.getElementById('srt-injector-panel');
const click2 = (el) => el.dispatchEvent(new w2.MouseEvent('click', { bubbles: true, cancelable: true }));
const btn2 = (t) => Array.from(panel2.querySelectorAll('button')).find(b => b.textContent.includes(t));
w2.__srtInjector.loadText(TEST_SRT, 'test.srt');
click2(btn2('Quét lại'));
const sel2 = panel2.querySelector('select');
sel2.value = '0';
sel2.dispatchEvent(new w2.Event('change', { bubbles: true }));
click2(btn2('Thay player'));
await sleep(100);
assert(c2.fetched.length === 0, 'Chrome: chưa cần gọi proxy vì đã biết không phát được');
assert(d2.contains(d2.getElementById('pf')), 'Chrome: iframe gốc phải còn nguyên');
assert(!d2.querySelector('#player-wrapper video'), 'Chrome: không được tạo video gốc');
assert(w2.__srtInjector.running === false, 'Chrome: không được chạy');
assert(panel2.textContent.includes('không phát được video gốc'), 'Chrome: phải báo rõ trình duyệt không phát được');
console.log('REPLACE CHROME TEST: PASS (từ chối rõ ràng, giữ nguyên iframe)');
console.log('REPLACE TEST: ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
