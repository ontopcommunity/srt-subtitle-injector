// Test nút Bắt đầu/Dừng là MỘT nút đổi trạng thái + Bắt đầu thông minh:
// - chưa có phụ đề: bấm -> vẫn "Bắt đầu", báo rõ chưa có phụ đề
// - có phụ đề + video trực tiếp: bấm -> thành "Dừng" + đang chạy; bấm nữa -> về "Bắt đầu"
// - có phụ đề + chỉ có iframe đã chọn: bấm -> mở tab player (không chạy tại chỗ)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/home/hatch/workspace/subtitle-injector/subtitle-injector.js', 'utf8');
const realSrt = fs.readFileSync('/home/hatch/workspace/subtitle-injector/research/cl-vi.srt', 'utf8');
const assert = (c, m) => { if (!c) throw new Error(m); };
(async () => {
const loadScript = (dom) => {
  const s = dom.window.document.createElement('script');
  s.textContent = src;
  dom.window.document.body.appendChild(s);
};
const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

// --- Trang có video trực tiếp ---
const dom1 = new JSDOM('<!DOCTYPE html><body><video id="v" src="x.mp4"></video></body>', {
  url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'dangerously',
});
const w1 = dom1.window, d1 = w1.document;
w1.Element.prototype.getBoundingClientRect = function () {
  return this.id === 'v' ? { width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }
    : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
};
loadScript(dom1);
const panel1 = d1.getElementById('srt-injector-panel');
const toggle1 = () => Array.from(panel1.querySelectorAll('button')).find(b => /Bắt đầu|Dừng|quét/.test(b.textContent));
// 1. chưa có phụ đề -> bấm không chạy, nút vẫn "Bắt đầu", báo rõ
click(w1, toggle1());
assert(toggle1().textContent.includes('Bắt đầu'), '1: chưa có phụ đề, nút phải vẫn là Bắt đầu');
assert(w1.__srtInjector.running === false, '1: chưa có phụ đề, không được chạy');
assert(panel1.textContent.includes('Chưa có phụ đề'), '1: phải báo rõ chưa có phụ đề');
// 2. nạp phụ đề rồi bấm -> thành "Dừng" + đang chạy
w1.__srtInjector.loadText(realSrt, 'test.srt');
assert(w1.__srtInjector.cues.length > 100, '2: phải nạp được phụ đề');
click(w1, toggle1());
assert(toggle1().textContent.includes('Dừng'), '2: đang chạy, nút phải thành Dừng, thực tế: ' + toggle1().textContent);
assert(w1.__srtInjector.running === true, '2: phải đang chạy');
// 3. bấm nữa -> dừng, nút về "Bắt đầu"
click(w1, toggle1());
assert(toggle1().textContent.includes('Bắt đầu'), '3: dừng xong, nút phải về Bắt đầu');
assert(w1.__srtInjector.running === false, '3: phải dừng hẳn');
console.log('TOGGLE VIDEO TEST: PASS (1 nút đổi trạng thái, chưa có phụ đề thì báo rõ)');

// --- Trang chỉ có iframe player (tắt tự phóng dọc để khung giữ nguyên cỡ) ---
const dom2 = new JSDOM(`<!DOCTYPE html><body>
<div id="player-wrapper"><iframe id="pf" src="https://e.streamforester.name/videos/abc/play"></iframe></div>
</body>`, { url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'dangerously' });
const w2 = dom2.window, d2 = w2.document;
const opened = [];
w2.open = (url) => { opened.push(url); return null; };
w2.localStorage.setItem('srtInjectorSettings', JSON.stringify({ autoPortrait: false }));
w2.Element.prototype.getBoundingClientRect = function () {
  return this.id === 'pf' ? { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }
    : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
};
loadScript(dom2);
const panel2 = d2.getElementById('srt-injector-panel');
const toggle2 = () => Array.from(panel2.querySelectorAll('button')).find(b => /Bắt đầu|Dừng|quét/.test(b.textContent));
const sel2 = panel2.querySelector('select');
const btn2 = (t) => Array.from(panel2.querySelectorAll('button')).find(b => b.textContent.includes(t));
w2.__srtInjector.loadText(realSrt, 'test.srt');
// Quét rồi chọn Khung 1 trong dropdown
click(w2, btn2('Quét lại'));
assert(sel2.options.length >= 1 && sel2.options[0].textContent.startsWith('Khung 1'), '4: dropdown phải có Khung 1, thực tế: ' + sel2.options[0].textContent);
sel2.value = '0';
sel2.dispatchEvent(new w2.Event('change', { bubbles: true }));
// Nút Mở tab player vẫn mở đúng tab (lựa chọn đồng bộ chính xác)
assert(btn2('Mở tab player').style.display !== 'none', '4: chọn Khung 1 thì nút Mở tab player phải hiện');
click(w2, btn2('Mở tab player'));
assert(opened.length === 1 && opened[0] === 'https://e.streamforester.name/videos/abc/play', '4: phải mở đúng tab player, thực tế: ' + JSON.stringify(opened));
// Bấm Bắt đầu -> chạy phụ đề NGAY Ở TRANG CHÍNH: lớp nằm trên khung, theo đồng hồ
click(w2, toggle2());
assert(w2.__srtInjector.running === true, '4: phải chạy ở trang chính');
assert(w2.__srtInjector.iframeMode === true, '4: phải ở chế độ khung player');
assert(toggle2().textContent.includes('Dừng'), '4: đang chạy, nút phải thành Dừng');
const ov2 = d2.getElementById('srt-injector-overlay');
assert(ov2 && ov2.parentElement && ov2.parentElement.id === 'player-wrapper', '4: lớp phụ đề phải nằm trong thẻ cha của khung');
assert(ov2.style.width === '800px' && ov2.style.height === '450px', '4: lớp phủ phải đúng bằng khung, thực tế: ' + ov2.style.width + 'x' + ov2.style.height);
assert(panel2.textContent.includes('Đồng hồ:'), '4: phải hiện hàng đồng hồ');
assert(panel2.textContent.includes('theo đồng hồ'), '4: phải báo chạy theo đồng hồ');
w2.__srtInjector.stop();   // dừng nhịp đồng hồ để tiến trình thoát
console.log('TOGGLE IFRAME TEST: PASS (chọn khung rồi Bắt đầu -> phụ đề trên khung theo đồng hồ, nút tab vẫn mở được)');
console.log('TOGGLE TEST: ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
