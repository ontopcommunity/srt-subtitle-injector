# SRT Subtitle Injector

Chèn file phụ đề `.srt` (hoặc `.vtt`) vào video đang phát trên bất kỳ website nào, chạy trực tiếp từ console của DevTools — không cần cài extension.

## Chạy nhanh (1 dòng, dán vào console)

```js
fetch('https://raw.githubusercontent.com/ontopcommunity/srt-subtitle-injector/main/subtitle-injector.js').then(r => r.text()).then(t => eval(t))
```

> Vì file raw trên GitHub trả về dạng `text/plain` nên không nhúng bằng thẻ `<script src>` được — phải tải về rồi `eval` như trên. Chạy lại lệnh bất cứ lúc nào để reset sạch (bản cũ tự gỡ trước khi chạy mới).

## Cách dùng

1. Mở trang có video, mở DevTools (`F12` hoặc `Ctrl+Shift+J`), dán dòng lệnh trên vào console, Enter.
2. Bảng điều khiển hiện ở góc phải màn hình. Chọn file `.srt` (hoặc dán link file `.srt`, hoặc kéo-thả file vào bảng).
3. Phụ đề tự hiện theo đúng thời gian trong file, bám theo video kể cả khi xem fullscreen.

## Chỉnh được gì trong bảng điều khiển

| Mục | Chức năng |
|---|---|
| Video | Chọn video nếu trang có nhiều video, nút Quét lại để tìm video mới mở |
| File .srt | Chọn file `.srt` / `.vtt` trên máy |
| Link .srt | Tải phụ đề từ link (web nào chặn CORS thì tải file về rồi chọn file) |
| Cỡ chữ | 12–64px |
| Vị trí | Khoảng cách từ đáy video (0–40% chiều cao video) |
| Lệch giờ | Đồng bộ phụ đề sớm/trễ hơn video (±10s, chỉnh nhanh ±0.5s) |
| Màu chữ / Nền đen / Căn lề / Chữ đậm | Tuỳ biến hiển thị |
| Hiện phụ đề | Bật/tắt phụ đề mà không gỡ công cụ |

Cài đặt được lưu trong `localStorage` nên lần sau chạy lại vẫn giữ nguyên. Bấm `✕` để gỡ sạch công cụ khỏi trang.

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
- Một số web chặn `eval` (CSP nghiêm ngặt) — nếu console báo lỗi về CSP, thử chạy trên tab ẩn danh hoặc trang khác.
- File duy nhất: [`subtitle-injector.js`](subtitle-injector.js).
