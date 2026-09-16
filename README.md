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
- Video tối đa 500 MB.
- Upload media đi thẳng từ trình duyệt lên Supabase Storage, có thanh tiến trình thực tế.
- Không còn phụ thuộc Google Sheets/Apps Script.


Lưu ý video lớn: website dùng TUS resumable upload cho file > 6 MB. Supabase Free hiện giới hạn file tối đa 50 MB; muốn cho phép video 500 MB cần nâng project lên gói hỗ trợ giới hạn cao hơn và đặt Global file size limit + bucket limit ít nhất 500 MB trong Storage Settings.


## Cloudflare R2 storage (V5)

This version keeps Supabase **Database** for the `stories` table but moves new image/video uploads to **Cloudflare R2** through `worker.js`.

### Architecture

- Supabase: story metadata, moderation status, map coordinates.
- Cloudflare R2: images and videos.
- Cloudflare Worker: multipart upload API + media delivery.
- Browser: splits large files into 10 MiB parts and uploads 3 parts concurrently.
- Video limit in the website: 500 MB.

R2 multipart uploads support much larger objects than this website limit; the current website intentionally uses 500 MB as its UX limit. Cloudflare documents multipart uploads for large files and says parts can be 5 MiB–5 GiB, with objects up to 5 TiB and up to 10,000 parts. Workers Free requests have a 100 MB request-body limit, so this project sends 10 MiB parts through the Worker. 

### 1. Create the R2 bucket

Cloudflare Dashboard → **Storage & databases → R2 → Overview → Create bucket**.

Use exactly:

`saigon-memory-media`

Keep the bucket **private**. The Worker serves approved media through `/media/...`, so you do not need to make the bucket public.

### 2. Create the Worker

From the `r2-worker` folder, deploy the included `worker.js` and `wrangler.toml`:

```powershell
npm install -g wrangler
wrangler login
wrangler deploy
```

The included `wrangler.toml` binds `saigon-memory-media` as `MEDIA`.

After deployment Cloudflare gives you a URL similar to:

`https://saigon-memory-r2.<your-subdomain>.workers.dev`

Put that URL into `config.js` as `R2_WORKER_URL`.

### 3. Local testing

```powershell
wrangler dev
```

If you change `wrangler.toml`, redeploy with:

```powershell
wrangler deploy
```

### 4. Supabase remains the database

You still need:

```js
SUPABASE_URL
SUPABASE_ANON_KEY
```

Only Storage has moved to R2. Existing stories whose media URLs point to Supabase Storage can continue to work until you migrate/delete those old files.

### 5. Configure the website

Edit `config.js`:

```js
window.SAIGON_MEMORY_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  R2_WORKER_URL: 'https://YOUR-WORKER.workers.dev',
  R2_UPLOAD_TOKEN: '',
  MAX_VIDEO_MB: 500
};
```

Do not put a Cloudflare API token, R2 Access Key ID, or R2 Secret Access Key in this file. This architecture does not require exposing those credentials to the browser.

### 6. Deploy the website

Upload the whole website folder to GitHub Pages/your static host. The Worker and the static website are separate deployments.

### 7. Important security note

The Worker currently allows browser uploads without an authentication token when `R2_UPLOAD_TOKEN` is empty. CORS is not authentication. This is convenient for a school/community prototype but an open upload endpoint can be abused.

For a public production launch, add Cloudflare Turnstile/rate limiting or another server-side anti-abuse mechanism before opening submissions widely.

### 8. R2 pricing

R2 Standard currently includes 10 GB-month of storage, 1 million Class A operations and 10 million Class B operations per month at no charge. Internet egress is free. Beyond the free tier, Standard storage is currently $0.015/GB-month plus operation charges.


### Geocoding
New submissions are geocoded server-side by the Cloudflare Worker before inserting into Supabase, so `lat` and `lng` are required to be real coordinates. If a place cannot be found, the submission is not inserted. Redeploy the Worker after this update.
