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

function imageForStory(s){
  return s.image || '';
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
    storyGrid.innerHTML = filtered.map(s=>`<article class="story-card" data-id="${escapeHtml(s.id)}">${imageForStory(s) ? `<img src="${escapeHtml(imageForStory(s))}" alt="${escapeHtml(s.place)}">` : '<div class="story-card-no-image">CHƯA CÓ ẢNH</div>'}<div class="content"><small>${escapeHtml(s.year)} · ${escapeHtml(String(s.place).toUpperCase())}</small><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p></div></article>`).join('');
    document.querySelectorAll('.story-card').forEach(card=>card.addEventListener('click',()=>openStory(card.dataset.id)));
  }
  document.querySelector('#archiveCount').textContent = `${filtered.length} câu chuyện đang hiển thị`;
  updateStats();
}

function openStory(id){
  const s=stories.find(x=>String(x.id)===String(id));
  if(!s)return;
  const author = s.community ? `<p class="story-meta">GỬI BỞI ${escapeHtml(s.author || 'ẨN DANH')}</p>` : '';
  const image = imageForStory(s);
  panelContent.innerHTML=`${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(s.place)}">` : ''}<p class="eyebrow" style="margin-top:25px">${escapeHtml(s.year)} · ${escapeHtml(String(s.place).toUpperCase())}</p>${author}<h2>${escapeHtml(s.title)}</h2><p class="story-quote">${escapeHtml(s.quote)}</p><p class="story-body">${escapeHtml(s.text)}</p>`;
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

function renderCommunityTimeline(){
  const host=document.querySelector('#communityTimeline');
  if(!host)return;
  const community=stories.filter(s=>s.community);
  if(!community.length){ host.innerHTML=''; return; }
  host.innerHTML=community.slice().reverse().map(s=>`<article class="community-memory"><span class="year">${escapeHtml(s.year)}</span><div><p class="eyebrow">${escapeHtml(String(s.place).toUpperCase())} · ${escapeHtml(s.author)}</p><h3>${escapeHtml(s.title)}</h3>${s.image ? `<img class="community-memory-image" src="${escapeHtml(s.image)}" alt="Ảnh do cộng đồng gửi">` : ''}<p>${escapeHtml(s.text)}</p><button class="text-link" type="button" data-community-id="${escapeHtml(s.id)}">XEM TRÊN BẢN ĐỒ ↗</button></div></article>`).join('');
  host.querySelectorAll('[data-community-id]').forEach(btn=>btn.addEventListener('click',()=>openStory(btn.dataset.communityId)));
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function loadApprovedStories(){
  if(!GAS_ENDPOINT)return;
  const callbackName='saigonMemoryCallback_'+Date.now();
  const script=document.createElement('script');
  window[callbackName]=(payload)=>{
    try{
      if(payload && payload.ok && Array.isArray(payload.stories)){
        stories=payload.stories.map((story,index)=>({...story, community:true, id:story.id || `community-${index}`}));
        const active=document.querySelector('#decades button.active')?.dataset.decade || 'all';
        renderStories(active);
        updateMarkers(active);
        renderCommunityTimeline();
      }
    }finally{
      delete window[callbackName];
      script.remove();
    }
  };
  script.src=GAS_ENDPOINT+(GAS_ENDPOINT.includes('?')?'&':'?')+'action=stories&callback='+callbackName;
  script.onerror=()=>{ delete window[callbackName]; script.remove(); console.warn('Không tải được câu chuyện cộng đồng.'); };
  document.head.appendChild(script);
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
  document.querySelector('#imagePreview').hidden=true;
  document.querySelector('#imagePreview').removeAttribute('src');
  dialog.showModal();
}));
const submitDialog=document.querySelector('#submitDialog');
const storyForm=document.querySelector('#storyForm');
const imageInput=document.querySelector('#storyImage');
const imagePreview=document.querySelector('#imagePreview');
document.querySelector('#closeSubmitDialog')?.addEventListener('click',()=>submitDialog.close());
submitDialog?.addEventListener('cancel',()=>submitDialog.close());

imageInput?.addEventListener('change',()=>{
  const file=imageInput.files?.[0];
  if(!file){imagePreview.hidden=true;return;}
  if(!file.type.startsWith('image/')){imageInput.value='';imagePreview.hidden=true;return;}
  imagePreview.src=URL.createObjectURL(file);
  imagePreview.hidden=false;
});

function compressImage(file, maxSide=1200, quality=.72){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const dataUrl=canvas.toDataURL('image/jpeg',quality);
      resolve({dataUrl,name:(file.name||'ky-uc').replace(/\.[^.]+$/,'')+'.jpg',type:'image/jpeg'});
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Không đọc được ảnh.'));};
    img.src=url;
  });
}

// ===== GỬI CÂU CHUYỆN THẬT =====
const GAS_ENDPOINT = window.SAIGON_MEMORY_CONFIG?.GAS_ENDPOINT || '';
storyForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const note=document.querySelector('#formNote');
  const submitBtn=storyForm.querySelector('button[type="submit"]');
  const data=new FormData(storyForm);
  if(!data.get('name') || !data.get('place') || !data.get('story')){
    note.textContent='Vui lòng điền đầy đủ các ô bắt buộc.';
    return;
  }
  if(!GAS_ENDPOINT){
    note.textContent='Chưa cấu hình nơi nhận dữ liệu. Hãy mở file config.js và dán URL Google Apps Script Web App.';
    return;
  }
  const file=imageInput?.files?.[0];
  if(file && file.size > 8*1024*1024){
    note.textContent='Ảnh tối đa 8 MB. Ảnh sẽ được nén trước khi gửi.';
    return;
  }
  submitBtn.disabled=true;
  submitBtn.innerHTML='ĐANG GỬI…';
  note.textContent='Đang chuẩn bị câu chuyện và ảnh…';
  try{
    let imagePayload=null;
    if(file){ imagePayload=await compressImage(file); }
    const payload={
      name:String(data.get('name')||'').trim(),
      place:String(data.get('place')||'').trim(),
      decade:String(data.get('decade')||'Nay').trim(),
      story:String(data.get('story')||'').trim(),
      imageData:imagePayload?.dataUrl || '',
      imageName:imagePayload?.name || '',
      imageType:imagePayload?.type || ''
    };
    note.textContent='Đang gửi câu chuyện và ảnh lên Google Drive…';
    await fetch(GAS_ENDPOINT,{method:'POST',mode:'no-cors',body:new URLSearchParams(payload)});
    note.textContent='✓ Đã gửi thành công. Câu chuyện sẽ xuất hiện sau khi được duyệt.';
    storyForm.reset();
    if(imagePreview){imagePreview.hidden=true;imagePreview.removeAttribute('src');}
    setTimeout(()=>{ submitDialog.close(); loadApprovedStories(); },1800);
  }catch(err){
    console.error(err);
    note.textContent='Không thể gửi lúc này. Vui lòng thử lại sau.';
  }finally{
    submitBtn.disabled=false;
    submitBtn.innerHTML='GỬI KÝ ỨC <span>↗</span>';
  }
});

renderStories();
renderCommunityTimeline();
window.addEventListener('load',()=>{ initMap(); loadApprovedStories(); });
