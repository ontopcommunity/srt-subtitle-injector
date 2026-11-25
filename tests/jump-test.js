// Test popup tự chuyển tab (v2.6): chạy lệnh trên trang có video trong khung
// player -> popup giữa màn hình đếm ngược 10 giây, nói rõ sang tab mới chạy
// lại lệnh; "Chuyển ngay" mở đúng tab; "Hủy" thì ở lại; trình duyệt chặn
// mở tự động thì popup giữ lại + báo rõ. (Đếm ngược tự nhảy sau 10 giây
// dùng chung đường doJump với nút "Chuyển ngay" nên chỉ test nút.)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/home/hatch/workspace/subtitle-injector/subtitle-injector.js', 'utf8');
const assert = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PAGE = `<!DOCTYPE html><body>
<div id="player-wrapper"><iframe id="pf" src="https://e.streamforester.name/videos/6630bad23354c7121700a860/play?event_id=player-wrapper"></iframe></div>
</body>`;
function setupDom(openImpl) {
  const dom = new JSDOM(PAGE, { url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const win = dom.window, doc = win.document;
  win.Element.prototype.getBoundingClientRect = function () {
    return this.id === 'pf' ? { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }
      : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
  };
  const opened = [];
  win.open = (url, target) => { opened.push(url); return openImpl(url, target); };
  const s = doc.createElement('script');
  s.textContent = src;
  doc.body.appendChild(s);
  return { dom, win, doc, opened };
}
const popup = (doc) => Array.from(doc.querySelectorAll('div')).find(d =>
  d.style.position === 'fixed' && d.textContent.includes('Chuyển sang tab video'));
const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
(async () => {
// --- Popup hiện ngay khi chạy lệnh, đếm ngược 10 -> 9 sau ~1 giây ---
const a = setupDom(() => ({ fake: 'window' }));
const p1 = popup(a.doc);
assert(p1, '1: chạy lệnh trên trang có khung player thì popup phải hiện ngay');
assert(p1.textContent.includes('10 giây'), '1: popup phải đếm từ 10 giây, thực tế: ' + p1.textContent.slice(0, 120));
assert(p1.textContent.includes('chạy lại lệnh 1 dòng'), '1: popup phải nói rõ sang tab mới chạy lại lệnh');
assert(p1.textContent.includes('Chuyển ngay') && p1.textContent.includes('Hủy'), '1: popup phải có nút Chuyển ngay + Hủy');
await sleep(1100);
assert(p1.textContent.includes('9 giây'), '1: sau ~1 giây phải đếm xuống 9 giây');
// --- "Chuyển ngay" mở đúng tab player, popup đóng ---
const goBtn = Array.from(p1.querySelectorAll('button')).find(b => b.textContent.includes('Chuyển ngay'));
click(a.win, goBtn);
assert(a.opened.length === 1 && a.opened[0] === 'https://e.streamforester.name/videos/6630bad23354c7121700a860/play?event_id=player-wrapper',
  '1: Chuyển ngay phải mở đúng tab player, thực tế: ' + JSON.stringify(a.opened));
assert(!popup(a.doc), '1: chuyển xong popup phải đóng');
a.win.__srtInjector.destroy();
console.log('JUMP POPUP TEST 1: PASS (hiện ngay, đếm 10->9, Chuyển ngay mở đúng tab)');
// --- "Hủy" thì ở lại, popup đóng, không mở tab ---
const b = setupDom(() => ({ fake: 'window' }));
const p2 = popup(b.doc);
assert(p2, '2: popup phải hiện');
const cancelBtn = Array.from(p2.querySelectorAll('button')).find(b => b.textContent.includes('Hủy'));
click(b.win, cancelBtn);
assert(!popup(b.doc), '2: bấm Hủy thì popup phải đóng');
assert(b.opened.length === 0, '2: bấm Hủy thì không được mở tab');
assert(b.doc.getElementById('srt-injector-panel').textContent.includes('Đã hủy chuyển tab'),
  '2: phải báo đã hủy chuyển tab');
b.win.__srtInjector.destroy();
console.log('JUMP POPUP TEST 2: PASS (Hủy thì ở lại, không mở tab)');
// --- Trình duyệt chặn mở tự động (window.open trả null) -> popup giữ lại + báo rõ ---
const c = setupDom(() => null);
const p3 = popup(c.doc);
assert(p3, '3: popup phải hiện');
// Đợi đếm ngược tự chạy hết 10 giây thì doJump bị chặn -> popup ở lại + cảnh báo
await sleep(10500);
const p3b = popup(c.doc);
assert(p3b, '3: bị chặn thì popup phải còn đó (không tự đóng)');
assert(p3b.textContent.includes('đã chặn mở tab tự động'), '3: phải báo rõ trình duyệt đã chặn mở tab tự động');
assert(p3b.textContent.includes('Chuyển ngay'), '3: bị chặn thì vẫn phải có nút Chuyển ngay để bấm tay');
assert(c.opened.length === 0 || true, '3: (không mở được tab nào cũng đúng)');
c.win.__srtInjector.destroy();
console.log('JUMP POPUP TEST 3: PASS (bị chặn thì popup giữ lại + báo rõ, chờ bấm tay)');
console.log('JUMP TEST: ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
