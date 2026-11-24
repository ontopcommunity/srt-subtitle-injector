# SRT Subtitle Injector

Chèn file phụ đề `.srt` (hoặc `.vtt`) vào video đang phát trên bất kỳ website nào, chạy trực tiếp từ console của DevTools — không cần cài extension.

## Chạy nhanh (1 dòng, dán vào console)

```js
fetch('https://raw.githubusercontent.com/ontopcommunity/srt-subtitle-injector/main/subtitle-injector.js').then(r => r.text()).then(t => eval(t))
```

> Vì file raw trên GitHub trả về dạng `text/plain` nên không nhúng bằng thẻ `<script src>` được — phải tải về rồi `eval` như trên. Chạy lại lệnh bất cứ lúc nào để reset sạch (bản cũ tự gỡ trước khi chạy mới).

## Cách dùng

1. Mở trang có video, mở DevTools (`F12` hoặc `Ctrl+Shift+J`), dán dòng lệnh trên vào console, Enter.
2. Bảng điều khiển hiện ở góc phải màn hình. Chọn file `.srt` **1 lần duy nhất** — file được lưu sẵn trong máy, lần sau chạy lệnh là có sẵn, không cần chọn lại (cũng có thể dán link `.srt` hoặc kéo-thả file vào bảng).
3. Bấm **▶ Bắt đầu** — tool quét video đang chạy 1 lần duy nhất, chèn phụ đề vào rồi ngừng quét hẳn. Phụ đề tự hiện theo đúng thời gian trong file, bám theo video kể cả khi xem fullscreen. Bấm **⏸ Dừng** để tắt.

## Xem dọc — tự động phóng to lấp màn dọc, vẫn ở nguyên trang

Khi chạy lệnh (hoặc bấm **▶ Bắt đầu**), video tự động phóng to lấp màn hình **dọc** mà không chuyển tab, không dùng fullscreen ngang của trình duyệt — và **không xoay video**:

- Video ngang (16:9...) giữ nguyên chiều ngang, phóng to lấp hết chiều rộng màn dọc, căn giữa theo chiều cao. Thanh **"Độ phóng"** kéo to thêm (tối đa 2x, sẽ cắt 2 bên nếu phóng quá).
- Video dọc sẵn thì phóng to lấp chiều cao.
- Phụ đề vẫn bám đúng khung hình đang hiển thị, chữ thẳng để đọc.
- Thoát bằng nút **"✕ Thoát xem dọc"** góc trái trên, phím **Esc**, hoặc nút **"Xem dọc"** trong bảng. Đổi video / xoay màn hình tự tính lại cỡ.
- Bỏ tick **"Phóng to dọc khi bắt đầu"** trong bảng nếu không muốn tự động.

Nút **⏯** trong bảng để tạm dừng / tiếp tục video khi đang xem dọc (lúc này thanh điều khiển gốc của player bị che sau video).

## Tìm phụ đề trên SubtitleCat — không cần tải file về máy

Trong bảng có khung **"🔍 Tìm phụ đề (SubtitleCat)"**:

1. Gõ tên phim (vd `SONE-567`) → bấm **Tìm** (hoặc Enter) → hiện list kết quả.
2. Bấm 1 kết quả → hiện list ngôn ngữ (tiếng Việt lên đầu, rồi English, rồi các tiếng khác).
3. Bấm 1 ngôn ngữ → file `.srt` được tải về và **chạy phụ đề luôn** (đồng thời lưu sẵn trong máy như file tự chọn).

Vì subtitlecat.com chặn đọc từ web khác (CORS), script tải qua các đường trung gian: r.jina.ai (trang HTML), api.cors.lol / allorigins / codetabs (file .srt) — chạy song song tất cả các đường, đường nào trả về nội dung đúng trước thì lấy ngay (thường 2–3 giây), trang báo lỗi bị loại. Nếu tất cả đều bận, bảng báo rõ lý do từng đường, đợi 1 phút rồi bấm Tìm lại.

## Chặn quảng cáo nhảy trang

Mặc định **BẬT** (tick "Chặn quảng cáo nhảy trang" trong bảng):

- Chặn cửa sổ bật ra (`window.open`) — quảng cáo popunder không mở được tab mới.
- Chặn bấm vào link quảng cáo sang web khác.
- Hỏi trước khi trang tự nhảy đi (trình duyệt hiện bảng "Rời khỏi trang?").

Nút "Mở tab player" vẫn mở được bình thường. Muốn duyệt web bình thường thì bỏ tick.

## Chọn video bằng cách bấm vào nó

Bấm nút **"🎯 Chọn video"** trong bảng → di chuột lên video đang phát (nó viền xanh) → bấm vào video để lưu lại làm video mục tiêu. Trên điện thoại thì chạm thẳng vào khung video — script tự nhận diện element tại điểm chạm, bấm đúng mảng chứa video (kể cả bấm vào lớp phủ nút bấm/quảng cáo trên mặt video) là lấy video đó và bám theo thời gian của nó luôn. Bấm vào khung player (iframe) thì lưu khung đó. Lần sau chạy lệnh, video/khung đã lưu được dùng luôn, khỏi quét lại. Bấm vào bảng hoặc phím Esc để hủy chọn.

## Video nằm trong iframe (player nhúng)

Nhiều web phim nhúng player kiểu này:

```html
<div id="player-wrapper"><iframe src="https://e.streamforester.name/videos/.../play?..."></iframe></div>
```

Trang chính **không đọc được giờ phát** của video trong iframe khác origin, nên tool không chèn trực tiếp được. Tool tự nhận diện trường hợp này và chỉ hiện nút **"Mở tab player"** trong bảng, kề bên nút **"Quét lại"** (dò video thủ công). Bảng dài hơn màn hình thì lướt ngay trong bảng (tiêu đề vẫn đứng yên). Có 2 cách chạy:

1. **Mở tab player (nhanh nhất):** bấm nút **"Mở tab player"** trong bảng — mở tab mới chỉ có player, dán lại lệnh 1 dòng trong tab đó là chạy (video thành top-level).
2. **Chạy trong iframe:** trong DevTools, bấm khung **"top"** phía trên console → chọn iframe của player → dán lại lệnh 1 dòng. Tiêu đề bảng sẽ hiện "trong iframe".

Lưu ý: file `.srt` lưu theo host của player — chọn 1 lần cho mỗi host là xong.

## Siêu tối ưu (bật mặc định, tắt được trong bảng)

- **Không vòng lặp, không quét liên tục:** phụ đề đồng bộ theo sự kiện của video (`timeupdate` / `seeking` / `seeked`) — không dùng `requestAnimationFrame`, không `setInterval`. Tua đến đâu phụ đề bay đến đó ngay lập tức, kể cả bấm sang mốc thời gian khác trong video.
- **Chỉ ghi DOM khi câu phụ đề thật sự đổi.** Dòng trạng thái cập nhật tối đa 1 lần/giây.
- **Tạm dừng các video khác trên trang**, chỉ giữ video đang xem.
- **Đóng băng hiệu ứng animation/transition của trang** (video không bị ảnh hưởng).

## Chỉnh được gì trong bảng điều khiển

| Mục | Chức năng |
|---|---|
| ▶ Bắt đầu / ⏸ Dừng | Quét video 1 lần rồi chạy / dừng hẳn |
| Video | Chọn video nếu trang có nhiều video, nút Quét lại để tìm video mới mở |
| File .srt | Chọn file `.srt` / `.vtt` trên máy (lưu sẵn, lần sau khỏi chọn lại) |
| Link .srt | Tải phụ đề từ link (web nào chặn CORS thì tải file về rồi chọn file) |
| Cỡ chữ | 12–64px |
| Vị trí | Khoảng cách từ đáy video (0–40% chiều cao video) |
| Lệch giờ | Đồng bộ phụ đề sớm/trễ hơn video (±10s, chỉnh nhanh ±0.5s) |
| Màu chữ / Nền đen / Căn lề / Chữ đậm | Tuỳ biến hiển thị |
| Hiện phụ đề | Bật/tắt phụ đề mà không gỡ công cụ |
| Siêu tối ưu | Tắt hiệu ứng trang + dừng video khác (bật mặc định) |

Cài đặt + file `.srt` được lưu trong `localStorage` nên lần sau chạy lại vẫn giữ nguyên. Bấm `✕` để gỡ sạch công cụ khỏi trang.

## File mẫu `.srt`

```
1
00:00:12,930 --> 00:00:14,590
Gần đây tôi đã suy nghĩ về điều này rất nhiều.

2
00:00:15,570 --> 00:00:17,010
Thời gian yêu thích của nhân loại
```

## Lưu ý

- Code chạy hoàn toàn trên trình duyệt của bạn, không gửi dữ liệu đi đâu.
- File `.srt` quá lớn (> ~4MB) vẫn chạy được nhưng không lưu sẵn được (giới hạn `localStorage`).
- Một số web chặn `eval` (CSP nghiêm ngặt) — nếu console báo lỗi về CSP, thử chạy trên tab ẩn danh hoặc trang khác.
- File duy nhất: [`subtitle-injector.js`](subtitle-injector.js).
