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
  host.querySelectorAll('[data-community-id]').forEach(btn=>btn.addEventListener('click',()=>openStory(btn.dataset.communityId)));
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let supabaseClient = null;
const MEDIA_BUCKET = window.SAIGON_MEMORY_CONFIG?.MEDIA_BUCKET || 'media';

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
  if(file.size>20*1024*1024){
    videoInput.value='';
    document.querySelector('#formNote').textContent='Video tối đa 20 MB.';
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

function uploadToSupabase(file,path,onProgress){
  const cfg=window.SAIGON_MEMORY_CONFIG||{};
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('POST',`${cfg.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(MEDIA_BUCKET)}/${path}`,true);
    xhr.setRequestHeader('apikey',cfg.SUPABASE_ANON_KEY); xhr.setRequestHeader('Authorization','Bearer '+cfg.SUPABASE_ANON_KEY); xhr.setRequestHeader('x-upsert','false'); xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
    xhr.upload.onprogress=e=>{if(e.lengthComputable) onProgress(e.loaded/e.total);};
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300) resolve(`${cfg.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(MEDIA_BUCKET)}/${path}`); else reject(new Error(`Storage ${xhr.status}: ${xhr.responseText||'Upload thất bại'}`));};
    xhr.onerror=()=>reject(new Error('Không kết nối được kho lưu trữ.')); xhr.onabort=()=>reject(new Error('Upload bị hủy.')); xhr.send(file);
  });
}

async function geocodePlace(place){
  try{
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q='+encodeURIComponent(place+', Hồ Chí Minh, Việt Nam');
    const r=await fetch(url,{headers:{Accept:'application/json'}}); const data=await r.json();
    if(data[0]) return {lat:Number(data[0].lat),lng:Number(data[0].lon)};
  }catch(err){console.warn('Geocode failed:',err);} return {lat:null,lng:null};
}

// ===== GỬI CÂU CHUYỆN — Supabase Storage + Database =====
storyForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const note=document.querySelector('#formNote'); const submitBtn=storyForm.querySelector('button[type="submit"]'); const data=new FormData(storyForm);
  if(!data.get('name')||!data.get('place')||!data.get('story')){note.textContent='Vui lòng điền đầy đủ các ô bắt buộc.';return;}
  if(!initSupabase()){note.textContent='Website chưa được cấu hình kho lưu trữ. Hãy điền SUPABASE_URL và SUPABASE_ANON_KEY trong config.js.';return;}
  const imageFiles=Array.from(imageInput?.files||[]); const videoFile=videoInput?.files?.[0];
  if(imageFiles.length>6){note.textContent='Bạn chỉ có thể chọn tối đa 6 ảnh.';return;}
  if(videoFile&&videoFile.size>200*1024*1024){note.textContent='Video tối đa 200 MB.';return;}
  submitBtn.disabled=true; submitBtn.innerHTML='ĐANG GỬI…';
  try{
    const media=[]; const total=imageFiles.length+(videoFile?1:0); let completed=0;
    for(let i=0;i<imageFiles.length;i++){
      note.textContent=`Đang nén ảnh ${i+1}/${imageFiles.length}…`;
      const file=await compressImage(imageFiles[i]); const path=`stories/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      note.textContent=`Đang tải ảnh ${i+1}/${imageFiles.length}…`; setUploadProgress((completed/Math.max(total,1))*85,'Ảnh '+(i+1)+'/'+imageFiles.length+' · 0%');
      const url=await uploadToSupabase(file,path,p=>setUploadProgress(((completed+p)/Math.max(total,1))*85,`Ảnh ${i+1}/${imageFiles.length} · ${Math.round(p*100)}%`));
      media.push(url); completed++;
    }
    if(videoFile){
      note.textContent='Đang tải video…'; setUploadProgress((completed/Math.max(total,1))*85,'Video · 0%');
      const safe=videoFile.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`stories/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
      const url=await uploadToSupabase(videoFile,path,p=>setUploadProgress(((completed+p)/Math.max(total,1))*85,`Video · ${Math.round(p*100)}%`)); media.push(url); completed++;
    }
    setUploadProgress(90,'Đang lưu thông tin câu chuyện…');
    const geo=await geocodePlace(String(data.get('place')).trim());
    const title=String(data.get('place')).trim();
    const {error}=await supabaseClient.from('stories').insert({name:String(data.get('name')).trim(),author:String(data.get('name')).trim(),place:String(data.get('place')).trim(),decade:String(data.get('decade')||'Nay').trim(),year:String(data.get('decade')||'Nay').trim(),title,story:String(data.get('story')).trim(),quote:'',lat:geo.lat,lng:geo.lng,images:media.filter((_,i)=>i<imageFiles.length),video_url:videoFile?media[media.length-1]:'',status:'pending'});
    if(error) throw error;
    setUploadProgress(100,'Hoàn tất · Câu chuyện đang chờ duyệt'); note.textContent='Đã gửi thành công! Câu chuyện sẽ xuất hiện sau khi được duyệt.';
    storyForm.reset(); clearUploadPreviews(); setTimeout(()=>{hideUploadProgress(); submitDialog.close();},1800);
  }catch(err){console.error(err);note.textContent='Không thể gửi lúc này. '+(err?.message||'Vui lòng thử lại sau.'); setUploadProgress(0,'Upload thất bại');}
  finally{submitBtn.disabled=false;submitBtn.innerHTML='GỬI KÝ ỨC <span>↗</span>';}
});

renderStories();
renderCommunityTimeline();
window.addEventListener('load',()=>{ initMap(); loadApprovedStories(); });
