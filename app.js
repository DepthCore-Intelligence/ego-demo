'use strict';
(() => {
const $=s=>document.querySelector(s), CONFIG=JSON.parse($('#viewer-config').textContent), SCENES=CONFIG.scenes;
let W=1600,H=1300,N=W*H;
const CMAP = '5e4fa25c51a35a53a45855a55757a6555aa7535ca8515ea95060aa4e63ab4c65ac4b67ad4969ae476caf456eb04470b14272b24075b43e77b53d79b63b7bb7397db83880b93682ba3484bb3286bc3389bc358bbb378dba398fb93b92b83d94b73f96b64199b5439bb5459db4479fb349a2b24ba4b14da6b04fa8af51abae53adad55afac57b2ab59b4aa5bb6a95db8a85fbba761bda663bfa566c2a568c3a46bc4a46ec5a470c6a473c7a476c8a478c9a47bcaa47ecba481cca483cda486cea489cfa48bd0a48ed1a491d2a493d3a496d5a499d6a49cd7a49ed8a4a1d9a4a4daa4a6dba4a9dca4acdda3aedea3b0dfa2b3e0a2b5e1a1b7e2a1bae3a0bce4a0bee5a0c0e59fc3e69fc5e79ec7e89ecae99dccea9dceeb9cd1ec9cd3ed9bd5ee9bd8ef9adaf09adcf199dff299e1f398e3f498e6f598e6f599e7f59be8f69ce9f69eeaf69febf7a1ecf7a2edf8a4eef8a5eff8a7f0f9a8f1f9aaf2faabf3faadf4faaef5fbb0f6fbb2f7fcb3f8fcb5f9fcb6fafdb8fbfdb9fcfebbfdfebcfefebefefebdfefdbbfefbb9fefab7fef9b5fef8b3fef7b1fef5affef4adfef3abfef2a9fef1a7feefa5feeea3feeda1feec9ffeea9dfee99bfee899fee797fee695fee493fee391fee28ffee18dfee08bfdde89fddc87fdda86fdd884fdd682fdd481fdd27ffdd07dfdce7cfdcc7afdca78fdc877fdc675fdc473fdc272fdc070fdbe6ffdbc6dfdba6bfdb86afdb668fdb466fdb265fdb063fdae61fcac60fcaa5ffca75efba55cfba25bfb9f5afa9d59fa9a58fa9857f99555f99354f89053f88e52f88b51f7894ff7864ef7834df6814cf67e4bf67c4af57948f57747f57446f47245f46f44f46d43f26b43f16943f06744ef6544ed6345ec6145eb6046ea5e46e95c47e75a47e65848e55648e45549e25349e1514ae04f4adf4d4bde4b4bdc494bdb484cda464cd9444dd8424dd6404ed53e4ed33c4ed13a4ecf384dcd354dcb334cc9304cc62e4bc42c4bc2294ac0274abe2449bc2249ba2048b71d48b51b47b31847b11646af1446ad1145aa0f45a80c44a60a44a40843a20543a003429e0142'.match(/.{6}/g).map(h => [0,2,4].map(i => parseInt(h.slice(i,i+2),16)));
const VIEWS=[{k:'ir',name:'Reference',c:'#FAF9F5'},{k:'gt',name:'Ground truth',c:'var(--gt)'},{k:'baseline',name:'TradSL',c:'var(--tradsl)'},{k:'lingbot',name:'LingBot-Depth',c:'var(--lingbot)'},{k:'nsl',name:'NSL',c:'var(--nsl)'}];
const METHODS=['baseline','nsl','lingbot'],HOLE=[24,36,48],EDGE=[140,185,180];
const src={},cvs={},cache=new Map(),pending=new Map();const mode='on';let scene=SCENES[0],videoIndex=0,videoCamera='ego',imageCamera='ego',data=null,lines={},scale=1,px=0,py=0,lo=200,hi=1000,csrc='gt',seq=0,rangeTimer;
const VIDEOS=CONFIG.videos||[];

function requestInfo(){return {dataset:scene.dataset,id:scene.id+(scene.dataset==='335'?'_'+mode:'')}}
function sceneButtons(){
 $('#dcScene').innerHTML=SCENES.filter(item=>item.dataset===imageCamera).map(item=>`<button class="image-card" data-s="${item.key}" aria-label="${item.name}" aria-pressed="${item.key===scene.key}"><span class="image-thumb"><img src="${item.id+(item.dataset==='335'?'_'+mode:'')}.webp" alt="" loading="lazy"></span><span class="image-name">${item.name.replace(/^(Ego\.|335\.)/,'')}</span></button>`).join('');
 $('#imageCamera').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.camera===imageCamera));
 $('#videoCards').innerHTML=VIDEOS.map((v,i)=>({v,i})).filter(({v})=>v.dataset===videoCamera).map(({v,i})=>`<button class="video-card" data-video="${i}" aria-label="${v.name}" aria-pressed="${i===videoIndex}"><span class="video-thumb"><img src="${v.poster}" alt="" loading="lazy" style="width:${(v.panel_layout?.columns||v.panel_count||3)*100}%;top:${v.header_px===0?0:-8}%;height:${v.panel_layout?.rows===2?200:(v.header_px===0?100:108)}%"><span class="video-duration">${formatTime(v.duration)}</span><span class="thumb-play" aria-hidden="true">▶</span></span><span class="video-name">${v.name.replace(/^(Ego\.|335\.)/,'')}</span></button>`).join('');
 $('#videoCamera').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.camera===videoCamera));
}
function formatTime(seconds){const t=Math.floor(Number.isFinite(seconds)?seconds:0);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
sceneButtons();
$('#dcGrid').innerHTML=VIEWS.map(v=>`<div class="tile w" style="--c:${v.c}"><canvas width="${W}" height="${H}" aria-label="${v.name}"></canvas><span class="tag">${v.name}</span></div>`).join('');
for(const [i,v] of VIEWS.entries()){cvs[v.k]=$('#dcGrid').children[i].querySelector('canvas');src[v.k]=Object.assign(document.createElement('canvas'),{width:W,height:H});}
function clampPan(){if(scale===1)px=py=0;const mx=W*(scale-1)/2,my=H*(scale-1)/2;px=Math.max(-mx,Math.min(mx,px));py=Math.max(-my,Math.min(my,py));}
function blit(){for(const v of VIEWS){const c=cvs[v.k].getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#182430';c.fillRect(0,0,W,H);c.drawImage(src[v.k],W*(1-scale)/2+px,H*(1-scale)/2+py,W*scale,H*scale);}}
function draw(){clampPan();$('#dcStage').classList.toggle('zoomed',scale>1);$('#dcZoom').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',Math.abs(+b.dataset.z-scale)<.05));blit();clearTimeout(rangeTimer);if(data)rangeTimer=setTimeout(()=>{if(computeRange()){paint();showKey();blit();}},140);}
function zoomTo(next,cx=0,cy=0){next=Math.max(1,Math.min(4,next));const r=next/scale;px=cx-(cx-px)*r;py=cy-(cy-py)*r;scale=next;draw();}
for(const tile of $('#dcGrid').children){
 const factor=()=>Math.min(tile.clientWidth/W,tile.clientHeight/H);
 const at=e=>{const b=tile.getBoundingClientRect(),f=factor();return [(e.clientX-b.left-b.width/2)/f,(e.clientY-b.top-b.height/2)/f];};let last=null;
 tile.addEventListener('pointerdown',e=>{if(scale===1&&e.pointerType==='touch')return;last=[e.clientX,e.clientY];tile.setPointerCapture(e.pointerId);});
 tile.addEventListener('pointermove',e=>{if(!last)return;const f=factor();px+=(e.clientX-last[0])/f;py+=(e.clientY-last[1])/f;last=[e.clientX,e.clientY];draw();});
 const end=()=>last=null;tile.addEventListener('pointerup',end);tile.addEventListener('pointercancel',end);
 tile.addEventListener('dblclick',e=>{e.preventDefault();zoomTo(scale>=4?1:scale*2,...at(e));});
 tile.addEventListener('wheel',e=>{if(!e.ctrlKey&&scale===1)return;e.preventDefault();zoomTo(scale*(e.deltaY<0?1.12:1/1.12),...at(e));},{passive:false});
}
function outline(d){const line=new Uint8Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(d[i]>0&&Number.isFinite(d[i]))continue;line[i]=(x>0&&d[i-1]>0)||(x<W-1&&d[i+1]>0)||(y>0&&d[i-W]>0)||(y<H-1&&d[i+W]>0);}return line;}
function computeRange(){const d=data[csrc],values=[];for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const sx=W*(1-scale)/2+px+x*scale,sy=H*(1-scale)/2+py+y*scale,z=d[y*W+x];if(sx>=0&&sx<W&&sy>=0&&sy<H&&z>0&&Number.isFinite(z))values.push(z);}if(!values.length)return false;values.sort((a,b)=>a-b);const a=Math.floor(values[Math.floor(values.length*.02)]),b=Math.max(a+1,Math.ceil(values[Math.floor(values.length*.98)]));if(a===lo&&b===hi)return false;lo=a;hi=b;return true;}
function paint(){for(const k of ['gt',...METHODS]){const d=data[k],line=lines[k],im=new ImageData(W,H),pixels=im.data;for(let i=0;i<N;i++){const z=d[i],rgb=z>0&&Number.isFinite(z)?CMAP[Math.max(0,Math.min(255,Math.floor((z-lo)/(hi-lo)*256)))]:line&&line[i]?EDGE:HOLE;pixels[i*4]=rgb[0];pixels[i*4+1]=rgb[1];pixels[i*4+2]=rgb[2];pixels[i*4+3]=255;}src[k].getContext('2d').putImageData(im,0,0);}}
function showKey(){$('#dcKey').innerHTML=`${lo} mm<i></i>${hi} mm`;}

window.registerDepthScene=async(id,payload)=>{
 const dataset=payload.width===1600?'ego':'335',key=dataset+'/'+id,p=pending.get(key);if(!p)return;
 try{const n=payload.width*payload.height,binary=atob(payload.gzip),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const buffer=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(buffer.byteLength!==payload.keys.length*n*4)throw Error('深度数据不完整');const depth={};payload.keys.forEach((k,i)=>depth[k]=new Float32Array(buffer,i*n*4,n));const image=new Image();await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('灰度图加载失败'));image.src=`${id}.webp`;});p.resolve({depth,image,width:payload.width,height:payload.height});}
 catch(e){cache.delete(key);p.reject(e);}finally{pending.delete(key);p.script.remove();}
};
function fetchScene(info){const key=info.dataset+'/'+info.id;if(cache.has(key))return cache.get(key);const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');pending.set(key,{resolve,reject,script});script.onerror=()=>{pending.delete(key);cache.delete(key);script.remove();reject(Error('深度加载失败'));};script.src=`${info.id}.js?v=with-static-baseline-1`;document.body.append(script);});cache.set(key,promise);if(cache.size>3){const first=cache.keys().next().value;if(first!==key)cache.delete(first);}return promise;}
function loadVideo(){const player=$('#dcVideo');player.pause();
  
  const v=VIDEOS[videoIndex];$('#videoCap').innerHTML=`<b>${v.name}</b>`;
  const panels=v.panel_count||3,rows=v.panel_layout?.rows||1,columns=v.panel_layout?.columns||panels,header=v.header_px??44,baselineName=v.dataset==='ego'?'TradSL':'Raw Depth';
  const labels=panels===4?[['Reference','#FAF9F5'],[baselineName,'var(--tradsl)'],['LingBot-Depth','var(--lingbot)'],['NSL','var(--nsl)']]:[['Reference','#FAF9F5'],['NSL','var(--nsl)'],['LingBot-Depth','var(--lingbot)']];
  $('.video-labels').style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;$('.video-labels').style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;
  $('.video-labels').innerHTML=labels.map(([name,c])=>`<span style="border-left-color:${c}">${name}</span>`).join('');
  const viewport=$('#dcVideoViewport');viewport.style.aspectRatio=v.width+'/'+(v.height-header);viewport.style.setProperty('--video-aspect',v.width/(v.height-header));viewport.querySelectorAll('.video-divider').forEach(x=>x.remove());
  for(let i=1;i<columns;i++){const line=document.createElement('i');line.className='video-divider';line.style.left=(i/columns*100)+'%';viewport.append(line)}
  for(let i=1;i<rows;i++){const line=document.createElement('i');line.className='video-divider horizontal';line.style.top=(i/rows*100)+'%';viewport.append(line)}
  viewport.append($('.video-labels'));
  player.style.marginTop=(-(header/v.width)*100)+'%';player.src=v.src;player.poster=v.poster;$('#videoSeek').value=0;$('#videoTime').textContent='0:00 / '+formatTime(v.duration);player.setAttribute('aria-label',v.name+'：'+labels.map(x=>x[0]).join('、'));player.load();
}
async function load(){
 const token=++seq;clearTimeout(rangeTimer);data=null;$('#dcFrame').hidden=true;
 const baselineName=scene.dataset==='ego'?'TradSL':'Raw Depth';cvs.baseline.setAttribute('aria-label',baselineName);cvs.baseline.parentElement.querySelector('.tag').textContent=baselineName;
 $('#dcVeil').classList.add('on');$('#dcVeil').innerHTML='<div>正在加载深度…</div>';$('#dcCap').innerHTML=`<b>${scene.name}</b>`;

 try{const result=await fetchScene(requestInfo());if(token!==seq)return;W=result.width;H=result.height;N=W*H;$('#dcGrid').style.setProperty('--image-ratio',W+'/'+H);for(const v of VIEWS){cvs[v.k].width=src[v.k].width=W;cvs[v.k].height=src[v.k].height=H;}data=result.depth;lines={};for(const k of METHODS)lines[k]=outline(data[k]);src.ir.getContext('2d').drawImage(result.image,0,0,W,H);scale=1;px=py=0;lo=200;hi=1000;computeRange();paint();showKey();draw();$('#dcVeil').classList.remove('on');}
 catch(e){if(token===seq)$('#dcVeil').innerHTML=`<div>${e.message}</div>`;}
}
function segGroup(el,fn){el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b);});}
segGroup($('#imageCamera'),b=>{imageCamera=b.dataset.camera;scene=SCENES.find(s=>s.dataset===imageCamera);sceneButtons();load()});
segGroup($('#dcScene'),b=>{scene=SCENES.find(s=>s.key===b.dataset.s);load()});


$('#dcZoom').addEventListener('click',e=>{const b=e.target.closest('button');if(b)zoomTo(+b.dataset.z)});
segGroup($('#dcSource'),b=>{csrc=b.dataset.src;if(data&&computeRange()){paint();showKey();blit()}});
segGroup($('#videoCamera'),b=>{videoCamera=b.dataset.camera;videoIndex=VIDEOS.findIndex(v=>v.dataset===videoCamera);sceneButtons();loadVideo()});
$('#videoCards').addEventListener('click',e=>{const b=e.target.closest('[data-video]');if(!b)return;videoIndex=+b.dataset.video;$('#videoCards').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));loadVideo()});
const player=$('#dcVideo'),playButton=$('#videoPlay'),seek=$('#videoSeek');
function playbackState(){const playing=!player.paused;playButton.textContent=playing?'Ⅱ':'▶';playButton.setAttribute('aria-label',playing?'暂停':'播放')}
function playbackTime(){const duration=Number.isFinite(player.duration)?player.duration:VIDEOS[videoIndex].duration;$('#videoTime').textContent=formatTime(player.currentTime)+' / '+formatTime(duration);seek.value=duration?Math.round(player.currentTime/duration*1000):0;seek.style.setProperty('--progress',seek.value/10+'%')}
async function togglePlayback(){try{if(player.paused)await player.play();else player.pause()}catch(e){playButton.setAttribute('aria-label','重新播放')}}
playButton.addEventListener('click',togglePlayback);player.addEventListener('click',togglePlayback);
for(const event of ['play','pause','ended'])player.addEventListener(event,playbackState);
for(const event of ['timeupdate','loadedmetadata','durationchange','emptied'])player.addEventListener(event,playbackTime);
seek.addEventListener('input',()=>{const duration=Number.isFinite(player.duration)?player.duration:VIDEOS[videoIndex].duration;player.currentTime=+seek.value/1000*duration;playbackTime()});
$('#videoFullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#dcVideoStage').requestFullscreen)await $('#dcVideoStage').requestFullscreen();else if(player.webkitEnterFullscreen)player.webkitEnterFullscreen()}catch(e){}});
load();loadVideo();
})();
