'use strict';
const player=document.querySelector('#dcVideo');
const stage=document.querySelector('#dcVideoStage');
const play=document.querySelector('#videoPlay');
const seek=document.querySelector('#videoSeek');
const cards=document.querySelector('#videoCards');
const fullscreen=document.querySelector('#videoFullscreen');
const retry=document.querySelector('#videoRetry');
let videos=[],index=0,revision=0;
const time=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function playing(){play.setAttribute('aria-pressed',String(!player.paused));play.setAttribute('aria-label',player.paused?'播放':'暂停')}
function progress(){const duration=Number.isFinite(player.duration)?player.duration:(videos[index]?.duration||0);const fraction=duration?player.currentTime/duration:0;seek.value=Math.round(fraction*1000);seek.style.setProperty('--progress',`${fraction*100}%`);seek.setAttribute('aria-valuetext',`${time(player.currentTime)} / ${time(duration)}`)}
async function toggle(){if(player.paused){try{await player.play()}catch{playing()}}else player.pause()}
function load(next,resume=false){const token=++revision;player.pause();index=next;retry.hidden=true;stage.classList.remove('buffering');player.src=videos[index].src;player.poster=videos[index].poster;player.load();seek.value=0;seek.style.setProperty('--progress','0%');cards.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));if(resume)player.addEventListener('loadedmetadata',()=>{if(token===revision)player.play().catch(()=>playing())},{once:true});progress()}
play.addEventListener('click',toggle);player.addEventListener('click',toggle);
player.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();toggle()}else if(['ArrowLeft','ArrowRight'].includes(event.key)&&Number.isFinite(player.duration)){event.preventDefault();player.currentTime=Math.max(0,Math.min(player.duration,player.currentTime+(event.key==='ArrowRight'?5:-5)))}});
for(const event of ['play','pause','ended'])player.addEventListener(event,playing);
for(const event of ['loadedmetadata','durationchange','timeupdate','seeked'])player.addEventListener(event,progress);
for(const event of ['waiting','seeking'])player.addEventListener(event,()=>{if(!player.paused)stage.classList.add('buffering')});
for(const event of ['playing','canplay','seeked','pause','error'])player.addEventListener(event,()=>stage.classList.remove('buffering'));
player.addEventListener('error',()=>{retry.hidden=false});retry.addEventListener('click',()=>load(index,true));
seek.addEventListener('input',()=>{if(Number.isFinite(player.duration)){player.currentTime=+seek.value/1000*player.duration;progress()}});
function expanded(){return !!document.fullscreenElement||stage.classList.contains('is-expanded')}
function expansionLabel(){fullscreen.setAttribute('aria-label',expanded()?'退出全屏':'全屏')}
function expandFallback(value){stage.classList.toggle('is-expanded',value);document.body.classList.toggle('video-expanded',value);expansionLabel()}
fullscreen.addEventListener('click',async()=>{if(document.fullscreenElement){await document.exitFullscreen();return}if(stage.classList.contains('is-expanded')){expandFallback(false);return}try{if(!stage.requestFullscreen)throw Error('fullscreen');await stage.requestFullscreen();if(!document.fullscreenElement)expandFallback(true)}catch{expandFallback(true)}expansionLabel()});
document.addEventListener('fullscreenchange',expansionLabel);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&stage.classList.contains('is-expanded'))expandFallback(false)});
cards.addEventListener('click',event=>{const button=event.target.closest('[data-video]');if(!button)return;const next=+button.dataset.video;if(next===index){toggle();return}load(next,!player.paused)});
fetch('videos.json').then(response=>{if(!response.ok)throw Error('playlist');return response.json()}).then(data=>{videos=data;cards.replaceChildren(...videos.map((video,i)=>{const button=document.createElement('button');button.className='video-card';button.dataset.video=i;button.setAttribute('aria-label',`视频 ${i+1}`);button.setAttribute('aria-pressed',String(i===0));const thumb=document.createElement('span');thumb.className='video-thumb';const image=new Image();image.src=video.thumb;image.alt='';image.loading='lazy';const icon=document.createElement('span');icon.className='thumb-play';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><path d="m7 4 13 8-13 8Z"/></svg>';thumb.append(image,icon);button.append(thumb);return button}));load(0)}).catch(()=>{retry.hidden=false;retry.onclick=()=>location.reload()});
