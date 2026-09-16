const ALLOWED_ORIGINS = ['*'];

const PART_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GiB app-side guard; raise/remove if desired.

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes('*') ? '*' : (allowed ? (origin || '*') : ALLOWED_ORIGINS[0]),
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token',
    'Access-Control-Expose-Headers': 'ETag',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  });
}

function withCors(response, request) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cleanKey(raw) {
  return raw.replace(/^\/+/, '').replace(/\\/g, '/');
}

function isAllowedKey(key) {
  return key.startsWith('stories/') && !key.includes('..');
}

function tokenOk(request, env) {
  if (!env.UPLOAD_TOKEN) return true;
  return request.headers.get('X-Upload-Token') === env.UPLOAD_TOKEN;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    // Public media delivery through the Worker. This keeps the R2 bucket private.
    if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
      const key = cleanKey(url.pathname.slice('/media/'.length));
      if (!isAllowedKey(key)) return json({ error: 'Invalid key' }, 400, request);
      const object = await env.MEDIA.get(key, { range: request.headers });
      if (!object || !object.body) return json({ error: 'Not found' }, 404, request);
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      if (object.range) {
        const start = object.range.offset;
        const length = object.range.length;
        headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
        headers.set('Content-Length', String(length));
      }
      Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
      return new Response(object.body, { status: object.range ? 206 : 200, headers });
    }

    // Server-side geocoding avoids browser CORS/rate-limit issues with Nominatim.
    // The endpoint only returns coordinates; it does not store or expose user data.
    if (request.method === 'GET' && url.pathname === '/geocode') {
      const place = String(url.searchParams.get('place') || '').trim();
      if (!place) return json({ lat: null, lng: null }, 400, request);
      try {
        const q = `${place}, Hồ Chí Minh, Việt Nam`;
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&bounded=1&viewbox=106.35,11.20,107.10,10.35&q=${encodeURIComponent(q)}`;
        const r = await fetch(geoUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'SaigonMemoryMap/1.0 (community memory project)' }
        });
        if (!r.ok) return json({ lat: null, lng: null, error: `Geocoder HTTP ${r.status}` }, 502, request);
        const data = await r.json();
        const item = Array.isArray(data) ? data[0] : null;
        const lat = item ? Number(item.lat) : null;
        const lng = item ? Number(item.lon) : null;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 10.35 || lat > 11.20 || lng < 106.35 || lng > 107.10) {
          return json({ lat: null, lng: null }, 200, request);
        }
        return json({ lat, lng }, 200, request);
      } catch (error) {
        return json({ lat: null, lng: null, error: String(error) }, 502, request);
      }
    }

    if (!tokenOk(request, env)) return json({ error: 'Unauthorized' }, 401, request);

    // Create multipart upload.
    if (request.method === 'POST' && url.pathname === '/upload/create') {
      const body = await request.json().catch(() => ({}));
      const key = cleanKey(String(body.key || ''));
      const contentType = String(body.contentType || 'application/octet-stream');
      if (!isAllowedKey(key)) return json({ error: 'Invalid key' }, 400, request);
      if (body.size != null && (!Number.isFinite(Number(body.size)) || Number(body.size) <= 0 || Number(body.size) > MAX_FILE_SIZE)) {
        return json({ error: 'Invalid file size' }, 400, request);
      }
      const upload = await env.MEDIA.createMultipartUpload(key, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      });
      return json({ key: upload.key, uploadId: upload.uploadId, partSize: PART_SIZE }, 200, request);
    }

    // Upload one part. Each part is <= 10 MiB, safely below the Workers Free 100 MB request-body limit.
    if (request.method === 'PUT' && url.pathname === '/upload/part') {
      const key = cleanKey(url.searchParams.get('key') || '');
      const uploadId = url.searchParams.get('uploadId');
      const partNumber = Number(url.searchParams.get('partNumber'));
      if (!isAllowedKey(key) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !request.body) {
        return json({ error: 'Missing or invalid upload parameters' }, 400, request);
      }
      const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
      try {
        const part = await upload.uploadPart(partNumber, request.body);
        return json({ partNumber: part.partNumber, etag: part.etag }, 200, request);
      } catch (error) {
        return json({ error: String(error) }, 400, request);
      }
    }

    // Complete multipart upload.
    if (request.method === 'POST' && url.pathname === '/upload/complete') {
      const body = await request.json().catch(() => ({}));
      const key = cleanKey(String(body.key || ''));
      const uploadId = String(body.uploadId || '');
      const parts = Array.isArray(body.parts) ? body.parts.map(p => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })) : [];
      if (!isAllowedKey(key) || !uploadId || !parts.length) return json({ error: 'Missing completion data' }, 400, request);
      parts.sort((a, b) => a.partNumber - b.partNumber);
      const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
      try {
        const object = await upload.complete(parts);
        return json({ key: object.key, etag: object.httpEtag, url: `${url.origin}/media/${object.key.split('/').map(encodeURIComponent).join('/')}` }, 200, request);
      } catch (error) {
        return json({ error: String(error) }, 400, request);
      }
    }

    // Abort a failed upload so abandoned parts can be cleaned up immediately.
    if (request.method === 'DELETE' && url.pathname === '/upload/abort') {
      const key = cleanKey(url.searchParams.get('key') || '');
      const uploadId = url.searchParams.get('uploadId');
      if (!isAllowedKey(key) || !uploadId) return json({ error: 'Missing abort data' }, 400, request);
      try {
        await env.MEDIA.resumeMultipartUpload(key, uploadId).abort();
      } catch (error) {
        return json({ error: String(error) }, 400, request);
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    return json({ ok: true, service: 'Sài Gòn Ký Ức R2 media worker' }, 200, request);
  },
};
