/* ============================================================================
 * SRT Subtitle Injector v1.1 — chèn phụ đề .srt vào video đang phát
 * ----------------------------------------------------------------------------
 * CÁCH DÙNG (dán 1 dòng vào console của DevTools):
 *   fetch('https://raw.githubusercontent.com/ontopcommunity/srt-subtitle-injector/main/subtitle-injector.js')
 *     .then(r => r.text()).then(t => eval(t))
 *
 * LUỒNG MỚI:
 *   1. Chọn file .srt 1 lần — file được LƯU SẴN trong máy (localStorage),
 *      lần sau chạy lệnh là có sẵn, không cần chọn lại.
 *   2. Bấm "▶ Bắt đầu" — tool quét video đang chạy 1 lần duy nhất, chèn
 *      phụ đề vào rồi NGỪNG QUÉT hẳn (không còn vòng lặp nào chạy nền).
 *   3. Phụ đề đồng bộ theo sự kiện của video (timeupdate/seeked), không dùng
 *      requestAnimationFrame: tua đến đâu phụ đề bay đến đó ngay lập tức,
 *      kể cả bấm sang mốc thời gian khác trong video.
 *
 * SIÊU TỐI ƯU (bật mặc định, tắt được trong bảng):
 *   - Không vòng lặp, không setInterval, không quét liên tục — chỉ chạy khi
 *     video phát sự kiện. Chỉ ghi DOM khi câu phụ đề thật sự đổi.
 *   - Tạm dừng các video khác trên trang (chỉ giữ video đang xem).
 *   - Đóng băng hiệu ứng animation/transition của trang (video không ảnh hưởng).
 *   - Dòng trạng thái chỉ cập nhật tối đa 1 lần/giây.
 *
 * VIDEO NẰM TRONG IFRAME (player nhúng kiểu <div id="player-wrapper"><iframe ...>):
 *   Trang chính không đọc được giờ phát của video trong iframe khác origin,
 *   nên tool tự nhận diện và hiện hướng dẫn trong bảng:
 *   Cách 1 (nhanh nhất): bấm "Mở tab player" — mở tab mới chỉ có player,
 *   dán lại lệnh 1 dòng trong tab đó là chạy (video thành top-level).
 *   Cách 2: trong DevTools, bấm khung "top" phía trên console -> chọn iframe
 *   của player -> dán lại lệnh 1 dòng. File .srt lưu theo host của player.
 *
 * Chạy lại lệnh bất cứ lúc nào để reset sạch (bản cũ tự gỡ trước khi chạy mới).
 * Không gửi dữ liệu đi đâu. Cài đặt + file .srt lưu trong localStorage.
 * ========================================================================== */
(() => {
  'use strict';

  /* ---------- Dọn bản cũ nếu chạy lại lệnh ---------- */
  if (window.__srtInjector && typeof window.__srtInjector.destroy === 'function') {
    window.__srtInjector.destroy();
  }

  const STORE_KEY = 'srtInjectorSettings';
  const FILE_KEY = 'srtInjectorFile';       // { name, text, savedAt }
  const FILE_MAX = 4000000;                // ~4MB, chừa chỗ cho localStorage (~5MB)
  const DEFAULTS = {
    fontSize: 24,        // px
    bottomPct: 8,        // vị trí phụ đề tính từ đáy video (% chiều cao video)
    offsetSec: 0,        // lệch thời gian: + là phụ đề chạy sớm hơn, - là chạy trễ hơn
    color: '#ffffff',
    bgAlpha: 0.55,       // độ đậm nền đen sau chữ (0 = không nền)
    align: 'center',     // left | center | right
    bold: true,
    show: true,
    turbo: true,         // chế độ siêu tối ưu
  };

  // Lệnh 1 dòng để chạy lại tool (dùng cho nút "Sao chép lệnh")
  const LOADER = "fetch('https://raw.githubusercontent.com/ontopcommunity/srt-subtitle-injector/main/subtitle-injector.js').then(r=>r.text()).then(t=>eval(t))";
  const IN_IFRAME = window.self !== window.top;   // đang chạy trong iframe hay trang chính

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

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  /* ---------- Tìm video đang phát (quét 1 lần, không quét liên tục) ---------- */
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

  // Tìm iframe giống player (video nhúng kiểu <div id="player-wrapper"><iframe ...>).
  // Trang chính không đọc được nội dung iframe khác origin, nên chỉ nhận diện
  // để hướng dẫn user chạy tool TRONG iframe (hoặc mở player ra tab mới).
  function findPlayerIframes() {
    const out = [];
    document.querySelectorAll('iframe').forEach(f => {
      const r = f.getBoundingClientRect();
      if (r.width < 120 || r.height < 90) return;   // bỏ iframe nhỏ (quảng cáo, tracking)
      const wrap = f.closest('[id*="player"], [class*="player"], [id*="video"], [class*="video"]');
      const src = f.getAttribute('src') || '';
      let host = '', url = src;
      try {
        const u = new URL(src, location.href);
        host = u.hostname;
        url = u.href;
      } catch (e) { /* kệ */ }
      let score = 0;
      if (wrap) score += 2;                                            // nằm trong khối player
      if (/play|embed|video|player|stream/i.test(src)) score += 1;     // link kiểu player
      if (r.width >= 480 && r.height >= 270) score += 1;              // đủ lớn để xem
      out.push({ el: f, src, url, host, score, w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- State ---------- */
  let video = null;
  let cues = [];
  let savedName = '';
  let lastIdx = -1;          // cue đang hiển thị
  let running = false;       // đã bấm Bắt đầu hay chưa
  let destroyed = false;
  let scanTimer = 0;         // timer quét thử lại (tối đa vài lần rồi dừng hẳn)
  let scanLeft = 0;
  let parentOrigPos = '';
  let parentEl = null;
  let turboStyleEl = null;

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

  /* ---------- Đồng bộ phụ đề — CHỈ chạy khi video phát sự kiện ---------- */
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

  // Chỉ ghi DOM khi câu phụ đề thật sự đổi — tua đến đâu bay đến đó ngay.
  function updateSub() {
    if (destroyed || !running || !video) return;
    if (!cues.length || !settings.show) {
      if (subEl.style.display !== 'none') subEl.style.display = 'none';
      updateStatus();
      return;
    }
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
    updateStatus();
  }

  // Các sự kiện của video — đây là toàn bộ "vòng lặp": không rAF, không interval.
  function onTimeUpdate() { updateSub(); }
  function onSeeking() { updateSub(); }    // bấm sang mốc khác -> đổi phụ đề ngay
  function onSeeked() { updateSub(); }
  function onPlaying() { updateSub(); }
  function attachVideoListeners(v) {
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('seeking', onSeeking);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('playing', onPlaying);
  }
  function detachVideoListeners(v) {
    v.removeEventListener('timeupdate', onTimeUpdate);
    v.removeEventListener('seeking', onSeeking);
    v.removeEventListener('seeked', onSeeked);
    v.removeEventListener('playing', onPlaying);
  }

  /* ---------- Siêu tối ưu: cắt mọi thứ trừ video đang phát ---------- */
  const TURBO_CSS = [
    '.srt-turbo, .srt-turbo * {',
    '  animation-duration: .01s !important;',
    '  animation-delay: 0s !important;',
    '  animation-iteration-count: 1 !important;',
    '  transition-duration: .01s !important;',
    '  transition-delay: 0s !important;',
    '  scroll-behavior: auto !important;',
    '}',
  ].join('\n');

  function applyTurbo(on) {
    const root = document.documentElement;
    if (on) {
      if (!turboStyleEl) {
        turboStyleEl = document.createElement('style');
        turboStyleEl.id = 'srt-turbo-style';
        turboStyleEl.textContent = TURBO_CSS;
        document.head.appendChild(turboStyleEl);
      }
      root.classList.add('srt-turbo');
      // Tạm dừng mọi video khác trên trang, chỉ giữ video đang xem.
      findVideos().forEach(v => {
        if (v !== video && !v.paused) { try { v.pause(); } catch (e) { /* kệ */ } }
      });
    } else {
      root.classList.remove('srt-turbo');
      if (turboStyleEl && turboStyleEl.parentElement) {
        turboStyleEl.parentElement.removeChild(turboStyleEl);
        turboStyleEl = null;
      }
    }
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
  const mkBtn = (text, bg) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `background:${bg || '#0ea5a4'};color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;`;
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
  header.innerHTML = '<span>🎬 Phụ đề SRT' + (IN_IFRAME ? ' — trong iframe' : '') + '</span>';
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

  // Hàng: Bắt đầu / Dừng
  const startBtn = mkBtn('▶ Bắt đầu', '#16a34a');
  startBtn.style.cssText += 'flex:1;padding:8px;font-size:14px;font-weight:bold;';
  const stopBtn = mkBtn('⏸ Dừng', '#555');
  stopBtn.style.cssText += 'flex:1;padding:8px;font-size:14px;';
  stopBtn.disabled = true;
  const startRow = document.createElement('div');
  startRow.style.cssText = 'display:flex;gap:8px;margin:10px 0 4px;';
  startRow.append(startBtn, stopBtn);
  body.appendChild(startRow);

  // Hộp hướng dẫn khi video nằm trong iframe (trang chính không đọc được giờ phát)
  const noticeBox = document.createElement('div');
  noticeBox.style.cssText = 'display:none;background:#3a2f00;border:1px solid #a88400;border-radius:8px;padding:10px;margin:8px 0;color:#ffe9a8;font-size:12px;line-height:1.6;';
  const noticeText = document.createElement('div');
  noticeBox.appendChild(noticeText);
  const noticeBtns = document.createElement('div');
  noticeBtns.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
  const openPlayerBtn = mkBtn('Mở tab player', '#16a34a');
  const copyCmdBtn = mkBtn('Sao chép lệnh', '#555');
  noticeBtns.append(openPlayerBtn, copyCmdBtn);
  noticeBox.appendChild(noticeBtns);
  body.appendChild(noticeBox);
  let noticePlayer = null;
  function showPlayerNotice(players) {
    noticePlayer = players[0];
    noticeText.innerHTML = '⚠ Video nằm trong <b>iframe</b> (' + escapeHtml(noticePlayer.host || 'player') + ', ' + noticePlayer.w + '×' + noticePlayer.h + ') — trang chính không đọc được giờ phát nên không chèn trực tiếp được.<br><b>Cách 1:</b> bấm "Mở tab player" rồi dán lại lệnh 1 dòng trong tab mới.<br><b>Cách 2:</b> trong DevTools, bấm khung "top" trên console → chọn iframe ' + escapeHtml(noticePlayer.host || '') + ' → dán lại lệnh.<br>File .srt lưu theo host của player — chọn 1 lần cho mỗi host là xong.';
    noticeBox.style.display = '';
  }
  function hidePlayerNotice() { noticeBox.style.display = 'none'; }
  openPlayerBtn.onclick = () => {
    if (noticePlayer && noticePlayer.url) window.open(noticePlayer.url, '_blank');
  };
  copyCmdBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(LOADER);
      copyCmdBtn.textContent = 'Đã chép!';
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = LOADER;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); copyCmdBtn.textContent = 'Đã chép!'; }
      catch (e2) { copyCmdBtn.textContent = 'Chép tay vậy'; }
      ta.remove();
    }
    setTimeout(() => (copyCmdBtn.textContent = 'Sao chép lệnh'), 1500);
  };

  // Hàng: chọn video (nếu trang có nhiều video)
  const videoSel = document.createElement('select');
  videoSel.style.cssText = 'flex:1;min-width:0;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:5px 7px;';
  videoSel.innerHTML = '<option value="">Bấm Bắt đầu để quét video</option>';
  function refreshVideoList() {
    const list = findVideos();
    const cur = videoSel.value;
    videoSel.innerHTML = '';
    if (!list.length) {
      videoSel.innerHTML = '<option value="">Không thấy video nào</option>';
      return list;
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
    return list;
  }
  function setVideo(v) {
    if (video && video !== v) detachVideoListeners(video);
    video = v;
    lastIdx = -1;
    attachOverlay();
    if (running) attachVideoListeners(v);
    updateStatus();
  }
  videoSel.onchange = () => {
    const list = findVideos();
    if (list[+videoSel.value]) setVideo(list[+videoSel.value]);
  };
  const rescanBtn = mkBtn('Quét lại');
  rescanBtn.onclick = () => {
    const list = refreshVideoList();
    if (list.length) {
      setVideo(list[+videoSel.value || 0]);
      hidePlayerNotice();
    } else {
      const players = findPlayerIframes();
      if (players.length) showPlayerNotice(players);
    }
    updateStatus();
  };
  const videoRow = row('Video', videoSel);
  const rescanWrap = document.createElement('span');
  rescanWrap.appendChild(rescanBtn);
  videoRow.appendChild(rescanWrap);
  body.appendChild(videoRow);

  // Hàng: chọn file .srt (lưu sẵn trong máy)
  const fileInput = mkInput('file', { accept: '.srt,.vtt' });
  fileInput.style.padding = '3px';
  fileInput.onchange = () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFile(f);
  };
  body.appendChild(row('File .srt', fileInput));

  // Dòng: file đã lưu sẵn trong máy
  const savedLine = document.createElement('div');
  savedLine.style.cssText = 'color:#7dd3d2;font-size:12px;margin:-2px 0 4px 94px;min-height:16px;';
  body.appendChild(savedLine);
  function showSaved() {
    savedLine.textContent = cues.length
      ? `Đã lưu sẵn: ${savedName} — ${cues.length} câu`
      : 'Chưa có file phụ đề nào được lưu.';
  }

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
    updateSub();   // đổi lệch giờ -> tính lại câu hiện tại ngay
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
  showChk.onchange = () => { settings.show = showChk.checked; saveSettings(); updateSub(); };
  const turboChk = document.createElement('input');
  turboChk.type = 'checkbox'; turboChk.checked = settings.turbo;
  turboChk.onchange = () => {
    settings.turbo = turboChk.checked; saveSettings();
    if (running) applyTurbo(settings.turbo);
  };
  const chkRow = document.createElement('div');
  chkRow.style.cssText = 'display:flex;gap:14px;margin:8px 0;flex-wrap:wrap;';
  const mkChkLab = (chk, text) => {
    const lab = document.createElement('label');
    lab.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer;';
    lab.append(chk, document.createTextNode(text));
    return lab;
  };
  chkRow.append(mkChkLab(boldChk, 'Chữ đậm'), mkChkLab(showChk, 'Hiện phụ đề'));
  body.appendChild(chkRow);
  const turboRow = document.createElement('div');
  turboRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0 8px;';
  const turboLab = mkChkLab(turboChk, 'Siêu tối ưu (tắt hiệu ứng trang, dừng video khác)');
  turboRow.appendChild(turboLab);
  body.appendChild(turboRow);

  // Dòng trạng thái (cập nhật tối đa 1 lần/giây)
  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'margin-top:6px;padding-top:8px;border-top:1px solid #2a2a2a;color:#999;font-size:12px;line-height:1.5;min-height:18px;';
  body.appendChild(statusEl);
  let statusText = '';
  let lastStatusWrite = 0;
  let lastStatusStr = '';
  function setStatus(s) { statusText = s; lastStatusStr = ''; updateStatus(true); }
  function updateStatus(force) {
    if (!statusEl.isConnected) return;
    const now = Date.now();
    if (!force && now - lastStatusWrite < 1000) return;   // throttle 1s
    const vt = video ? video.currentTime.toFixed(1) + 's' : '—';
    const str = statusText
      ? statusText + (video ? ` | Video: ${vt}` : '')
      : (running
        ? `Đang chạy | Video: ${vt} | ${cues.length} câu phụ đề`
        : (video ? `Video: ${vt} | ${cues.length ? cues.length + ' câu phụ đề' : 'Chưa có phụ đề'}` : 'Chưa chạy — bấm "Bắt đầu".'));
    if (str === lastStatusStr) return;
    lastStatusStr = str;
    lastStatusWrite = now;
    statusEl.textContent = str;
  }

  /* ---------- Nạp file phụ đề + LƯU SẴN trong máy ---------- */
  function loadText(text, name, saveIt) {
    cues = parseSRT(text);
    lastIdx = -1;
    if (!cues.length) {
      setStatus('File không đọc được câu nào — kiểm tra lại định dạng .srt.');
      return false;
    }
    savedName = name;
    if (saveIt !== false) {
      if (text.length > FILE_MAX) {
        setStatus(`Đã tải "${name}" — ${cues.length} câu (file quá lớn nên không lưu sẵn được, vẫn chạy lần này).`);
      } else {
        try {
          localStorage.setItem(FILE_KEY, JSON.stringify({ name, text, savedAt: Date.now() }));
        } catch (e) { /* đầy bộ nhớ -> vẫn chạy, chỉ không lưu được */ }
        setStatus(`Đã tải + lưu sẵn "${name}" — ${cues.length} câu.`);
      }
    } else {
      setStatus(`Đã tải "${name}" — ${cues.length} câu.`);
    }
    showSaved();
    updateStatus(true);
    if (running) updateSub();   // đang chạy mà đổi file -> áp dụng ngay
    return true;
  }
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result || ''), file.name);
    reader.onerror = () => setStatus('Không đọc được file.');
    reader.readAsText(file);
  }
  function loadSavedFile() {
    try {
      const raw = JSON.parse(localStorage.getItem(FILE_KEY) || 'null');
      if (raw && raw.text) {
        if (loadText(raw.text, raw.name || 'phude.srt', false)) {
          setStatus(`Đã nạp file lưu sẵn "${savedName}" — ${cues.length} câu. Bấm Bắt đầu để chạy.`);
        }
      }
    } catch (e) { /* kệ */ }
    showSaved();
  }

  /* ---------- Bắt đầu / Dừng ---------- */
  // Quét video 1 lần; nếu chưa thấy (video chưa load) thì thử lại vài lần rồi DỪNG HẲN.
  function scanAndStart() {
    clearTimeout(scanTimer);
    const list = refreshVideoList();
    const v = pickVideo(list);
    if (v) {
      setVideo(v);
      startRunning();
      return;
    }
    if (scanLeft > 0) {
      scanLeft--;
      setStatus(`Chưa thấy video đang chạy, thử quét lại... (${scanLeft})`);
      scanTimer = setTimeout(scanAndStart, 500);
      return;
    }
    const players = findPlayerIframes();
    if (players.length) {
      showPlayerNotice(players);
      setStatus('Video nằm trong iframe — xem hướng dẫn trong bảng.');
    } else {
      setStatus('Không thấy video nào — mở video rồi bấm Bắt đầu lại.');
    }
    startBtn.disabled = false;
  }

  function startRunning() {
    running = true;
    hidePlayerNotice();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    if (video) attachVideoListeners(video);
    if (settings.turbo) applyTurbo(true);
    updateSub();   // hiện đúng câu tại thời điểm hiện tại ngay
    setStatus('Đang chạy — phụ đề theo video.');
  }

  startBtn.onclick = () => {
    if (running) return;
    if (!cues.length) {
      setStatus('Chưa có phụ đề — chọn file .srt trước đã.');
      return;
    }
    startBtn.disabled = true;
    scanLeft = 8;   // quét tối đa ~4 giây rồi dừng hẳn
    scanAndStart();
  };

  function stopRunning() {
    clearTimeout(scanTimer);
    running = false;
    if (video) detachVideoListeners(video);
    applyTurbo(false);
    if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    subEl.style.display = 'none';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setStatus('Đã dừng.');
  }
  stopBtn.onclick = stopRunning;

  /* ---------- Gỡ bỏ sạch ---------- */
  function destroy() {
    destroyed = true;
    clearTimeout(scanTimer);
    stopRunning();
    document.removeEventListener('fullscreenchange', onFs);
    if (panel.parentElement) panel.parentElement.removeChild(panel);
    if (parentEl && parentEl.style.position === 'relative') {
      parentEl.style.position = parentOrigPos;
    }
    if (window.__srtInjector && window.__srtInjector.destroy === destroy) {
      delete window.__srtInjector;
    }
  }
  closeBtn.onclick = destroy;

  function onFs() { if (running) attachOverlay(); }   // chỉ gắn lại khi đang chạy
  document.addEventListener('fullscreenchange', onFs);

  window.__srtInjector = {
    destroy,
    start: () => startBtn.onclick(),
    stop: stopRunning,
    setVideo,
    refreshVideoList,
    loadText,
    get cues() { return cues; },
    get video() { return video; },
    get running() { return running; },
  };

  /* ---------- Khởi động: chỉ hiện bảng, chưa quét, chưa chạy gì ---------- */
  document.body.appendChild(panel);
  loadSavedFile();   // nạp file .srt đã lưu sẵn (nếu có) — chưa chạy phụ đề
  // Nếu trang không có video trực tiếp mà có iframe player thì hiện hướng dẫn ngay.
  if (!findVideos().length) {
    const players = findPlayerIframes();
    if (players.length) showPlayerNotice(players);
  }
  updateStatus(true);
  console.log('%c[SRT Injector] đã sẵn sàng. Chọn file .srt (chỉ cần 1 lần, sẽ lưu sẵn) rồi bấm Bắt đầu.',
    'color:#0ea5a4;font-weight:bold;');
})();
