/* ============================================================================
 * SRT Subtitle Injector — chèn phụ đề .srt vào video đang phát trên bất kỳ web nào
 * ----------------------------------------------------------------------------
 * CÁCH DÙNG (dán 1 dòng vào console của DevTools, thay bằng link raw của bạn):
 *   fetch('https://raw.githubusercontent.com/ontopcommunity/srt-subtitle-injector/main/subtitle-injector.js')
 *     .then(r => r.text()).then(t => eval(t))
 *
 * Sau khi chạy, một bảng điều khiển hiện ở góc phải màn hình:
 *   - Chọn file .srt (hoặc .vtt) / dán link file .srt / kéo-thả file vào bảng
 *   - Chỉnh cỡ chữ, vị trí, màu chữ, nền, căn lề, độ lệch thời gian (sync)
 *   - Phụ đề tự khớp theo thời gian trong file .srt, bám theo video kể cả fullscreen
 *
 * Chạy lại lệnh trên bất cứ lúc nào để reset sạch (bản cũ tự gỡ trước khi chạy mới).
 * Không cần cài gì thêm, không gửi dữ liệu đi đâu. Cài đặt được lưu localStorage.
 * ========================================================================== */
(() => {
  'use strict';

  /* ---------- Dọn bản cũ nếu chạy lại lệnh ---------- */
  if (window.__srtInjector && typeof window.__srtInjector.destroy === 'function') {
    window.__srtInjector.destroy();
  }

  const STORE_KEY = 'srtInjectorSettings';
  const DEFAULTS = {
    fontSize: 24,        // px
    bottomPct: 8,        // vị trí phụ đề tính từ đáy video (% chiều cao video)
    offsetSec: 0,        // lệch thời gian: + là phụ đề chạy sớm hơn, - là chạy trễ hơn
    color: '#ffffff',
    bgAlpha: 0.55,       // độ đậm nền đen sau chữ (0 = không nền)
    align: 'center',     // left | center | right
    bold: true,
    show: true,
  };

  /* ---------- Đọc / lưu cài đặt ---------- */
  let settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') settings = { ...DEFAULTS, ...saved };
  } catch (e) { /* kệ, dùng mặc định */ }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* kệ */ }
  }

  /* ---------- Parse file .srt / .vtt ---------- */
  // "00:00:12,930" hoặc "00:00:12.930" -> giây (số thực)
  function parseTime(s) {
    const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
    if (!m) return null;
    const h = +(m[1] || 0), min = +m[2], sec = +m[3], ms = +m[4].padEnd(3, '0');
    return h * 3600 + min * 60 + sec + ms / 1000;
  }

  // Chỉ giữ lại các thẻ định dạng hay gặp trong .srt, còn lại escape hết (chống HTML lạ)
  function cleanText(raw) {
    let t = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>');                       // <i> <b> <u>
    t = t.replace(/&lt;font\s+color=["']?([^"'&; ]+)["']?&gt;/gi, '<span style="color:$1">');
    t = t.replace(/&lt;\/font&gt;/gi, '</span>');
    return t;
  }

  // Trả về mảng [{ start, end, html }] đã sắp xếp theo thời gian
  function parseSRT(text) {
    const cues = [];
    const norm = text.replace(/^\uFEFF/, '')              // bỏ BOM
      .replace(/\r\n?/g, '\n')
      .replace(/^WEBVTT[^\n]*\n(?:\n)?/i, '');             // bỏ header nếu là .vtt
    for (const block of norm.split(/\n\s*\n/)) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;
      let i = 0;
      if (/^\d+$/.test(lines[0])) i = 1;                  // bỏ dòng số thứ tự
      const tm = lines[i] && lines[i].match(/^(.+?)\s*-->\s*(.+)$/);
      if (!tm) continue;
      const start = parseTime(tm[1]), end = parseTime(tm[2]);
      if (start === null || end === null || end <= start) continue;
      const html = lines.slice(i + 1).map(cleanText).join('<br>');
      if (html) cues.push({ start, end, html });
    }
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  /* ---------- Tìm video đang phát ---------- */
  function findVideos() {
    return [...document.querySelectorAll('video')].filter(v => {
      const r = v.getBoundingClientRect();
      return r.width > 50 && r.height > 50 && getComputedStyle(v).visibility !== 'hidden';
    });
  }
  function pickVideo(list) {
    if (!list.length) return null;
    const playing = list.filter(v => !v.paused && v.currentTime > 0);
    const pool = playing.length ? playing : list;
    return pool.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    })[0];
  }

  /* ---------- State ---------- */
  let video = null;
  let cues = [];
  let lastIdx = -1;          // cue đang hiển thị
  let rafId = 0;
  let destroyed = false;
  let parentOrigPos = '';    // position gốc của thẻ cha (để trả lại khi gỡ)
  let parentEl = null;

  /* ---------- Lớp phủ phụ đề (bám theo video, kể cả fullscreen) ---------- */
  const overlay = document.createElement('div');
  overlay.id = 'srt-injector-overlay';
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '2147483647', overflow: 'hidden',
  });

  const subEl = document.createElement('div');
  subEl.id = 'srt-injector-text';
  overlay.appendChild(subEl);

  function applySubStyle() {
    Object.assign(subEl.style, {
      position: 'absolute',
      left: '4%', right: '4%',
      bottom: settings.bottomPct + '%',
      textAlign: settings.align,
      fontSize: settings.fontSize + 'px',
      lineHeight: '1.35',
      fontWeight: settings.bold ? '700' : '400',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: settings.color,
      background: settings.bgAlpha > 0 ? `rgba(0,0,0,${settings.bgAlpha})` : 'transparent',
      padding: settings.bgAlpha > 0 ? '2px 10px' : '0',
      borderRadius: '6px',
      textShadow: '0 1px 2px #000, 0 0 8px rgba(0,0,0,.9)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      display: 'none',
    });
  }
  applySubStyle();

  // Gắn lớp phủ vào thẻ cha của video; nếu đang fullscreen thì gắn vào chính
  // phần tử fullscreen (để phụ đề không bị mất khi xem full màn hình).
  function attachOverlay() {
    if (!video || destroyed) return;
    const fs = document.fullscreenElement;
    const host = (fs && fs.contains(video)) ? fs : video.parentElement;
    if (!host) return;
    if (overlay.parentElement !== host) {
      if (parentEl && parentEl.contains(overlay)) parentEl.removeChild(overlay);
      parentEl = host;
      const cs = getComputedStyle(host);
      if (cs.position === 'static') {
        parentOrigPos = host.style.position || '';
        host.style.position = 'relative';
      }
      host.appendChild(overlay);
    }
  }

  /* ---------- Vòng lặp đồng bộ phụ đề theo thời gian video ---------- */
  function currentCue(t) {
    if (!cues.length) return -1;
    if (lastIdx >= 0 && lastIdx < cues.length) {
      const c = cues[lastIdx];
      if (t >= c.start && t < c.end) return lastIdx;   // vẫn đang ở cue cũ
    }
    if (lastIdx >= 0 && t < cues[lastIdx].start) lastIdx = -1;  // tua ngược -> tìm lại
    let i = Math.max(lastIdx, -1);
    while (i + 1 < cues.length && cues[i + 1].start <= t) i++;
    if (i >= 0 && t < cues[i].end) return i;
    return -1;
  }

  function tick() {
    if (destroyed) return;
    if (video && cues.length && settings.show) {
      const t = video.currentTime + settings.offsetSec;
      const idx = currentCue(t);
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (idx >= 0) {
          subEl.innerHTML = cues[idx].html;
          subEl.style.display = 'block';
        } else {
          subEl.style.display = 'none';
        }
      }
    } else if (subEl.style.display !== 'none') {
      subEl.style.display = 'none';
    }
    updateStatus();
    rafId = requestAnimationFrame(tick);
  }

  /* ---------- Bảng điều khiển ---------- */
  const panel = document.createElement('div');
  panel.id = 'srt-injector-panel';
  Object.assign(panel.style, {
    position: 'fixed', top: '12px', right: '12px', width: '300px',
    zIndex: '2147483647', background: 'rgba(17,17,22,.94)', color: '#eee',
    fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px',
    border: '1px solid #333', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,.5)',
    userSelect: 'none',
  });

  const row = (label, inner) => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:8px;margin:7px 0;';
    const l = document.createElement('label');
    l.style.cssText = 'flex:0 0 86px;color:#bbb;';
    l.textContent = label;
    d.appendChild(l);
    d.appendChild(inner);
    return d;
  };
  const mkInput = (type, attrs = {}) => {
    const el = document.createElement('input');
    el.type = type;
    Object.assign(el, attrs);
    el.style.cssText = 'flex:1;min-width:0;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:5px 7px;';
    return el;
  };
  const mkBtn = (text) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'background:#0ea5a4;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;';
    return b;
  };
  const mkVal = (text) => {
    const s = document.createElement('span');
    s.style.cssText = 'flex:0 0 46px;text-align:right;color:#7dd3d2;font-variant-numeric:tabular-nums;';
    s.textContent = text;
    return s;
  };

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:move;border-bottom:1px solid #2a2a2a;font-weight:bold;';
  header.innerHTML = '<span>🎬 Phụ đề SRT</span>';
  const headerBtns = document.createElement('span');
  const minBtn = document.createElement('button');
  minBtn.textContent = '—';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  [minBtn, closeBtn].forEach(b => b.style.cssText = 'background:none;border:none;color:#aaa;font-size:14px;cursor:pointer;padding:2px 7px;');
  headerBtns.append(minBtn, closeBtn);
  header.appendChild(headerBtns);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'padding:4px 12px 12px;';
  panel.appendChild(body);

  // Kéo thả panel bằng tiêu đề
  let drag = null;
  header.addEventListener('mousedown', e => {
    if (e.target === minBtn || e.target === closeBtn) return;
    drag = { x: e.clientX - panel.getBoundingClientRect().left, y: e.clientY - panel.getBoundingClientRect().top };
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left = Math.max(0, e.clientX - drag.x) + 'px';
    panel.style.top = Math.max(0, e.clientY - drag.y) + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => (drag = null));

  minBtn.onclick = () => (body.style.display = body.style.display === 'none' ? '' : 'none');

  // Hàng: chọn video (nếu trang có nhiều video)
  const videoSel = document.createElement('select');
  videoSel.style.cssText = 'flex:1;min-width:0;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:5px 7px;';
  function refreshVideoList() {
    const list = findVideos();
    const cur = videoSel.value;
    videoSel.innerHTML = '';
    if (!list.length) {
      videoSel.innerHTML = '<option value="">Không thấy video nào</option>';
      video = null;
      return;
    }
    list.forEach((v, i) => {
      const o = document.createElement('option');
      const r = v.getBoundingClientRect();
      o.value = String(i);
      o.textContent = `Video ${i + 1} — ${Math.round(r.width)}×${Math.round(r.height)}${v.paused ? '' : ' ▶'}`;
      videoSel.appendChild(o);
    });
    const idx = Math.max(0, Math.min(+cur || 0, list.length - 1));
    videoSel.value = String(idx);
    setVideo(list[idx]);
  }
  function setVideo(v) {
    video = v;
    lastIdx = -1;
    attachOverlay();
    updateStatus();
  }
  videoSel.onchange = () => {
    const list = findVideos();
    if (list[+videoSel.value]) setVideo(list[+videoSel.value]);
  };
  const rescanBtn = mkBtn('Quét lại');
  rescanBtn.onclick = refreshVideoList;
  const videoRow = row('Video', videoSel);
  const rescanWrap = document.createElement('span');
  rescanWrap.appendChild(rescanBtn);
  videoRow.appendChild(rescanWrap);
  body.appendChild(videoRow);

  // Hàng: chọn file .srt
  const fileInput = mkInput('file', { accept: '.srt,.vtt' });
  fileInput.style.padding = '3px';
  fileInput.onchange = () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFile(f);
  };
  body.appendChild(row('File .srt', fileInput));

  // Hàng: tải .srt từ link
  const urlInput = mkInput('text', { placeholder: 'https://.../phude.srt' });
  const urlBtn = mkBtn('Tải');
  urlBtn.onclick = async () => {
    const url = urlInput.value.trim();
    if (!url) return setStatus('Dán link file .srt vào ô trên đã.');
    setStatus('Đang tải file...');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      loadText(await res.text(), url.split('/').pop() || 'phude.srt');
    } catch (e) {
      setStatus('Không tải được link (thường do web đó chặn CORS). Hãy tải file về máy rồi chọn file ở trên.');
    }
  };
  const urlRow = row('Link .srt', urlInput);
  const urlWrap = document.createElement('span');
  urlWrap.appendChild(urlBtn);
  urlRow.appendChild(urlWrap);
  body.appendChild(urlRow);

  // Kéo-thả file vào bảng
  panel.addEventListener('dragover', e => e.preventDefault());
  panel.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  // Hàng: cỡ chữ
  const sizeInput = mkInput('range', { min: 12, max: 64, step: 1, value: settings.fontSize });
  const sizeVal = mkVal(settings.fontSize + 'px');
  sizeInput.oninput = () => {
    settings.fontSize = +sizeInput.value;
    sizeVal.textContent = settings.fontSize + 'px';
    applySubStyle(); saveSettings();
  };
  const sizeRow = row('Cỡ chữ', sizeInput); sizeRow.appendChild(sizeVal);
  body.appendChild(sizeRow);

  // Hàng: vị trí (cách đáy video)
  const posInput = mkInput('range', { min: 0, max: 40, step: 1, value: settings.bottomPct });
  const posVal = mkVal(settings.bottomPct + '%');
  posInput.oninput = () => {
    settings.bottomPct = +posInput.value;
    posVal.textContent = settings.bottomPct + '%';
    applySubStyle(); saveSettings();
  };
  const posRow = row('Vị trí', posInput); posRow.appendChild(posVal);
  body.appendChild(posRow);

  // Hàng: lệch thời gian (đồng bộ) — kèm nút chỉnh nhanh ±0.5s
  const offInput = mkInput('range', { min: -10, max: 10, step: 0.1, value: settings.offsetSec });
  const offVal = mkVal((settings.offsetSec > 0 ? '+' : '') + settings.offsetSec.toFixed(1) + 's');
  function setOffset(v) {
    settings.offsetSec = Math.max(-10, Math.min(10, Math.round(v * 10) / 10));
    offInput.value = settings.offsetSec;
    offVal.textContent = (settings.offsetSec > 0 ? '+' : '') + settings.offsetSec.toFixed(1) + 's';
    lastIdx = -1; saveSettings();
  }
  offInput.oninput = () => setOffset(+offInput.value);
  const offRow = row('Lệch giờ', offInput);
  offRow.appendChild(offVal);
  const minusBtn = mkBtn('−0.5s'); minusBtn.onclick = () => setOffset(settings.offsetSec - 0.5);
  const plusBtn = mkBtn('+0.5s'); plusBtn.onclick = () => setOffset(settings.offsetSec + 0.5);
  const offBtns = document.createElement('div');
  offBtns.style.cssText = 'display:flex;gap:6px;margin:-2px 0 7px 94px;';
  offBtns.append(minusBtn, plusBtn);
  body.appendChild(offRow);
  body.appendChild(offBtns);

  // Hàng: màu chữ / nền / căn lề / đậm
  const colorInput = mkInput('color', { value: settings.color });
  colorInput.style.padding = '2px';
  colorInput.oninput = () => { settings.color = colorInput.value; applySubStyle(); saveSettings(); };
  body.appendChild(row('Màu chữ', colorInput));

  const bgInput = mkInput('range', { min: 0, max: 0.9, step: 0.05, value: settings.bgAlpha });
  const bgVal = mkVal(Math.round(settings.bgAlpha * 100) + '%');
  bgInput.oninput = () => {
    settings.bgAlpha = +bgInput.value;
    bgVal.textContent = Math.round(settings.bgAlpha * 100) + '%';
    applySubStyle(); saveSettings();
  };
  const bgRow = row('Nền đen', bgInput); bgRow.appendChild(bgVal);
  body.appendChild(bgRow);

  const alignSel = document.createElement('select');
  alignSel.style.cssText = 'flex:1;min-width:0;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:5px 7px;';
  [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']].forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = t; alignSel.appendChild(o);
  });
  alignSel.value = settings.align;
  alignSel.onchange = () => { settings.align = alignSel.value; applySubStyle(); saveSettings(); };
  body.appendChild(row('Căn lề', alignSel));

  const boldChk = document.createElement('input');
  boldChk.type = 'checkbox'; boldChk.checked = settings.bold;
  boldChk.onchange = () => { settings.bold = boldChk.checked; applySubStyle(); saveSettings(); };
  const showChk = document.createElement('input');
  showChk.type = 'checkbox'; showChk.checked = settings.show;
  showChk.onchange = () => { settings.show = showChk.checked; saveSettings(); };
  const chkRow = document.createElement('div');
  chkRow.style.cssText = 'display:flex;gap:18px;margin:8px 0;';
  const boldLab = document.createElement('label');
  boldLab.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer;';
  boldLab.append(boldChk, document.createTextNode('Chữ đậm'));
  const showLab = document.createElement('label');
  showLab.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer;';
  showLab.append(showChk, document.createTextNode('Hiện phụ đề'));
  chkRow.append(boldLab, showLab);
  body.appendChild(chkRow);

  // Dòng trạng thái
  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'margin-top:6px;padding-top:8px;border-top:1px solid #2a2a2a;color:#999;font-size:12px;line-height:1.5;min-height:18px;';
  body.appendChild(statusEl);
  let statusText = '';
  function setStatus(s) { statusText = s; statusEl.textContent = s; }
  function updateStatus() {
    if (!statusEl.isConnected) return;
    const vt = video ? video.currentTime.toFixed(1) + 's' : '—';
    statusEl.textContent = statusText
      ? statusText + (video ? ` | Video: ${vt}` : '')
      : (video ? `Video: ${vt} | ${cues.length ? cues.length + ' câu phụ đề' : 'Chưa có phụ đề'}` : 'Chưa thấy video — bấm "Quét lại".');
  }

  /* ---------- Nạp file phụ đề ---------- */
  function loadText(text, name) {
    cues = parseSRT(text);
    lastIdx = -1;
    if (!cues.length) {
      setStatus('File không đọc được câu nào — kiểm tra lại định dạng .srt.');
      return;
    }
    setStatus(`Đã tải "${name}" — ${cues.length} câu.`);
    updateStatus();
  }
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result || ''), file.name);
    reader.onerror = () => setStatus('Không đọc được file.');
    reader.readAsText(file);
  }

  /* ---------- Gỡ bỏ sạch ---------- */
  function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    document.removeEventListener('fullscreenchange', onFs);
    if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    if (panel.parentElement) panel.parentElement.removeChild(panel);
    if (parentEl && parentOrigPos !== undefined && parentEl.style.position === 'relative') {
      parentEl.style.position = parentOrigPos;
    }
    if (window.__srtInjector && window.__srtInjector.destroy === destroy) {
      delete window.__srtInjector;
    }
  }
  closeBtn.onclick = destroy;

  function onFs() { attachOverlay(); }
  document.addEventListener('fullscreenchange', onFs);

  window.__srtInjector = {
    destroy,
    setVideo,
    refreshVideoList,
    loadText,
    get cues() { return cues; },
    get video() { return video; },
  };

  /* ---------- Khởi động ---------- */
  document.body.appendChild(panel);
  refreshVideoList();
  if (video) setStatus('');
  else setStatus('Chưa thấy video — mở video rồi bấm "Quét lại".');
  updateStatus();
  rafId = requestAnimationFrame(tick);
  console.log('%c[SRT Injector] đã chạy. Chọn file .srt trong bảng điều khiển góc phải.',
    'color:#0ea5a4;font-weight:bold;');
})();
