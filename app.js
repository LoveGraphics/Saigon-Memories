const seedStories = [];

const storyGrid = document.querySelector('#storyGrid');
const panel = document.querySelector('#storyPanel');
const panelContent = document.querySelector('#storyPanelContent');
const mapFallback = document.querySelector('#mapFallback');
const mapRetry = document.querySelector('#mapRetry');
let stories = [];
let map = null;
let markers = [];
let markersById = new Map();
let activeTileLayer = null;
let mapInitialized = false;

function imageListForStory(s){
  if(Array.isArray(s.images) && s.images.length) return s.images.filter(Boolean);
  if(s.image) return [s.image];
  return [];
}

function imageForStory(s){
  return imageListForStory(s)[0] || '';
}

function videoForStory(s){
  return s.video || '';
}

function updateStats(){
  const memoryCount=document.querySelector('#memoryCount');
  const placeCount=document.querySelector('#placeCount');
  const yearCount=document.querySelector('#yearCount');
  if(memoryCount) memoryCount.textContent=String(stories.length);
  if(placeCount) placeCount.textContent=String(new Set(stories.map(s=>String(s.place||'').trim()).filter(Boolean)).size);
  if(yearCount) yearCount.textContent=String(new Set(stories.map(s=>String(s.decade||'').trim()).filter(Boolean)).size);
}

function renderStories(filter='all'){
  const filtered = filter === 'all' ? stories : stories.filter(s=>s.decade===filter);
  if(!filtered.length){
    storyGrid.innerHTML='<div class="empty-state"><strong>Chưa có ký ức nào được duyệt.</strong><span>Hãy gửi câu chuyện đầu tiên để bắt đầu xây dựng bản đồ ký ức Sài Gòn.</span></div>';
  }else{
    storyGrid.innerHTML = filtered.map(s=>`<article class="story-card" data-id="${escapeHtml(s.id)}">${imageForStory(s) ? `<img src="${escapeHtml(imageForStory(s))}" alt="${escapeHtml(s.place)}">` : '<div class="story-card-no-image">CHƯA CÓ ẢNH</div>'}<div class="content"><small>${escapeHtml(s.year)} · ${escapeHtml(String(s.place).toUpperCase())}</small><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p>${videoForStory(s)?'<span class="story-media-badge">▶ CÓ VIDEO</span>':''}</div></article>`).join('');
    document.querySelectorAll('.story-card').forEach(card=>card.addEventListener('click',()=>openStory(card.dataset.id)));
  }
  document.querySelector('#archiveCount').textContent = `${filtered.length} câu chuyện đang hiển thị`;
  updateStats();
  renderPhotoGallery();
}

function openStory(id){
  const s=stories.find(x=>String(x.id)===String(id));
  if(!s)return;
  const author = s.community ? `<p class="story-meta">GỬI BỞI ${escapeHtml(s.author || 'ẨN DANH')}</p>` : '';
  const images=imageListForStory(s);
  const imageMarkup=images.length ? `<div class="story-media-grid ${images.length===1?'single':''}">${images.map((url,i)=>`<img src="${escapeHtml(url)}" alt="${escapeHtml(s.place)} — ảnh ${i+1}">`).join('')}</div>` : '';
  const video=videoForStory(s);
  const videoMarkup=video ? `<div class="story-video-wrap"><video src="${escapeHtml(video)}" controls playsinline preload="metadata"></video><small>Video do cộng đồng gửi</small></div>` : '';
  panelContent.innerHTML=`${imageMarkup}${videoMarkup}<p class="eyebrow" style="margin-top:25px">${escapeHtml(s.year)} · ${escapeHtml(String(s.place).toUpperCase())}</p>${author}<h2>${escapeHtml(s.title)}</h2><p class="story-quote">${escapeHtml(s.quote)}</p><p class="story-body">${escapeHtml(s.text)}</p>`;
  panel.classList.add('open'); panel.setAttribute('aria-hidden','false');

  if(map && s.coords){
    map.flyTo(s.coords, 16, {duration:.8});
    const marker = markersById.get(String(s.id));
    if(marker) setTimeout(()=>marker.openPopup(), 500);
  }
}

document.querySelector('#closePanel').addEventListener('click',()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true')});

document.querySelector('#decades').addEventListener('click',e=>{
  const btn=e.target.closest('button'); if(!btn)return;
  document.querySelectorAll('#decades button').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  const filter=btn.dataset.decade; renderStories(filter); updateMarkers(filter);
});

function updateMarkers(filter='all'){
  if(!map)return;
  markers.forEach(m=>m.remove());
  markers=[];
  markersById=new Map();
  stories.filter(s=>s.coords && (filter==='all'||s.decade===filter)).forEach(s=>{
    const marker=L.marker(s.coords,{icon:L.divIcon({className:'',html:'<div class="memory-marker"></div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);
    marker.bindTooltip(`${escapeHtml(s.year)} · ${escapeHtml(s.place)}`,{direction:'top',offset:[0,-12]});
    marker.bindPopup(`<strong>${escapeHtml(s.title)}</strong><br><span>${escapeHtml(s.place)}</span>`,{closeButton:true});
    marker.on('click',()=>openStory(s.id));
    markers.push(marker);
    markersById.set(String(s.id), marker);
  });
}

function renderPhotoGallery(){
  const host=document.querySelector('#photoGallery');
  if(!host)return;
  const media=[];
  stories.slice().reverse().forEach(s=>{
    imageListForStory(s).forEach((url,index)=>media.push({type:'image',url,s,index}));
    if(videoForStory(s)) media.push({type:'video',url:videoForStory(s),s});
  });
  if(!media.length){
    host.innerHTML='<div class="photo-empty">Ảnh và video sẽ xuất hiện tại đây khi cộng đồng gửi và câu chuyện được duyệt.</div>';
    return;
  }
  host.innerHTML=media.map((m,i)=>m.type==='image'
    ? `<button class="photo-tile ${i%7===0?'photo-tile-feature':''}" type="button" data-photo-id="${escapeHtml(m.s.id)}"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.s.place)} — ảnh ${m.index+1}"><span><strong>${escapeHtml(m.s.title)}</strong><small>${escapeHtml(m.s.place)}</small></span></button>`
    : `<button class="photo-tile video-tile ${i%5===0?'photo-tile-feature':''}" type="button" data-photo-id="${escapeHtml(m.s.id)}"><video src="${escapeHtml(m.url)}" muted playsinline preload="metadata"></video><span><strong>▶ ${escapeHtml(m.s.title)}</strong><small>${escapeHtml(m.s.place)} · Video</small></span></button>`
  ).join('');
  host.querySelectorAll('[data-photo-id]').forEach(btn=>btn.addEventListener('click',()=>openStory(btn.dataset.photoId)));
}

function renderCommunityTimeline(){
  const host=document.querySelector('#communityTimeline');
  if(!host)return;
  const community=stories.filter(s=>s.community);
  if(!community.length){ host.innerHTML=''; return; }
  host.innerHTML=community.slice().reverse().map(s=>`<article class="community-memory"><span class="year">${escapeHtml(s.year)}</span><div><p class="eyebrow">${escapeHtml(String(s.place).toUpperCase())} · ${escapeHtml(s.author)}</p><h3>${escapeHtml(s.title)}</h3>${imageForStory(s) ? `<img class="community-memory-image" src="${escapeHtml(imageForStory(s))}" alt="Ảnh do cộng đồng gửi">` : ''}${videoForStory(s) ? `<span class="story-media-badge">▶ VIDEO</span>` : ''}<p>${escapeHtml(s.text)}</p><button class="text-link" type="button" data-community-id="${escapeHtml(s.id)}">XEM TRÊN BẢN ĐỒ ↗</button></div></article>`).join('');
  host.querySelectorAll('[data-community-id]').forEach(btn=>btn.addEventListener('click',()=>goToStoryOnMap(btn.dataset.communityId)));
}

async function goToStoryOnMap(id){
  const s=stories.find(x=>String(x.id)===String(id));
  if(!s){ console.warn('Không tìm thấy story:', id); return; }

  const mapSection=document.getElementById('map-section');
  if(mapSection) mapSection.scrollIntoView({behavior:'smooth',block:'start'});

  // Read coordinates directly from the Supabase row first.
  let lat=Number(s.lat), lng=Number(s.lng);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)){
    if(Array.isArray(s.coords) && s.coords.length>=2){
      lat=Number(s.coords[0]); lng=Number(s.coords[1]);
    }
  }

  // If the coordinates look reversed, correct them.
  if(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)>90 && Math.abs(lng)<=90){
    const tmp=lat; lat=lng; lng=tmp;
  }

  // Last fallback: geocode the place name.
  if(!Number.isFinite(lat) || !Number.isFinite(lng)){
    const place=String(s.place||'').trim();
    if(place){
      try{
        const geo=await geocodePlace(place);
        if(Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng))){
          lat=Number(geo.lat); lng=Number(geo.lng);
          s.lat=lat; s.lng=lng; s.coords=[lat,lng];
        }
      }catch(err){ console.error('Geocode error:',err); }
    }
  }

  if(!Number.isFinite(lat) || !Number.isFinite(lng) || lat<-90 || lat>90 || lng<-180 || lng>180){
    console.warn('Tọa độ không hợp lệ:', {id,lat,lng,story:s});
    return;
  }

  s.lat=lat; s.lng=lng; s.coords=[lat,lng];

  // Show all markers so the selected marker is present.
  document.querySelectorAll('#decades button').forEach(btn=>btn.classList.remove('active'));
  document.querySelector('#decades button[data-decade="all"]')?.classList.add('active');

  try{
    if(!window.L) await loadLeaflet();
    if(!mapInitialized || !map) await initMap();
  }catch(err){
    console.error('Map init error:',err);
    return;
  }
  if(!map || !window.L) return;

  updateMarkers('all');

  // IMPORTANT: move the map using raw coordinates, not marker state.
  const target=L.latLng(lat,lng);
  const marker=markersById.get(String(s.id));

  const moveToStory=()=>{
    if(!map) return;
    map.invalidateSize(true);
    map.stop();
    map.setView(target,16,true);
    // setView can be affected by the smooth scroll/layout; force it once more.
    setTimeout(()=>{
      if(!map) return;
      map.invalidateSize(true);
      map.setView(target,16,false);
      if(marker) marker.openPopup();
    },450);
  };

  // Run after the section has finished scrolling into view.
  setTimeout(moveToStory,900);
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let supabaseClient = null;
const MAX_VIDEO_MB = Number(window.SAIGON_MEMORY_CONFIG?.MAX_VIDEO_MB || 500);

function initSupabase(){
  const cfg=window.SAIGON_MEMORY_CONFIG||{};
  if(!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL.includes('YOUR_PROJECT')) return false;
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  return true;
}

async function loadApprovedStories(){
  if(!initSupabase()){
    console.warn('Supabase chưa được cấu hình.');
    return;
  }
  try{
    const {data,error}=await supabaseClient.from('stories').select('*').eq('status','approved').order('created_at',{ascending:false});
    if(error) throw error;
    stories=(data||[]).map((row,index)=>({
      ...row,
      id:row.id || `community-${index}`,
      year:row.year || row.decade || 'Nay',
      title:row.title || row.place || 'Ký ức Sài Gòn',
      quote:row.quote || '',
      text:row.story || row.text || '',
      author:row.author || row.name || 'ẨN DANH',
      place:row.place || '',
      decade:row.decade || 'Nay',
      coords:(row.lat!=null && row.lng!=null) ? [Number(row.lat),Number(row.lng)] : null,
      images:Array.isArray(row.images)?row.images:[],
      video:row.video_url || '',
      community:true
    }));
    const active=document.querySelector('#decades button.active')?.dataset.decade || 'all';
    renderStories(active); updateMarkers(active); renderCommunityTimeline(); renderPhotoGallery();
  }catch(err){
    console.error('Supabase load error:',err);
    document.querySelector('#archiveCount').textContent='Không tải được dữ liệu ký ức';
  }
}

function loadCss(url){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`link[data-leaflet-css="${url}"]`)) return resolve();
    const link=document.createElement('link'); link.rel='stylesheet'; link.href=url; link.dataset.leafletCss=url;
    link.onload=()=>resolve(); link.onerror=()=>reject(new Error('CSS CDN failed: '+url));
    document.head.appendChild(link);
  });
}

function loadScript(url){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src=url; script.async=true;
    script.onload=()=>resolve(); script.onerror=()=>reject(new Error('JS CDN failed: '+url));
    document.head.appendChild(script);
  });
}

async function loadLeaflet(){
  if(window.L) return true;
  const cdns=[
    {css:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',js:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'},
    {css:'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',js:'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'},
    {css:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',js:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'}
  ];
  for(const cdn of cdns){
    try{ await loadCss(cdn.css); await loadScript(cdn.js); if(window.L) return true; }catch(err){ console.warn(err); }
  }
  return false;
}

function addTileLayerWithFallback(){
  const layers=[
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  ];
  let index=0;
  const tryNext=()=>{
    if(index>=layers.length){ showMapFallback(); return; }
    if(activeTileLayer) map.removeLayer(activeTileLayer);
    const url=layers[index++];
    const layer=L.tileLayer(url,{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
    let loaded=false;
    const timer=setTimeout(()=>{if(!loaded){console.warn('Tile timeout:',url);tryNext();}},7000);
    layer.on('load',()=>{loaded=true;clearTimeout(timer);hideMapFallback();});
    layer.on('tileerror',()=>{if(!loaded){clearTimeout(timer);console.warn('Tile error:',url);tryNext();}});
    activeTileLayer=layer; layer.addTo(map);
  };
  tryNext();
}

function showMapFallback(){mapFallback.hidden=false;}
function hideMapFallback(){mapFallback.hidden=true;}

async function initMap(){
  if(mapInitialized) return;
  hideMapFallback();
  const ok=await loadLeaflet();
  if(!ok){showMapFallback();return;}
  try{
    map=L.map('map',{center:[10.7769,106.7009],zoom:13,zoomControl:true,scrollWheelZoom:false});
    mapInitialized=true;
    addTileLayerWithFallback();
    updateMarkers('all');
    setTimeout(()=>map.invalidateSize(),250);
  }catch(err){console.error(err);showMapFallback();}
}

mapRetry?.addEventListener('click',()=>{
  mapFallback.hidden=true;
  if(map){ mapInitialized=false; map.remove(); map=null; markers=[]; markersById=new Map(); activeTileLayer=null; }
  initMap();
});

const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

document.querySelector('#menuToggle').addEventListener('click',()=>document.querySelector('#nav').classList.toggle('open'));
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>document.querySelector('#nav').classList.remove('open')));

document.querySelectorAll('[data-open-submit]').forEach(btn=>btn.addEventListener('click',()=>{
  const dialog=document.querySelector('#submitDialog');
  document.querySelector('#formNote').textContent='';
  clearUploadPreviews();
  dialog.showModal();
}));
const submitDialog=document.querySelector('#submitDialog');
const storyForm=document.querySelector('#storyForm');
const imageInput=document.querySelector('#storyImage');
const imagePreviewGrid=document.querySelector('#imagePreviewGrid');
const videoInput=document.querySelector('#storyVideo');
const videoPreview=document.querySelector('#videoPreview');
document.querySelector('#closeSubmitDialog')?.addEventListener('click',()=>submitDialog.close());
submitDialog?.addEventListener('cancel',()=>submitDialog.close());

function clearUploadPreviews(){
  if(imageInput) imageInput.value='';
  if(videoInput) videoInput.value='';
  if(imagePreviewGrid) imagePreviewGrid.innerHTML='';
  if(videoPreview){ videoPreview.hidden=true; videoPreview.removeAttribute('src'); videoPreview.load(); }
}

imageInput?.addEventListener('change',()=>{
  const files=Array.from(imageInput.files||[]);
  if(files.length>6){
    imageInput.value='';
    imagePreviewGrid.innerHTML='<p class="upload-error">Bạn chỉ có thể chọn tối đa 6 ảnh.</p>';
    return;
  }
  imagePreviewGrid.innerHTML='';
  files.forEach(file=>{
    if(!file.type.startsWith('image/')) return;
    const img=document.createElement('img');
    img.className='upload-preview'; img.alt='Xem trước ảnh'; img.src=URL.createObjectURL(file);
    imagePreviewGrid.appendChild(img);
  });
});

videoInput?.addEventListener('change',()=>{
  const file=videoInput.files?.[0];
  if(!file){clearUploadPreviews();return;}
  if(!file.type.startsWith('video/')){videoInput.value='';return;}
  if(file.size>MAX_VIDEO_MB*1024*1024){
    videoInput.value='';
    document.querySelector('#formNote').textContent=`Video tối đa ${MAX_VIDEO_MB} MB.`;
    videoPreview.hidden=true;
    return;
  }
  videoPreview.src=URL.createObjectURL(file);
  videoPreview.hidden=false;
});

function compressImage(file, maxSide=1600, quality=.72){
  return new Promise((resolve,reject)=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ URL.revokeObjectURL(url);
      const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>blob?resolve(new File([blob],(file.name||'ky-uc').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})):reject(new Error('Không nén được ảnh.')),'image/jpeg',quality);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Không đọc được ảnh.'));}; img.src=url;
  });
}

function setUploadProgress(percent,label){
  const bar=document.querySelector('#uploadProgressBar'); const wrap=document.querySelector('#uploadProgressWrap'); const text=document.querySelector('#uploadProgressText');
  if(wrap) wrap.hidden=false; if(bar) bar.style.width=Math.max(0,Math.min(100,percent))+'%'; if(text) text.textContent=label || `${Math.round(percent)}%`;
}
function hideUploadProgress(){ const wrap=document.querySelector('#uploadProgressWrap'); if(wrap) wrap.hidden=true; }

function r2WorkerUrl(){
  const cfg=window.SAIGON_MEMORY_CONFIG||{};
  return String(cfg.R2_WORKER_URL||'').replace(/\/$/,'');
}

function publicR2Url(path){
  return `${r2WorkerUrl()}/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function r2Headers(extra={}){
  const cfg=window.SAIGON_MEMORY_CONFIG||{};
  const headers={...extra};
  if(cfg.R2_UPLOAD_TOKEN) headers['X-Upload-Token']=cfg.R2_UPLOAD_TOKEN;
  return headers;
}

function xhrRequest(method,url,body,onProgress){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open(method,url,true);
    Object.entries(r2Headers({'Content-Type':'application/octet-stream'})).forEach(([k,v])=>xhr.setRequestHeader(k,v));
    if(onProgress) xhr.upload.onprogress=e=>{if(e.lengthComputable) onProgress(e.loaded/e.total);};
    xhr.onload=()=>{
      let data=null;
      try{data=xhr.responseText?JSON.parse(xhr.responseText):null;}catch{}
      if(xhr.status>=200&&xhr.status<300) resolve(data);
      else reject(new Error(data?.error || `R2 ${xhr.status}: Upload thất bại`));
    };
    xhr.onerror=()=>reject(new Error('Không kết nối được Cloudflare R2.'));
    xhr.onabort=()=>reject(new Error('Upload bị hủy.'));
    xhr.send(body);
  });
}

async function r2Json(method,path,body){
  const headers=r2Headers({'Content-Type':'application/json'});
  const r=await fetch(`${r2WorkerUrl()}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || `R2 ${r.status}`);
  return data;
}

async function uploadR2(file,path,onProgress){
  const base=r2WorkerUrl();
  if(!base || base.includes('YOUR-WORKER')) throw new Error('Chưa cấu hình R2_WORKER_URL trong config.js.');
  if(file.size>5*1024*1024*1024) throw new Error('File vượt giới hạn 5 GiB của cấu hình upload hiện tại.');

  const create=await r2Json('POST','/upload/create',{key:path,size:file.size,contentType:file.type||'application/octet-stream'});
  const uploadId=create.uploadId;
  const partSize=Number(create.partSize)||10*1024*1024;
  const partCount=Math.ceil(file.size/partSize);
  const parts=new Array(partCount);
  let uploadedBytes=0;
  const partProgress=new Array(partCount).fill(0);
  let nextPart=1;
  let aborted=false;

  const uploadOne=async(partNumber)=>{
    const start=(partNumber-1)*partSize;
    const end=Math.min(start+partSize,file.size);
    const blob=file.slice(start,end);
    const url=`${base}/upload/part?key=${encodeURIComponent(path)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
    let lastError=null;
    for(let attempt=0;attempt<4;attempt++){
      try{
        const result=await xhrRequest('PUT',url,blob,f=>{
          partProgress[partNumber-1]=f;
          let current=uploadedBytes;
          for(let i=0;i<partCount;i++){
            const pSize=(i===partCount-1)?(file.size-(i*partSize)):partSize;
            current += pSize*partProgress[i];
          }
          onProgress(Math.min(1,current/file.size));
        });
        partProgress[partNumber-1]=1;
        uploadedBytes += end-start;
        onProgress(Math.min(1,uploadedBytes/file.size));
        return {partNumber:Number(result.partNumber),etag:result.etag};
      }catch(error){
        lastError=error;
        if(attempt<3) await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      }
    }
    throw lastError || new Error(`Part ${partNumber} upload failed`);
  };

  const worker=async()=>{
    while(true){
      const partNumber=nextPart++;
      if(partNumber>partCount || aborted) return;
      try{parts[partNumber-1]=await uploadOne(partNumber);}catch(error){aborted=true;throw error;}
    }
  };

  try{
    const concurrency=Math.min(3,partCount);
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    await r2Json('POST','/upload/complete',{key:path,uploadId,parts});
    onProgress(1);
    return publicR2Url(path);
  }catch(error){
    try{await r2Json('DELETE',`/upload/abort?key=${encodeURIComponent(path)}&uploadId=${encodeURIComponent(uploadId)}`);}catch{}
    throw error;
  }
}

async function geocodePlace(place){
  try{
    const base=r2WorkerUrl();
    if(!base) return {lat:null,lng:null};
    const r=await fetch(base+'/geocode?place='+encodeURIComponent(place),{headers:{Accept:'application/json'}});
    const data=await r.json().catch(()=>({}));
    const lat=Number(data.lat), lng=Number(data.lng);
    if(r.ok && Number.isFinite(lat) && Number.isFinite(lng)) return {lat,lng};
    console.warn('Geocode failed:',data.error||r.status);
  }catch(err){console.warn('Geocode failed:',err);}
  return {lat:null,lng:null};
}

// ===== GỬI CÂU CHUYỆN — Cloudflare R2 + Supabase Database =====
storyForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const note=document.querySelector('#formNote'); const submitBtn=storyForm.querySelector('button[type="submit"]'); const data=new FormData(storyForm);
  if(!data.get('name')||!data.get('place')||!data.get('story')){note.textContent='Vui lòng điền đầy đủ các ô bắt buộc.';return;}
  if(!initSupabase()){note.textContent='Website chưa được cấu hình database. Hãy điền SUPABASE_URL và SUPABASE_ANON_KEY trong config.js.';return;}
  if(!r2WorkerUrl() || r2WorkerUrl().includes('YOUR-WORKER')){note.textContent='Website chưa được cấu hình Cloudflare R2. Hãy điền R2_WORKER_URL trong config.js.';return;}
  const imageFiles=Array.from(imageInput?.files||[]); const videoFile=videoInput?.files?.[0];
  if(imageFiles.length>6){note.textContent='Bạn chỉ có thể chọn tối đa 6 ảnh.';return;}
  if(videoFile&&videoFile.size>500*1024*1024){note.textContent='Video tối đa 500 MB.';return;}
  submitBtn.disabled=true; submitBtn.innerHTML='ĐANG GỬI…';
  try{
    const media=[]; const total=imageFiles.length+(videoFile?1:0); let completed=0;
    for(let i=0;i<imageFiles.length;i++){
      note.textContent=`Đang nén ảnh ${i+1}/${imageFiles.length}…`;
      const file=await compressImage(imageFiles[i]); const path=`stories/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      note.textContent=`Đang tải ảnh ${i+1}/${imageFiles.length}…`; setUploadProgress((completed/Math.max(total,1))*85,'Ảnh '+(i+1)+'/'+imageFiles.length+' · 0%');
      const url=await uploadR2(file,path,p=>setUploadProgress(((completed+p)/Math.max(total,1))*85,`Ảnh ${i+1}/${imageFiles.length} · ${Math.round(p*100)}%`));
      media.push(url); completed++;
    }
    if(videoFile){
      note.textContent='Đang tải video…'; setUploadProgress((completed/Math.max(total,1))*85,'Video · 0%');
      const safe=videoFile.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`stories/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
      const url=await uploadR2(videoFile,path,p=>setUploadProgress(((completed+p)/Math.max(total,1))*85,`Video · ${Math.round(p*100)}%`)); media.push(url); completed++;
    }
    setUploadProgress(90,'Đang lưu thông tin câu chuyện…');
    const place=String(data.get('place')).trim();
    note.textContent='Đang xác định vị trí trên bản đồ…';
    const geo=await geocodePlace(place);
    if(geo.lat==null || geo.lng==null){
      throw new Error('Không xác định được địa điểm. Hãy nhập tên địa điểm rõ hơn (ví dụ: Chợ Bến Thành, Quận 1). Câu chuyện chưa được lưu vào cơ sở dữ liệu.');
    }
    const title=place;
    const {error}=await supabaseClient.from('stories').insert({name:String(data.get('name')).trim(),author:String(data.get('name')).trim(),place,decade:String(data.get('decade')||'Nay').trim(),year:String(data.get('decade')||'Nay').trim(),title,story:String(data.get('story')).trim(),quote:'',lat:geo.lat,lng:geo.lng,images:media.filter((_,i)=>i<imageFiles.length),video_url:videoFile?media[media.length-1]:'',status:'pending'});
    if(error) throw error;
    setUploadProgress(100,'Hoàn tất · Câu chuyện đang chờ duyệt'); note.textContent='Đã gửi thành công! Câu chuyện sẽ xuất hiện sau khi được duyệt.';
    storyForm.reset(); clearUploadPreviews(); setTimeout(()=>{hideUploadProgress(); submitDialog.close();},1800);
  }catch(err){console.error(err);note.textContent='Không thể gửi lúc này. '+(err?.message||'Vui lòng thử lại sau.'); setUploadProgress(0,'Upload thất bại');}
  finally{submitBtn.disabled=false;submitBtn.innerHTML='GỬI KÝ ỨC <span>↗</span>';}
});

renderStories();
renderCommunityTimeline();
window.addEventListener('load',()=>{ initMap(); loadApprovedStories(); });
