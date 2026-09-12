# Sài Gòn Ký Ức — bản cộng đồng

## Luồng dữ liệu
1. Người dùng nhập tên, địa điểm, khoảng thời gian, câu chuyện và có thể chọn 1 ảnh.
2. Website nén ảnh ở trình duyệt rồi gửi `imageData` (base64) tới Google Apps Script.
3. Apps Script đọc cả `e.parameter` và raw POST body để tránh mất trường `imageData`.
4. Ảnh được lưu vào Google Drive trong thư mục **Saigon Memory Uploads**.
5. URL ảnh + ID ảnh + trạng thái upload được ghi vào Google Sheet.
6. Cột **Ảnh xem trước** tự dùng `IMAGE()` để hiện thumbnail trong Sheet.
7. Khi đổi trạng thái thành **Đã duyệt**, website lấy câu chuyện qua API và hiển thị trên bản đồ/timeline.

## Cực kỳ quan trọng: cấp quyền Drive
Sau khi dán code `google-apps-script.gs` vào Apps Script:

1. Bấm **Lưu**.
2. Chọn hàm `authorizeDrive` ở thanh chọn hàm.
3. Bấm **Chạy (Run)**.
4. Google sẽ yêu cầu cấp quyền → chọn tài khoản → **Cho phép**.
5. Quay lại Sheet và kiểm tra đã có thư mục **Saigon Memory Uploads** trong Google Drive.

Chỉ cần làm bước này một lần cho project Apps Script.

## Triển khai Web App
- **Triển khai → Quản lý các lần triển khai**
- Chỉnh sửa deployment Web App
- Chọn **Phiên bản mới**
- Thực thi với tư cách: **Tôi**
- Ai có quyền truy cập: **Bất kỳ ai**
- Sau khi triển khai, giữ nguyên URL `/exec` trong `config.js`.

## Kiểm tra upload
Gửi một câu chuyện mới có ảnh. Trong Sheet, hàng mới phải có:
- Cột I `Ảnh`: URL Google Drive thumbnail
- Cột J `ID ảnh`: ID file Drive
- Cột K `Trạng thái ảnh`: `Đã lưu ảnh + đã bật chia sẻ`
- Cột L `Ảnh xem trước`: thumbnail

Nếu K báo lỗi, gửi ảnh chụp cột K hoặc phần **Thực thi** trong Apps Script để biết chính xác nguyên nhân.

## Lưu ý
Các câu chuyện cũ đã được gửi khi backend chưa lưu ảnh sẽ vẫn trống ảnh. Muốn có ảnh cho chúng, cần gửi lại ảnh.


## Logo
Logo SG tùy chỉnh được đặt tại `assets/images/saigon-logo.png`. Logo không xuất hiện trong màn hình intro; chỉ hiển thị ở header/footer.
