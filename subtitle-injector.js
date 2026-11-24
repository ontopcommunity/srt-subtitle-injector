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
 *   Trang chính không đọc được giờ phát của video trong iframe khác origin.
 *   Nút "Quét lại" quét HẾT iframe còn hiện trên trang (chỉ bỏ khung 0×0)
 *   rồi xếp hạng theo độ giống player — đảm bảo quét ra được; dropdown
 *   "Video/Khung" liệt kê cả video trực tiếp lẫn các khung (Khung 1, 2...),
 *   nhiều cái thì chọn trong đó, khung giống player nhất lên đầu. Chọn 1
 *   khung thì nút "Mở tab player" (kề bên nút "Quét lại") mở đúng khung đó:
 *   Cách 1 (nhanh nhất): bấm "Mở tab player" — mở tab mới chỉ có player,
 *   dán lại lệnh 1 dòng trong tab đó là chạy (video thành top-level).
 *   Cách 2: trong DevTools, bấm khung "top" phía trên console -> chọn iframe
 *   của player -> dán lại lệnh 1 dòng. File .srt lưu theo host của player.
 *
 * XEM DỌC (tự động khi chạy lệnh / khi bấm Bắt đầu, tắt được trong bảng):
 *   Video được phóng to lấp màn hình DỌC, vẫn ở nguyên trang web (không
 *   chuyển tab, không fullscreen ngang của trình duyệt) — KHÔNG xoay video:
 *   - Video ngang (16:9...) giữ nguyên chiều ngang, phóng to lấp hết chiều
 *     rộng màn dọc, căn giữa theo chiều cao (thanh "Độ phóng" kéo to thêm,
 *     tối đa 2x, sẽ cắt 2 bên).
 *   - Video dọc sẵn thì phóng to lấp chiều cao.
 *   - Phụ đề vẫn bám đúng khung hình đang hiển thị, chữ thẳng để đọc.
 *   - Thoát bằng nút "✕ Thoát xem dọc" góc trái trên, phím Esc, hoặc nút
 *     "Xem dọc" trong bảng. Đổi video / xoay màn hình tự tính lại cỡ.
 *
 * TÌM PHỤ ĐỀ TRÊN SUBTITLECAT (khung "🔍 Tìm phụ đề" trong bảng):
 *   Gõ tên phim → bấm Tìm → bấm 1 kết quả để xem danh sách ngôn ngữ
 *   (tiếng Việt lên đầu) → bấm 1 ngôn ngữ là tải file .srt về và chạy
 *   phụ đề luôn, không cần tải file về máy trước.
 *   Vì subtitlecat.com chặn đọc từ web khác (CORS), script tải qua các
 *   đường trung gian (r.jina.ai cho trang HTML, api.cors.lol / allorigins /
 *   codetabs cho file .srt) — CHẠY SONG SONG, đường nào trả về nội dung
 *   đúng trước thì lấy ngay (thường 2–3 giây), nội dung sai (trang báo lỗi)
 *   bị loại; nếu tất cả đều bận thì báo rõ lý do từng đường, đợi 1 phút
 *   rồi bấm lại.
 *
 * CHẶN QUẢNG CÁO NHẢY TRANG (mặc định BẬT, tắt được bằng tick trong bảng):
 *   Chặn cửa sổ bật ra (window.open), chặn bấm vào link quảng cáo sang
 *   web khác, và hỏi trước khi trang tự nhảy đi (beforeunload). Nút
 *   "Mở tab player" vẫn mở được bình thường. Muốn duyệt web bình thường
 *   thì bỏ tick.
 *
 * CHỌN VIDEO BẰNG CÁCH BẤM VÀO NÓ (nút "🎯 Chọn video" trong bảng):
 *   Bấm nút → panel ẨN NGAY, toàn màn hình là web để nhận diện element
 *   (panel che mất video là hay bị lỗi không chọn được). Di chuột lên video
 *   đang phát (nó viền xanh) → bấm vào video, hoặc chạm thẳng vào khung
 *   video trên điện thoại. Script tự nhận diện element tại điểm bấm: đúng
 *   mảng chứa video (kể cả bấm vào lớp phủ trên mặt video) là lấy video đó
 *   và bám theo thời gian của nó luôn. Bấm vào khung player (iframe) thì
 *   lưu khung đó. Hủy bằng nút nổi "Đang chọn video — bấm đây để hủy" ở
 *   cuối màn hình, hoặc phím Esc. Lần sau chạy lệnh, video/khung đã lưu
 *   được dùng luôn, khỏi quét lại.
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
    autoPortrait: true,  // tự phóng to dọc khi chạy / khi bấm Bắt đầu
    zoom: 1,             // độ phóng thêm ở chế độ xem dọc: 1 = vừa khít, tối đa 2
    adBlock: true,       // chặn quảng cáo nhảy trang (window.open, link ngoài, hỏi trước khi rời trang)
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
  // Quét HẾT iframe còn hiện trên trang (chỉ bỏ khung 0×0) rồi xếp hạng theo
  // độ giống player — đảm bảo quét ra được, kể cả iframe nhỏ/lạ; nếu nhiều
  // cái thì user chọn trong dropdown. minScore: chỉ lấy iframe có điểm
  // giống player (dùng cho các chỗ tự hiện nút, tránh nhận nhầm quảng cáo).
  function findPlayerIframes(minScore) {
    const out = [];
    document.querySelectorAll('iframe').forEach(f => {
      const r = f.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;   // bỏ khung không hiện
      const wrap = f.closest('[id*="player"], [class*="player"], [id*="video"], [class*="video"]');
      const src = f.getAttribute('src') || '';
      let host = '', url = '';
      if (src) {
        try {
          const u = new URL(src, location.href);
          host = u.hostname;
          url = u.href;
        } catch (e) { /* kệ */ }
      }
      let score = 0;
      if (wrap) score += 2;                                            // nằm trong khối player
      if (/play|embed|video|player|stream/i.test(src)) score += 1;     // link kiểu player
      if (r.width >= 480 && r.height >= 270) score += 1;              // đủ lớn để xem
      out.push({ el: f, src, url, host, score, w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out
      .filter(p => p.score >= (minScore || 0))
      .sort((a, b) => (b.score - a.score) || ((b.w * b.h) - (a.w * a.h)));
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
  let portrait = false;      // đang ở chế độ xem dọc hay không
  let portraitEl = null;     // phần tử đang phóng to dọc (video hoặc iframe player)
  let savedPortraitStyle = '';
  let backdropEl = null;
  let exitBtnEl = null;
  let portraitTimer = 0;
  let portraitLeft = 0;
  let adBlockOn = false;     // chặn quảng cáo nhảy trang đang bật hay không
  let origOpen = null;       // window.open gốc (để nút "Mở tab player" vẫn mở được)
  let pickMode = false;      // đang ở chế độ bấm chọn video hay không
  let pickHL = null;         // phần tử đang viền xanh khi di chuột chọn video
  let pickedIframe = null;   // iframe player đã lưu bằng cách bấm chọn
  let pickCancelBtn = null;  // nút Hủy nổi khi đang chọn video (panel đã ẩn)

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
    if (!video || destroyed || portrait) return;   // xem dọc: phụ đề dùng khung fixed riêng
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

  /* ---------- Xem dọc: phóng to video lấp màn dọc, vẫn ở nguyên trang ---------- */
  // Tính khung hiển thị cho màn dọc (thuần toán, không chạm DOM — để test được).
  // vw/vh: kích thước viewport; A: tỉ lệ ngang/dọc của video (w/h); zoom: 1..2.
  // KHÔNG xoay video: video ngang (A>=1) lấp chiều rộng màn dọc (zoom>1 thì
  // to thêm, cắt 2 bên); video dọc sẵn (A<1) lấp chiều cao.
  // Trả về { elW, elH } = cỡ phần tử = khung hình nhìn thấy (boxW, boxH).
  function portraitBox(vw, vh, A, zoom) {
    let elW, elH;
    if (A >= 1) {
      elW = vw * zoom;
      elH = elW / A;
      if (elH > vh) { elH = vh; elW = elH * A; }   // phóng quá thì chặn theo chiều cao
    } else {
      elH = vh;
      elW = elH * A;
      if (elW > vw) { elW = vw; elH = elW / A; }
    }
    return { elW, elH, rotate: 0, boxW: elW, boxH: elH };
  }

  // Mục tiêu để phóng to dọc: video đang chạy, nếu không có thì khung player
  // đã lưu bằng cách bấm chọn, rồi mới tới iframe player tự tìm được.
  function portraitTarget() {
    if (video) return video;
    if (pickedIframe && document.contains(pickedIframe)) return pickedIframe;
    const players = findPlayerIframes();
    return players.length ? players[0].el : null;
  }

  function resetOverlayStyle() {
    Object.assign(overlay.style, {
      position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
      width: '100%', height: '100%', transform: '',
    });
  }

  function restorePortraitEl() {
    if (!portraitEl) return;
    if (savedPortraitStyle) portraitEl.setAttribute('style', savedPortraitStyle);
    else portraitEl.removeAttribute('style');
    portraitEl = null;
  }

  // Áp lại cỡ/vị trí theo viewport hiện tại (gọi khi vào chế độ + khi xoay màn hình).
  function layoutPortrait() {
    if (!portrait || !portraitEl) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    let A = 16 / 9;
    if (portraitEl.tagName === 'VIDEO' && portraitEl.videoWidth > 0) {
      A = portraitEl.videoWidth / portraitEl.videoHeight;
    } else {
      const r = portraitEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) A = r.width / r.height;
    }
    const b = portraitBox(vw, vh, A, settings.zoom);
    const st = {
      position: 'fixed', left: '50%', top: '50%', zIndex: '2147483646',
      width: b.elW + 'px', height: b.elH + 'px',
      transform: 'translate(-50%, -50%)',
      margin: '0', maxWidth: 'none', maxHeight: 'none',
      background: '#000',
    };
    if (portraitEl.tagName === 'VIDEO') st.objectFit = 'contain';
    Object.assign(portraitEl.style, st);
    // Khung phụ đề: fixed, căn giữa, khớp đúng khung hình đang hiển thị, chữ thẳng.
    Object.assign(overlay.style, {
      position: 'fixed', left: '50%', top: '50%', right: 'auto', bottom: 'auto',
      width: b.boxW + 'px', height: b.boxH + 'px',
      transform: 'translate(-50%, -50%)',
    });
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
  }

  function ensurePortraitChrome() {
    if (!backdropEl) {
      backdropEl = document.createElement('div');
      Object.assign(backdropEl.style, {
        position: 'fixed', inset: '0', background: '#000',
        zIndex: '2147483645', pointerEvents: 'none',
      });
    }
    if (!exitBtnEl) {
      exitBtnEl = document.createElement('button');
      exitBtnEl.textContent = '✕ Thoát xem dọc (Esc)';
      Object.assign(exitBtnEl.style, {
        position: 'fixed', top: '12px', left: '12px', zIndex: '2147483647',
        background: 'rgba(20,20,25,.85)', color: '#fff', border: '1px solid #555',
        borderRadius: '8px', padding: '8px 12px', fontSize: '13px', cursor: 'pointer',
      });
      exitBtnEl.onclick = exitPortrait;
    }
    if (!backdropEl.parentElement) document.body.appendChild(backdropEl);
    if (!exitBtnEl.parentElement) document.body.appendChild(exitBtnEl);
  }

  function enterPortrait() {
    const target = portraitTarget();
    if (!target || destroyed) return false;
    if (portraitEl && portraitEl !== target) restorePortraitEl();
    if (!portraitEl || portraitEl !== target) {
      savedPortraitStyle = target.getAttribute('style') || '';
      portraitEl = target;
    }
    portrait = true;
    ensurePortraitChrome();
    layoutPortrait();
    window.addEventListener('resize', onPortraitResize);
    window.addEventListener('orientationchange', onPortraitResize);
    updatePortraitBtn();
    return true;
  }

  function onPortraitResize() { if (portrait) layoutPortrait(); }

  function exitPortrait() {
    if (!portrait && !portraitEl) return;
    portrait = false;
    restorePortraitEl();
    window.removeEventListener('resize', onPortraitResize);
    window.removeEventListener('orientationchange', onPortraitResize);
    if (backdropEl && backdropEl.parentElement) backdropEl.parentElement.removeChild(backdropEl);
    if (exitBtnEl && exitBtnEl.parentElement) exitBtnEl.parentElement.removeChild(exitBtnEl);
    resetOverlayStyle();
    if (running && video) attachOverlay();
    else if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    updatePortraitBtn();
  }

  function togglePortrait() { if (portrait) exitPortrait(); else enterPortrait(); }

  // Thử phóng to dọc vài lần (video/player có thể chưa load xong lúc chạy lệnh).
  function tryAutoPortrait() {
    clearTimeout(portraitTimer);
    if (portrait || destroyed) return;
    if (enterPortrait()) return;
    if (portraitLeft > 0) {
      portraitLeft--;
      portraitTimer = setTimeout(tryAutoPortrait, 500);
    }
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (portrait) exitPortrait();
    if (pickMode) exitPickMode();
  }

  /* ---------- Chặn quảng cáo nhảy trang ---------- */
  function onAdClick(e) {
    if (!adBlockOn) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const a = t.closest('a[href]');
    if (!a) return;
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    } catch (_) { /* link lỗi -> để yên */ }
  }
  function onBeforeUnload(e) {
    if (!adBlockOn) return;
    e.preventDefault();
    e.returnValue = '';
  }
  function applyAdBlock(on) {
    adBlockOn = !!on;
    if (adBlockOn) {
      if (!origOpen) origOpen = window.open;
      window.open = function () { return null; };   // chặn popunder / tab quảng cáo
      document.addEventListener('click', onAdClick, true);
      window.addEventListener('beforeunload', onBeforeUnload);
    } else {
      if (origOpen) { window.open = origOpen; origOpen = null; }
      document.removeEventListener('click', onAdClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
    if (adBlockChk) adBlockChk.checked = adBlockOn;   // chỉ gọi sau khi bảng đã dựng xong
  }

  /* ---------- Bấm chọn video đang phát + lưu lại ---------- */
  const PICK_KEY = 'srtInjectorPicked';
  function savePicked(p) {
    try { localStorage.setItem(PICK_KEY, JSON.stringify({ ...p, savedAt: Date.now() })); } catch (_) {}
  }
  function loadPicked() {
    try { const s = localStorage.getItem(PICK_KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  }
  function cssPath(el) {
    if (!el || el === document.body) return 'body';
    const parts = [];
    let n = el;
    while (n && n !== document.body && parts.length < 6) {
      if (n.id) { parts.unshift('#' + n.id); break; }
      let s = n.tagName.toLowerCase();
      const parent = n.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter(c => c.tagName === n.tagName);
        if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(n) + 1) + ')';
      }
      parts.unshift(s);
      n = parent;
    }
    return parts.join(' > ');
  }
  // Tìm video/iframe mà điểm bấm (x, y) đang nằm trên: chính nó, hoặc video
  // con cháu trong mảng đó, hoặc video trong mảng tổ tiên chứa nó — miễn là
  // khung hình của video ôm điểm bấm (bấm vào mảng chứa video là được, kể cả
  // bấm vào lớp phủ nút bấm/quảng cáo trên mặt video). Chỉ nhận video mà
  // khung hình thực sự chứa điểm bấm, tránh nhận nhầm video khác trên trang.
  function videoAtPoint(root, x, y) {
    if (!root || !root.querySelectorAll) return null;
    const list = root.querySelectorAll('video, iframe');
    for (const v of list) {
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return v;
    }
    return null;
  }
  function resolvePickTarget(el, x, y) {
    if (!el) return null;
    if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME') return el;
    const inner = videoAtPoint(el, x, y);
    if (inner) return inner;
    let p = el.parentElement, n = 0;
    while (p && n++ < 6) {
      const v = videoAtPoint(p, x, y);
      if (v) return v;
      p = p.parentElement;
    }
    return null;
  }
  function clearPickHL() {
    if (pickHL) { try { pickHL.el.style.outline = pickHL.orig; } catch (_) {} pickHL = null; }
  }
  function onPickMove(e) {
    if (!pickMode) return;
    const el = resolvePickTarget(e.target, e.clientX, e.clientY);
    if (el === (pickHL && pickHL.el)) return;
    clearPickHL();
    if (el) {
      pickHL = { el, orig: el.style.outline || '' };
      el.style.outline = '3px solid #14B8A6';
      el.style.outlineOffset = '2px';
    }
  }
  // Bấm vào 1 điểm (chuột hoặc chạm): nhận diện element tại đó, đúng mảng
  // chứa video thì lấy video đó và bám theo thời gian của nó luôn.
  function pickAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const hit = resolvePickTarget(el, x, y);
    if (!hit) { setStatus('Không thấy video ở chỗ bấm — bấm đúng vào khung video đang phát.'); return false; }
    pickElement(hit);
    return true;
  }
  // Lưu khung player đã chọn (bấm chọn, hoặc chọn trong dropdown quét được).
  function setPickedIframe(el) {
    const src = el.getAttribute('src') || '';
    let host = '';
    try { host = new URL(src, location.href).host; } catch (_) {}
    savePicked({ type: 'iframe', src, host });
    pickedIframe = el;
    setStatus('Đã lưu khung player (' + (host || 'iframe') + ') — phụ đề cần chạy lệnh trong khung player (xem hướng dẫn trong bảng).');
    if (settings.autoPortrait) enterPortrait();
  }
  function pickElement(el) {
    if (el.tagName === 'VIDEO') {
      savePicked({ type: 'video', selector: cssPath(el), src: el.currentSrc || el.src || '' });
      pickedIframe = null;
      setVideo(el);
      exitPickMode();
      if (cues.length && !running) startRunning();   // bám theo thời gian video luôn
      else setStatus('Đã lưu video đã chọn — ' + (running ? 'đang chạy.' : 'chọn file .srt hoặc tìm phụ đề bên dưới.'));
    } else {
      setPickedIframe(el);
      exitPickMode();
    }
  }
  function onPickClick(e) {
    if (!pickMode) return;
    if (pickCancelBtn && pickCancelBtn.contains(e.target)) return;   // để nút Hủy nhận bấm
    if (panel.contains(e.target)) { exitPickMode(); return; }   // bấm vào bảng = hủy chọn
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    pickAtPoint(e.clientX, e.clientY);
  }
  // Chạm trên điện thoại: chuột không có hover nên click thường bị trình
  // phát video nuốt mất — bắt touchstart (capture) để nhận diện điểm chạm
  // trước khi video/quảng cáo kịp phản ứng. Chỉ chặn chạm khi đúng mảng
  // video; chạm chỗ khác thì để yên cho trang lướt/bấm bình thường.
  function onPickTouch(e) {
    if (!pickMode) return;
    if (pickCancelBtn && pickCancelBtn.contains(e.target)) return;   // để nút Hủy nhận chạm
    const t = e.touches && e.touches[0];
    if (!t) return;
    if (panel.contains(e.target)) { exitPickMode(); return; }   // chạm vào bảng = hủy chọn
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const hit = resolvePickTarget(el, t.clientX, t.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    pickElement(hit);
  }
  // Nút Hủy nổi khi đang chọn video — panel đã ẩn nên cần 1 lối thoát riêng.
  function ensurePickCancelBtn() {
    if (!pickCancelBtn) {
      pickCancelBtn = document.createElement('button');
      pickCancelBtn.textContent = '🎯 Đang chọn video — bấm đây để hủy';
      Object.assign(pickCancelBtn.style, {
        position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
        zIndex: '2147483647', background: 'rgba(20,20,25,.92)', color: '#fff',
        border: '1px solid #14B8A6', borderRadius: '999px', padding: '10px 16px',
        fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      pickCancelBtn.onclick = () => exitPickMode();
    }
    if (!pickCancelBtn.parentElement) document.body.appendChild(pickCancelBtn);
  }
  function enterPickMode() {
    pickMode = true;
    pickBtn.textContent = '✕ Hủy chọn video';
    panel.style.display = 'none';   // ẩn panel ngay — toàn màn hình là web, bấm đâu cũng nhận diện được
    ensurePickCancelBtn();
    pickCancelBtn.style.display = '';
    window.addEventListener('mousemove', onPickMove, true);
    window.addEventListener('click', onPickClick, true);
    window.addEventListener('touchstart', onPickTouch, { capture: true, passive: false });
  }
  function exitPickMode() {
    if (!pickMode && !pickHL) return;
    pickMode = false;
    clearPickHL();
    window.removeEventListener('mousemove', onPickMove, true);
    window.removeEventListener('click', onPickClick, true);
    window.removeEventListener('touchstart', onPickTouch, true);
    if (pickCancelBtn) pickCancelBtn.style.display = 'none';
    panel.style.display = '';   // hiện lại bảng
    if (pickBtn) pickBtn.textContent = '🎯 Chọn video';   // chỉ gọi sau khi bảng đã dựng xong
  }
  function applyPicked() {
    const p = loadPicked();
    if (!p) return false;
    if (p.type === 'video') {
      let v = null;
      if (p.src) v = findVideos().find(x => (x.currentSrc || x.src || '') === p.src);
      if (!v && p.selector) {
        try { const el = document.querySelector(p.selector); if (el && el.tagName === 'VIDEO') v = el; } catch (_) {}
      }
      if (v) { setVideo(v); return true; }
    } else if (p.type === 'iframe') {
      const list = findPlayerIframes();
      const f = list.find(x => (x.el.getAttribute('src') || '') === p.src)
        || list.find(x => x.host === p.host);
      if (f) { pickedIframe = f.el; return true; }
    }
    return false;
  }

  /* ---------- Tìm phụ đề trên SubtitleCat (qua proxy, vì web chặn CORS) ---------- */
  // Kiểm tra nội dung trả về có đúng thứ cần không — proxy lỗi hay trả trang
  // báo lỗi với HTTP 200 thì phải loại, không được nhận bừa (trước đây chỉ
  // kiểm tra dài > 50 ký tự nên trang lỗi cũng được nhận rồi parse ra 0 câu).
  function isGoodCatText(text, kind, needle) {
    if (!text || text.length < 50) return false;
    if (kind === 'srt') return /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(text);   // phải có mốc giờ SRT
    return !needle || text.indexOf(needle) !== -1;
  }
  // Chạy SONG SONG tất cả các đường, đường nào trả về nội dung đúng trước thì
  // lấy ngay (thường 2–3 giây). Trước đây thử LẦN LƯỢT, mỗi đường treo tới
  // 12s nên bấm xong đợi cả nửa phút mới báo lỗi — mà lúc đó allorigins /
  // codetabs lại đang chết, cors.lol thì bị giới hạn lượt nên toàn lỗi.
  async function fetchTextVia(rawUrl, kind, needle) {
    const enc = encodeURIComponent(rawUrl);
    const tries = [{ url: rawUrl, name: 'trực tiếp' }];
    if (kind === 'html') {
      tries.push({ url: 'https://r.jina.ai/' + rawUrl, name: 'jina', headers: { 'X-Return-Format': 'html' } });
    }
    tries.push(
      { url: 'https://api.allorigins.win/raw?url=' + enc, name: 'allorigins' },
      { url: 'https://api.codetabs.com/v1/proxy?quest=' + enc, name: 'codetabs' },
      { url: 'https://api.cors.lol/?url=' + enc, name: 'cors.lol' }
    );
    const fails = [];
    const jobs = tries.map(t => (async () => {
      try {
        const r = await fetch(t.url, { headers: t.headers || {}, signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        if (!isGoodCatText(text, kind, needle)) throw new Error('trả về không đúng nội dung');
        return text;
      } catch (e) {
        fails.push(t.name + ': ' + (e && e.message ? e.message : 'lỗi mạng'));
        throw e;
      }
    })());
    try {
      return await Promise.any(jobs);
    } catch (_) {
      fetchTextVia.lastError = fails.join(' | ');   // để báo đúng lý do từng đường
      return null;
    }
  }
  // Trang tìm kiếm: bảng table.sub-table, mỗi hàng 1 link subs/*.html
  function parseCatSearch(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    doc.querySelectorAll('table.sub-table tbody tr').forEach(tr => {
      const a = tr.querySelector('a[href*="subs/"]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !/\.html$/i.test(href)) return;
      const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!title) return;
      let url;
      try { url = new URL(href, 'https://www.subtitlecat.com/').href; } catch (_) { return; }
      const meta = Array.from(tr.querySelectorAll('.sub-table__metric-value'))
        .map(e => (e.textContent || '').trim()).filter(Boolean).join(' · ');
      out.push({ title, url, meta });
    });
    return out.slice(0, 30);
  }
  // Trang chi tiết: mỗi .sub-single là 1 ngôn ngữ (cờ + tên + nút Download .srt)
  function parseCatDetail(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    doc.querySelectorAll('.sub-single').forEach(el => {
      const link = el.querySelector('a.green-link[href$=".srt"], a[href$=".srt"]');
      if (!link) return;   // chỉ lấy mục có file tải được, bỏ nút Translate
      const img = el.querySelector('img.flag');
      const code = (img ? img.getAttribute('alt') : '') || '';
      let name = '';
      el.querySelectorAll('span').forEach(s => {
        const t = (s.textContent || '').trim();
        if (t && !s.querySelector('img') && !s.querySelector('a')) name = t;
      });
      let url;
      try { url = new URL(link.getAttribute('href'), 'https://www.subtitlecat.com/').href; } catch (_) { return; }
      out.push({ code: code.trim().toLowerCase(), name: name || code, url });
    });
    const rank = x => (x.code === 'vi' || /viet/i.test(x.name) ? 0
      : (x.code === 'en' || /english/i.test(x.name) ? 1 : 2));
    out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return out;
  }
  async function catSearch() {
    const q = catInput.value.trim();
    if (!q) { catStatus.textContent = 'Gõ tên phim rồi bấm Tìm.'; return; }
    catBtn.disabled = true;
    catStatus.textContent = 'Đang tìm trên SubtitleCat…';
    catResults.innerHTML = '';
    catLangs.style.display = 'none';
    catResults.style.display = '';
    const html = await fetchTextVia('https://www.subtitlecat.com/index.php?search=' + encodeURIComponent(q), 'html', 'sub-table');
    catBtn.disabled = false;
    if (!html) {
      catStatus.textContent = 'Không tải được trang tìm kiếm (' + (fetchTextVia.lastError || 'proxy bận') + ') — đợi 1 phút rồi bấm Tìm lại.';
      return;
    }
    const res = parseCatSearch(html);
    if (!res.length) { catStatus.textContent = 'Không thấy kết quả nào cho "' + q + '". Thử gõ tên khác / mã phim.'; return; }
    catStatus.textContent = 'Thấy ' + res.length + ' kết quả — bấm 1 cái để xem ngôn ngữ.';
    res.forEach(r => {
      const b = document.createElement('button');
      b.style.cssText = 'display:block;width:100%;text-align:left;background:#1a1d2e;color:#fff;border:1px solid #2a2f45;border-radius:6px;padding:6px 8px;margin:4px 0;cursor:pointer;font-size:12px;';
      b.textContent = r.title + (r.meta ? '  (' + r.meta + ')' : '');
      b.title = r.title;
      b.onclick = () => catShowLangs(r);
      catResults.appendChild(b);
    });
  }
  async function catShowLangs(r) {
    catResults.style.display = 'none';
    catLangs.style.display = '';
    catLangs.innerHTML = '';
    catStatus.textContent = 'Đang lấy danh sách ngôn ngữ…';
    const html = await fetchTextVia(r.url, 'html', 'sub-single');
    if (!html) { catStatus.textContent = 'Không tải được trang chi tiết (' + (fetchTextVia.lastError || 'proxy bận') + ') — đợi 1 phút rồi thử lại.'; return; }
    const langs = parseCatDetail(html);
    if (!langs.length) { catStatus.textContent = 'Trang này không có file phụ đề tải được (chỉ có nút Translate).'; return; }
    catStatus.textContent = 'Chọn ngôn ngữ cho: ' + r.title.slice(0, 60);
    const back = document.createElement('button');
    back.textContent = '← Quay lại kết quả';
    back.style.cssText = 'display:block;width:100%;text-align:left;background:transparent;color:#9aa3b2;border:1px solid #2a2f45;border-radius:6px;padding:6px 8px;margin:4px 0;cursor:pointer;font-size:12px;';
    back.onclick = () => { catLangs.style.display = 'none'; catResults.style.display = ''; catStatus.textContent = ''; };
    catLangs.appendChild(back);
    langs.forEach(l => {
      const b = document.createElement('button');
      b.textContent = (l.code === 'vi' ? '🇻🇳 ' : '') + l.name + (l.code ? ' (' + l.code + ')' : '');
      b.style.cssText = 'display:block;width:100%;text-align:left;background:#1a1d2e;color:#fff;border:1px solid #2a2f45;border-radius:6px;padding:6px 8px;margin:4px 0;cursor:pointer;font-size:12px;';
      b.onclick = () => catDownload(l);
      catLangs.appendChild(b);
    });
  }
  async function catDownload(l) {
    catStatus.textContent = 'Đang tải phụ đề ' + l.name + '…';
    const text = await fetchTextVia(l.url, 'srt');
    if (!text) { catStatus.textContent = 'Tải file .srt thất bại (' + (fetchTextVia.lastError || 'proxy bận') + ') — đợi 1 phút rồi bấm lại.'; return; }
    const name = fileNameFromUrl(l.url);
    if (!loadText(text, name)) { catStatus.textContent = 'File tải về không phải phụ đề SRT hợp lệ.'; return; }
    catStatus.textContent = 'Đã tải ' + l.name + ' (' + cues.length + ' câu) — đang dùng luôn.';
    if (!running) {
      if (video) startRunning();
      else startBtn.onclick();
    }
  }
  function fileNameFromUrl(u) {
    try { const p = decodeURIComponent(new URL(u).pathname); return p.split('/').pop() || 'subtitle.srt'; }
    catch (_) { return 'subtitle.srt'; }
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
  body.style.cssText = 'padding:4px 12px 12px;max-height:calc(100vh - 70px);overflow-y:auto;';   // bảng dài hơn màn hình thì lướt trong bảng (tiêu đề vẫn đứng yên)
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

  // Hàng nút: "Mở tab player" (chỉ hiện khi video nằm trong iframe) kề bên
  // nút "Quét lại" (dò video thủ công) — 2 nút hay dùng nằm cùng 1 chỗ
  const playerRow = document.createElement('div');
  playerRow.style.cssText = 'display:flex;gap:8px;margin:4px 0;';
  const openPlayerBtn = mkBtn('Mở tab player', '#16a34a');
  openPlayerBtn.style.display = 'none';
  const rescanBtn = mkBtn('Quét lại');
  playerRow.append(openPlayerBtn, rescanBtn);
  body.appendChild(playerRow);
  let noticePlayer = null;
  function showPlayerNotice(players) {
    noticePlayer = players[0];
    openPlayerBtn.style.display = '';
  }
  function hidePlayerNotice() { openPlayerBtn.style.display = 'none'; }
  openPlayerBtn.onclick = () => {
    if (noticePlayer && noticePlayer.url) (origOpen || window.open).call(window, noticePlayer.url, '_blank');   // dùng window.open gốc để không bị chặn quảng cáo chặn luôn
  };

  // Hàng: chọn video/khung (nếu trang có nhiều video hoặc nhiều iframe player)
  const videoSel = document.createElement('select');
  videoSel.style.cssText = 'flex:1;min-width:0;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:5px 7px;';
  videoSel.innerHTML = '<option value="">Bấm Bắt đầu để quét video / khung</option>';
  let scanList = [];   // [{kind:'video'|'iframe', el, ...}] — danh sách quét được, dùng chung cho dropdown + nút Quét lại
  function refreshVideoList() {
    const cur = videoSel.value;
    const videos = findVideos();
    const players = findPlayerIframes();   // quét HẾT iframe còn hiện, xếp hạng giống player
    scanList = [
      ...videos.map(el => ({ kind: 'video', el })),
      ...players.map(p => ({ kind: 'iframe', el: p.el, host: p.host, url: p.url, w: p.w, h: p.h, score: p.score })),
    ];
    videoSel.innerHTML = '';
    if (!scanList.length) {
      videoSel.innerHTML = '<option value="">Không thấy video hay khung nào</option>';
      return scanList;
    }
    let vn = 0, fn = 0;
    scanList.forEach((it, i) => {
      const o = document.createElement('option');
      const r = it.el.getBoundingClientRect();
      o.value = String(i);
      if (it.kind === 'video') {
        vn++;
        o.textContent = `Video ${vn} — ${Math.round(r.width)}×${Math.round(r.height)}${it.el.paused ? '' : ' ▶'}`;
      } else {
        fn++;
        o.textContent = `Khung ${fn} — ${it.host || 'iframe'} (${Math.round(r.width)}×${Math.round(r.height)})`;
      }
      videoSel.appendChild(o);
    });
    const idx = Math.max(0, Math.min(+cur || 0, scanList.length - 1));
    videoSel.value = String(idx);
    return scanList;
  }
  function setVideo(v) {
    if (video && video !== v) detachVideoListeners(video);
    video = v;
    lastIdx = -1;
    attachOverlay();
    if (portrait) enterPortrait();   // đổi video -> phóng to dọc lại trên video mới
    if (running) attachVideoListeners(v);
    updateStatus();
    updatePortraitBtn();
  }
  videoSel.onchange = () => {
    const it = scanList[+videoSel.value];
    if (!it) return;
    if (it.kind === 'video') { setVideo(it.el); hidePlayerNotice(); }
    else { setPickedIframe(it.el); showPlayerNotice([it]); }   // chọn khung -> hiện nút Mở tab player cho đúng khung đó
  };
  rescanBtn.onclick = () => {
    refreshVideoList();
    const it = scanList[+videoSel.value || 0];
    if (!it) { setStatus('Không thấy video hay khung nào — mở video rồi bấm Quét lại.'); return; }
    if (it.kind === 'video') {
      setVideo(it.el);
      hidePlayerNotice();
    } else {
      setPickedIframe(it.el);
      showPlayerNotice([it]);   // hiện nút Mở tab player cho đúng khung vừa chọn
    }
    updateStatus();
  };
  const videoRow = row('Video/Khung', videoSel);
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

  // ---------- Tìm phụ đề trên SubtitleCat ----------
  const catBox = document.createElement('div');
  catBox.style.cssText = 'margin:6px 0 8px;padding:8px;border:1px solid #2a2f45;border-radius:8px;background:#12141f;';
  const catTitle = document.createElement('div');
  catTitle.textContent = '🔍 Tìm phụ đề (SubtitleCat)';
  catTitle.style.cssText = 'font-weight:bold;font-size:13px;margin-bottom:6px;';
  const catRow = document.createElement('div');
  catRow.style.cssText = 'display:flex;gap:6px;';
  const catInput = document.createElement('input');
  catInput.type = 'text';
  catInput.placeholder = 'Gõ tên phim, vd SONE-567';
  catInput.style.cssText = 'flex:1;background:#0d0f1a;color:#fff;border:1px solid #333;padding:6px 8px;border-radius:6px;font-size:13px;min-width:0;';
  const catBtn = mkBtn('Tìm', '#14B8A6');
  const catStatus = document.createElement('div');
  catStatus.style.cssText = 'font-size:12px;color:#9aa3b2;margin-top:6px;';
  const catResults = document.createElement('div');
  catResults.style.cssText = 'max-height:180px;overflow-y:auto;margin-top:4px;';
  const catLangs = document.createElement('div');
  catLangs.style.cssText = 'max-height:180px;overflow-y:auto;margin-top:4px;display:none;';
  catRow.append(catInput, catBtn);
  catBox.append(catTitle, catRow, catStatus, catResults, catLangs);
  body.appendChild(catBox);
  catBtn.onclick = catSearch;
  catInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') catSearch(); });

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

  // Hàng: xem dọc
  const portraitChk = document.createElement('input');
  portraitChk.type = 'checkbox'; portraitChk.checked = settings.autoPortrait;
  portraitChk.onchange = () => {
    settings.autoPortrait = portraitChk.checked; saveSettings();
    if (settings.autoPortrait && !portrait) enterPortrait();
  };
  const portraitBtn = mkBtn('⤢ Xem dọc');
  portraitBtn.onclick = togglePortrait;
  const ppBtn = mkBtn('⏯');
  ppBtn.onclick = () => {
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };
  function updatePortraitBtn() {
    // Chỉ được gọi sau khi bảng đã dựng xong (mọi đường gọi đều sau init).
    portraitBtn.textContent = portrait ? 'Thoát xem dọc' : '⤢ Xem dọc';
    ppBtn.disabled = !video;
  }
  const pRow = document.createElement('div');
  pRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0 8px;flex-wrap:wrap;';
  pRow.append(mkChkLab(portraitChk, 'Phóng to dọc khi bắt đầu'), portraitBtn, ppBtn);
  body.appendChild(pRow);

  // Hàng: độ phóng thêm ở chế độ xem dọc (1 = vừa khít chiều rộng, tối đa 2x)
  const zoomInput = mkInput('range', { min: 1, max: 2, step: 0.05, value: settings.zoom });
  const zoomVal = mkVal(Math.round(settings.zoom * 100) + '%');
  zoomInput.oninput = () => {
    settings.zoom = +zoomInput.value;
    zoomVal.textContent = Math.round(settings.zoom * 100) + '%';
    saveSettings();
    if (portrait) layoutPortrait();
  };
  const zoomRow = row('Độ phóng', zoomInput); zoomRow.appendChild(zoomVal);
  body.appendChild(zoomRow);

  // Hàng: chặn quảng cáo nhảy trang + bấm chọn video
  const adBlockChk = document.createElement('input');
  adBlockChk.type = 'checkbox'; adBlockChk.checked = settings.adBlock;
  adBlockChk.onchange = () => {
    settings.adBlock = adBlockChk.checked; saveSettings(); applyAdBlock(settings.adBlock);
  };
  const pickBtn = mkBtn('🎯 Chọn video');
  pickBtn.onclick = () => (pickMode ? exitPickMode() : enterPickMode());
  const abRow = document.createElement('div');
  abRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0 8px;flex-wrap:wrap;';
  abRow.append(mkChkLab(adBlockChk, 'Chặn quảng cáo nhảy trang'), pickBtn);
  body.appendChild(abRow);

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
    const v = pickVideo(list.filter(x => x.kind === 'video').map(x => x.el));
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
    const players = findPlayerIframes(1);   // chỉ iframe giống player mới tự hiện nút
    if (players.length) {
      showPlayerNotice(players);
      if (settings.autoPortrait) enterPortrait();   // phóng to dọc ngay trên iframe player
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
    if (settings.autoPortrait) enterPortrait();
    updateSub();   // hiện đúng câu tại thời điểm hiện tại ngay
    setStatus('Đang chạy — phụ đề theo video.');
    updatePortraitBtn();
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
    clearTimeout(portraitTimer);
    stopRunning();
    exitPortrait();
    exitPickMode();
    applyAdBlock(false);
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('keydown', onKey);
    if (panel.parentElement) panel.parentElement.removeChild(panel);
    if (pickCancelBtn && pickCancelBtn.parentElement) pickCancelBtn.parentElement.removeChild(pickCancelBtn);
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

  /* ---------- Khởi động ---------- */
  document.body.appendChild(panel);
  loadSavedFile();   // nạp file .srt đã lưu sẵn (nếu có) — chưa chạy phụ đề
  applyAdBlock(settings.adBlock);
  const pickedOk = applyPicked();   // dùng lại video/khung đã lưu bằng cách bấm chọn
  // Nếu trang không có video trực tiếp mà có iframe player thì hiện hướng dẫn ngay.
  if (!video && !findVideos().length) {
    const players = findPlayerIframes(1);   // chỉ iframe giống player mới tự hiện nút
    if (players.length) showPlayerNotice(players);
  }
  document.addEventListener('keydown', onKey);   // Esc thoát xem dọc / hủy chọn video
  updateStatus(true);
  // Tự động khi chạy lệnh: có file lưu sẵn thì chạy phụ đề luôn; luôn thử phóng to dọc.
  if (cues.length) {
    if (video) startRunning();
    else startBtn.onclick();
  } else if (settings.autoPortrait) {
    portraitLeft = 8;   // thử tối đa ~4 giây rồi dừng hẳn
    tryAutoPortrait();
  }
  console.log('%c[SRT Injector] đã sẵn sàng. Chọn file .srt (chỉ cần 1 lần, sẽ lưu sẵn) rồi bấm Bắt đầu.',
    'color:#0ea5a4;font-weight:bold;');
})();
