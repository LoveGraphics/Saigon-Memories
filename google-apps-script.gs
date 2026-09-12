/*
 * SÀI GÒN KÝ ỨC — Google Apps Script backend (bản sửa upload ảnh)
 *
 * Sheet: "Câu chuyện"
 * Cột: Thời gian gửi | Tên hiển thị | Địa điểm | Khoảng thời gian |
 *       Câu chuyện | Trạng thái | Vĩ độ | Kinh độ | Ảnh | ID ảnh | Trạng thái ảnh
 *
 * QUAN TRỌNG:
 * 1. Script phải được mở từ Google Sheet: Tiện ích mở rộng -> Apps Script.
 * 2. Lần đầu chạy hàm authorizeDrive() thủ công để cấp quyền Google Drive.
 * 3. Sau khi thay code, triển khai Web App thành Phiên bản mới.
 */

const SHEET_NAME = 'Câu chuyện';
const DRIVE_FOLDER_NAME = 'Saigon Memory Uploads';
const HEADERS = [
  'Thời gian gửi',
  'Tên hiển thị',
  'Địa điểm',
  'Khoảng thời gian',
  'Câu chuyện',
  'Trạng thái',
  'Vĩ độ',
  'Kinh độ',
  'Ảnh',
  'ID ảnh',
  'Trạng thái ảnh'
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  // Bổ sung/sửa header nhưng không xóa dữ liệu cũ.
  HEADERS.forEach((header, i) => {
    const cell = sheet.getRange(1, i + 1);
    if (cell.getValue() !== header) cell.setValue(header);
  });
}

/**
 * Chạy hàm này MỘT LẦN bằng nút Run trong Apps Script để cấp quyền Drive.
 */
function authorizeDrive() {
  const folder = getUploadFolder_();
  console.log('Google Drive OK. Folder ID: ' + folder.getId());
  return 'Google Drive đã được cấp quyền. Folder: ' + folder.getName();
}

function getUploadFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback;

  if (params.action === 'stories') {
    const payload = { ok: true, stories: getApprovedStories_() };
    return output_(payload, callback);
  }

  return output_({ ok: true, service: 'Saigon Memory', message: 'API đang hoạt động' }, callback);
}

function doPost(e) {
  try {
    // Đọc cả e.parameter lẫn raw POST body để tránh trường hợp Apps Script
    // không parse đúng payload lớn có base64 ảnh.
    const p = getPostParams_(e);
    const sheet = getSheet_();

    if (p.website) return json_({ ok: false, error: 'spam' });

    if (!String(p.name || '').trim() || !String(p.place || '').trim() || !String(p.story || '').trim()) {
      return json_({ ok: false, error: 'Thiếu trường bắt buộc' });
    }

    let lat = '';
    let lng = '';
    try {
      const result = Maps.newGeocoder()
        .setLanguage('vi')
        .setRegion('vn')
        .geocode(String(p.place).trim() + ', Hồ Chí Minh, Việt Nam');
      if (result && result.results && result.results.length) {
        const location = result.results[0].geometry.location;
        lat = location.lat;
        lng = location.lng;
      }
    } catch (geoErr) {
      console.log('Geocoding failed: ' + geoErr);
    }

    let imageUrl = '';
    let imageId = '';
    let imageStatus = 'Không có ảnh';

    const imageData = String(p.imageData || '');
    console.log('imageData length = ' + imageData.length);

    if (imageData) {
      try {
        const match = imageData.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) throw new Error('imageData không đúng định dạng data URL');

        const mimeType = String(p.imageType || match[1] || 'image/jpeg');
        const base64 = match[2];
        const bytes = Utilities.base64Decode(base64);
        const fileName = sanitizeFileName_(String(p.imageName || ('ky-uc-' + Date.now() + '.jpg')));
        const blob = Utilities.newBlob(bytes, mimeType, fileName);

        const folder = getUploadFolder_();
        const file = folder.createFile(blob);
        imageId = file.getId();

        // Cho website/Sheets đọc ảnh mà không cần đăng nhập tài khoản gửi.
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageStatus = 'Đã lưu ảnh + đã bật chia sẻ';
        } catch (shareErr) {
          imageStatus = 'Đã lưu ảnh nhưng chưa bật chia sẻ: ' + shortError_(shareErr);
          console.log('Sharing failed: ' + shareErr);
        }

        // URL này dùng được cho thumbnail/website.
        imageUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(imageId) + '&sz=w1600';
        console.log('Image saved: ' + imageId);
      } catch (imageErr) {
        imageStatus = 'LỖI upload ảnh: ' + shortError_(imageErr);
        console.log('Image upload failed: ' + imageErr);
      }
    }

    const rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[
      new Date(),
      String(p.name).trim(),
      String(p.place).trim(),
      String(p.decade || 'Nay').trim(),
      String(p.story).trim(),
      'Chờ duyệt',
      lat,
      lng,
      imageUrl,
      imageId,
      imageStatus
    ]]);

    // Nếu có URL ảnh, tạo một thumbnail hiển thị ở cột K thay vì bắt người dùng
    // phải mở URL. Trạng thái ảnh vẫn được giữ ở cột K nếu không thể tạo thumbnail.
    // Thumbnail thực tế dùng cột L để không làm mất thông tin chẩn đoán.
    ensureThumbnailHeader_(sheet);
    if (imageUrl) {
      sheet.getRange(rowNumber, 12).setFormula('=IMAGE(I' + rowNumber + ')');
    }

    SpreadsheetApp.flush();

    return json_({
      ok: true,
      status: 'Chờ duyệt',
      imageSaved: !!imageId,
      imageId: imageId,
      imageUrl: imageUrl,
      imageStatus: imageStatus
    });
  } catch (err) {
    console.log('doPost error: ' + err);
    return json_({ ok: false, error: String(err) });
  }
}

function getPostParams_(e) {
  const params = {};

  // e.parameter là đường chính.
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(key => params[key] = e.parameter[key]);
  }

  // Fallback: tự parse application/x-www-form-urlencoded từ raw body.
  const body = e && e.postData && e.postData.contents;
  if (body && (!params.imageData || params.imageData.length < 100)) {
    try {
      body.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        const key = idx >= 0 ? pair.slice(0, idx) : pair;
        const value = idx >= 0 ? pair.slice(idx + 1) : '';
        const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
        const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
        if (!(decodedKey in params) || !params[decodedKey]) params[decodedKey] = decodedValue;
      });
    } catch (parseErr) {
      console.log('Raw body parse failed: ' + parseErr);
    }
  }

  return params;
}

function ensureThumbnailHeader_(sheet) {
  if (sheet.getRange(1, 12).getValue() !== 'Ảnh xem trước') {
    sheet.getRange(1, 12).setValue('Ảnh xem trước');
  }
}

function sanitizeFileName_(name) {
  return name.replace(/[\\/:*?"<>|#%{}]/g, '_').slice(0, 180) || ('ky-uc-' + Date.now() + '.jpg');
}

function shortError_(err) {
  return String(err || 'unknown').replace(/^Error:\s*/i, '').slice(0, 180);
}

function getApprovedStories_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const stories = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = String(row[5] || '').trim().toLowerCase();
    if (status !== 'đã duyệt' && status !== 'da duyet' && status !== 'approved') continue;

    let lat = Number(row[6]);
    let lng = Number(row[7]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      try {
        const result = Maps.newGeocoder()
          .setLanguage('vi')
          .setRegion('vn')
          .geocode(String(row[2] || '').trim() + ', Hồ Chí Minh, Việt Nam');
        if (result && result.results && result.results.length) {
          const location = result.results[0].geometry.location;
          lat = location.lat;
          lng = location.lng;
          sheet.getRange(i + 1, 7, 1, 2).setValues([[lat, lng]]);
        }
      } catch (geoErr) {
        console.log('Geocoding failed: ' + geoErr);
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lat = 10.7769;
      lng = 106.7009;
    }

    const year = extractYear_(row[3]);
    stories.push({
      id: 'community-' + (i + 1),
      decade: decadeFrom_(row[3]),
      place: String(row[2] || 'Sài Gòn'),
      year: year,
      title: String(row[2] || 'Một ký ức Sài Gòn'),
      text: String(row[4] || ''),
      quote: '“Một mảnh ký ức được cộng đồng gửi lại.”',
      image: String(row[8] || ''),
      coords: [lat, lng],
      author: String(row[1] || 'Ẩn danh'),
      community: true
    });
  }
  return stories;
}

function extractYear_(value) {
  const text = String(value || '').trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return match[0];
  if (/1970/i.test(text)) return '1970s';
  if (/1980/i.test(text)) return '1980s';
  if (/1990/i.test(text)) return '1990s';
  if (/2000/i.test(text)) return '2000s';
  return text || 'Nay';
}

function decadeFrom_(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('1970')) return '1970';
  if (text.includes('1980')) return '1980';
  if (text.includes('1990')) return '1990';
  if (text.includes('2000')) return '2000';
  return 'now';
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function output_(payload, callback) {
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_$.]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(payload);
}
