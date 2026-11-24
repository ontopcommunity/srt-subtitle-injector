// Test đồng hồ chế độ khung player: chạy theo giờ riêng, dừng thì đứng yên,
// chạy lại thì tiếp tục từ chỗ cũ (không về 0), nút ± chỉnh giờ, ↺ về 0.
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
(async () => {
const dom = new JSDOM(`<!DOCTYPE html><body>
<div id="player-wrapper"><iframe id="pf" src="https://e.streamforester.name/videos/abc/play"></iframe></div>
</body>`, { url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'dangerously' });
const win = dom.window, doc = win.document;
win.localStorage.setItem('srtInjectorSettings', JSON.stringify({ autoPortrait: false }));
win.Element.prototype.getBoundingClientRect = function () {
  return this.id === 'pf' ? { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }
    : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
};
const s = doc.createElement('script');
s.textContent = src;
doc.body.appendChild(s);
const panel = doc.getElementById('srt-injector-panel');
const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const btn = (t) => Array.from(panel.querySelectorAll('button')).find(b => b.textContent.includes(t));
const subText = () => { const el = doc.getElementById('srt-injector-text'); return el.style.display === 'none' ? '' : el.textContent; };
win.__srtInjector.loadText(TEST_SRT, 'test.srt');
assert(win.__srtInjector.cues.length === 2, 'phải nạp được 2 câu');
// chọn Khung 1 rồi Bắt đầu
click(btn('Quét lại'));
const sel = panel.querySelector('select');
sel.value = '0';
sel.dispatchEvent(new win.Event('change', { bubbles: true }));
click(btn('▶ Bắt đầu'));
assert(win.__srtInjector.running === true && win.__srtInjector.iframeMode === true, 'phải chạy ở chế độ khung');
// đợi ~0.7s -> câu 1 (0.5-3.0s)
await sleep(700);
assert(subText() === 'CAU MOT', 'sau 0.7s phải hiện CAU MOT, thực tế: ' + JSON.stringify(subText()));
// +1s x3 -> ~3.7s -> câu 2 (3.5-6.0s)
click(btn('+1s')); click(btn('+1s')); click(btn('+1s'));
assert(subText() === 'CAU HAI', 'sau +3s phải hiện CAU HAI, thực tế: ' + JSON.stringify(subText()));
// −5s -> về 0 (kẹp) -> chưa tới câu nào
click(btn('−5s'));
assert(subText() === '', '−5s phải về trước câu 1, thực tế: ' + JSON.stringify(subText()));
// chạy tiếp ~0.7s -> câu 1 lại
await sleep(700);
assert(subText() === 'CAU MOT', 'chạy lại 0.7s phải hiện CAU MOT');
// Dừng -> đồng hồ đứng yên
const t1 = win.__srtInjector.time;
click(btn('⏸ Dừng'));
assert(win.__srtInjector.running === false, 'phải dừng');
await sleep(600);
const t2 = win.__srtInjector.time;
assert(Math.abs(t2 - t1) < 0.05, 'dừng rồi đồng hồ phải đứng yên, ' + t1 + ' -> ' + t2);
// Bắt đầu lại -> tiếp tục từ chỗ cũ, không về 0
click(btn('▶ Bắt đầu'));
assert(win.__srtInjector.running === true, 'phải chạy lại');
await sleep(600);
const t3 = win.__srtInjector.time;
assert(t3 - t2 > 0.4, 'chạy lại đồng hồ phải tiếp tục, ' + t2 + ' -> ' + t3);
assert(t3 < 3, 'chạy lại không được về 0, giờ: ' + t3);
// ↺ về 0
click(btn('↺ 0:00'));
assert(win.__srtInjector.time < 0.5, '↺ phải về gần 0, giờ: ' + win.__srtInjector.time);
win.__srtInjector.stop();   // dừng nhịp đồng hồ để tiến trình thoát
console.log('CLOCK TEST: PASS (đồng hồ chạy/dừng/tiếp tục, ± chỉnh giờ, ↺ về 0)');
})().catch(e => { console.error(e); process.exit(1); });
