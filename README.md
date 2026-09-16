# Sài Gòn Ký Ức — Supabase

Bản này bỏ Google Sheets/Apps Script. Dữ liệu câu chuyện lưu trong Supabase Database, ảnh/video lưu trong Supabase Storage.

## Setup
1. Tạo project Supabase.
2. Mở SQL Editor và chạy `supabase-setup.sql`.
3. Vào Project Settings → API, lấy Project URL và `anon` public key.
4. Điền vào `config.js`.
5. Deploy website.

Câu chuyện mới có status `pending`. Sau khi kiểm duyệt, đổi thành `approved` trong bảng `stories`; website chỉ load các bản ghi `approved`.

## Upload
- Tối đa 6 ảnh/câu chuyện.
- Video tối đa 200 MB.
- Upload media đi thẳng từ trình duyệt lên Supabase Storage, có thanh tiến trình thực tế.
- Không còn phụ thuộc Google Sheets/Apps Script.
