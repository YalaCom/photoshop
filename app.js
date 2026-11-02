"use strict";
(function(){
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const el={input:$("#fileInput"),canvas:$("#mainCanvas"),wrap:$("#canvasWrap"),viewport:$("#viewport"),empty:$("#empty"),panel:$("#panelContent"),title:$("#panelTitle"),badge:$("#panelBadge"),heading:$("#canvasHeading"),dimensions:$("#dimensions"),zoom:$("#zoomPill"),project:$("#projectTitle"),toast:$("#toast")};
const styles=[
{id:"original",name:"Original",tag:"Чистый"},
{id:"minecraft",name:"Minecraft",tag:"Пиксели"},
{id:"gta",name:"GTA Artwork",tag:"Постер"},
{id:"anime",name:"Anime",tag:"Анимация"},
{id:"cyber",name:"Cyberpunk",tag:"Неон"},
{id:"cinema",name:"Cinematic",tag:"Кино"},
{id:"noir",name:"Noir",tag:"Ч/Б"},
{id:"sunset",name:"Golden Hour",tag:"Тепло"},
{id:"vintage",name:"Vintage",tag:"Плёнка"},
{id:"lavender",name:"Dreamcore",tag:"Пастель"},
{id:"pixelpop",name:"Pixel Pop",tag:"8-bit"},
{id:"comic",name:"Comic Book",tag:"Комикс"},
{id:"neon",name:"Night City",tag:"Огни"},
{id:"sketch",name:"Pencil Art",tag:"Скетч"}];
const params=[
{key:"brightness",label:"Яркость",min:-100,max:100},
{key:"contrast",label:"Контраст",min:-100,max:100},
{key:"saturation",label:"Насыщенность",min:-100,max:100},
{key:"warmth",label:"Температура",min:-100,max:100},
{key:"highlights",label:"Светлые участки",min:-100,max:100},
{key:"shadows",label:"Тени",min:-100,max:100},
{key:"vibrance",label:"Сочность",min:-100,max:100},
{key:"fade",label:"Выцветание",min:0,max:100},
{key:"grain",label:"Зернистость",min:0,max:100},
{key:"vignette",label:"Виньетка",min:0,max:100},
{key:"sharpness",label:"Резкость",min:0,max:100},
{key:"blur",label:"Размытие",min:0,max:30}];
const zeros=()=>Object.fromEntries(params.map(p=>[p.key,0]));
const state={source:null,name:"",style:"original",crop:"free",cropX:.5,cropY:.5,rotate:0,flipX:false,flipY:false,adj:zeros(),strokes:[],texts:[],brush:{color:"#d5ff76",size:12,eraser:false},text:{value:"PIXELFORGE",size:52,color:"#ffffff"},tab:"looks",before:false};
let demo=null,history=[],future=[],pending=false,drag=null,toastTimer=null;
function icon(id){return '<svg class="icon"><use href="#i-'+id+'"></use></svg>';}
function notify(message){el.toast.textContent=message;el.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove("show"),2800);}
function snapshot(){return JSON.stringify({style:state.style,crop:state.crop,cropX:state.cropX,cropY:state.cropY,rotate:state.rotate,flipX:state.flipX,flipY:state.flipY,adj:state.adj,strokes:state.strokes,texts:state.texts});}
function record(){if(!state.source)return;history.push(snapshot());if(history.length>35)history.shift();future.length=0;syncUndo();}
function restore(s){const v=JSON.parse(s);for(const k of ["style","crop","cropX","cropY","rotate","flipX","flipY","adj","strokes","texts"])state[k]=v[k];setTab(state.tab);schedule();syncUndo();}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());}
function syncUndo(){$("#undoTop").disabled=!history.length;$("#redoTop").disabled=!future.length;}
function reset(){if(!state.source)return;record();state.style="original";state.crop="free";state.cropX=.5;state.cropY=.5;state.rotate=0;state.flipX=false;state.flipY=false;state.adj=zeros();state.strokes=[];state.texts=[];setTab(state.tab);schedule();notify("Все изменения сброшены");}
function rotate(deg){if(!state.source)return;record();state.rotate=(state.rotate+deg+360)%360;schedule();}
function flip(axis){if(!state.source)return;record();if(axis==="x")state.flipX=!state.flipX;else state.flipY=!state.flipY;schedule();}
function cropRatio(){return {free:0,square:1,portrait:4/5,story:9/16,landscape:16/9,classic:3/2}[state.crop]||0;}
function geometry(source){const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;const rotated=state.rotate%180!==0,rw=rotated?h:w,rh=rotated?w:h;const ratio=cropRatio();let cw=rw,ch=rh;if(ratio){if(rw/rh>ratio)cw=rh*ratio;else ch=rw/ratio;}return {w,h,rw,rh,cw,ch,offX:(rw-cw)*(state.cropX-.5),offY:(rh-ch)*(state.cropY-.5)};}
function getDims(source,maxEdge){const g=geometry(source);const scale=Math.min(1,maxEdge/Math.max(g.cw,g.ch));return {w:Math.max(1,Math.round(g.cw*scale)),h:Math.max(1,Math.round(g.ch*scale)),g};}
function clamp(v){return v<0?0:v>255?255:v;}
function poster(v,step){return Math.round(v/step)*step;}
function paintBase(canvas,source,maxEdge){const d=getDims(source,maxEdge);canvas.width=d.w;canvas.height=d.h;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.clearRect(0,0,d.w,d.h);const k=d.w/d.g.cw;ctx.save();ctx.translate(d.w/2-d.g.offX*k,d.h/2-d.g.offY*k);ctx.scale(state.flipX?-1:1,state.flipY?-1:1);ctx.rotate(state.rotate*Math.PI/180);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(source,-d.g.w*k/2,-d.g.h*k/2,d.g.w*k,d.g.h*k);ctx.restore();return ctx;}
function pixelate(canvas,type){const ctx=canvas.getContext("2d",{willReadFrequently:true}),w=canvas.width,h=canvas.height,blocks=type==="pixelpop"?Math.min(72,Math.max(22,Math.round(w/15))):Math.min(110,Math.max(32,Math.round(w/17))),bw=blocks,bh=Math.max(1,Math.round(h*bw/w));const tmp=document.createElement("canvas");tmp.width=bw;tmp.height=bh;const t=tmp.getContext("2d");t.imageSmoothingEnabled=true;t.imageSmoothingQuality="high";t.drawImage(canvas,0,0,bw,bh);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);ctx.drawImage(tmp,0,0,w,h);ctx.imageSmoothingEnabled=true;}
function stylePixels(canvas,style,adj){const w=canvas.width,h=canvas.height,ctx=canvas.getContext("2d",{willReadFrequently:true});if(style==="minecraft"||style==="pixelpop")pixelate(canvas,style);
if(adj.blur){const c=document.createElement("canvas");c.width=w;c.height=h;const b=c.getContext("2d");b.drawImage(canvas,0,0);ctx.clearRect(0,0,w,h);ctx.filter="blur("+Math.round(adj.blur*w/900*1.6+0.2)+"px)";ctx.drawImage(c,0,0);ctx.filter="none";}
const img=ctx.getImageData(0,0,w,h),a=img.data;
const needsEdges=["gta","anime","comic","sketch"].includes(style)||adj.sharpness>0;
const old=needsEdges?new Uint8ClampedArray(a):null;
const ctr=1+adj.contrast/100,br=adj.brightness*1.3,sat=1+adj.saturation/100,fade=adj.fade/100,warm=adj.warmth,hi=adj.highlights,sh=adj.shadows,vib=adj.vibrance,grain=adj.grain,vignette=adj.vignette,sharp=adj.sharpness;
for(let y=0;y<h;y++){const dy=(y-h/2)/(h/2);for(let x=0;x<w;x++){const i=(y*w+x)*4;if(a[i+3]===0)continue;let r=a[i],g=a[i+1],b=a[i+2];const origLum=.2126*r+.7152*g+.0722*b;
let s=sat+vib/300*(1-Math.abs(128-origLum)/128);
r=((r-origLum)*s+origLum-128)*ctr+128+br+warm*.45;
g=((g-origLum)*s+origLum-128)*ctr+128+br;
b=((b-origLum)*s+origLum-128)*ctr+128+br-warm*.48;
let lum=.2126*r+.7152*g+.0722*b;
const light=Math.max(0,(lum-128)/127),dark=Math.max(0,(128-lum)/128);
const local=hi*light*.6+sh*dark*.8;r+=local;g+=local;b+=local;
switch(style){
case "minecraft":r=poster(r,34)*.97+6;g=poster(g,32)*1.02;b=poster(b,38)*.93;break;
case "pixelpop":r=poster(r*1.15,55);g=poster(g*1.10,55);b=poster(b*1.18,55);break;
case "gta":r=poster(r*1.12+11,42);g=poster(g*1.02+2,42);b=poster(b*.92+11,42);break;
case "anime":r=poster(r*1.1+14,35);g=poster(g*1.09+9,35);b=poster(b*1.1+15,35);break;
case "cyber":r=r*.9+dark*35+light*37;g=g*.82+light*6;b=b*1.13+dark*58+light*18;break;
case "cinema":r=r*1.06+dark*3;g=g*.96+dark*12;b=b*.9+dark*23;break;
case "noir":{const v=.27*r+.64*g+.09*b;r=g=b=(v-128)*1.26+128;break;}
case "sunset":r=r*1.17+24;g=g*1.03+6;b=b*.79-4;break;
case "vintage":{const rr=r,gg=g,bb=b;r=rr*.53+gg*.47+bb*.16+13;g=rr*.35+gg*.56+bb*.13+10;b=rr*.25+gg*.39+bb*.19+3;break;}
case "lavender":r=r*.95+21;g=g*.89+20;b=b*1.04+31;break;
case "comic":r=poster(r*1.12,47);g=poster(g*1.08,47);b=poster(b*1.1,47);break;
case "neon":r=r*.99+dark*46+light*16;g=g*.92;b=b*1.2+dark*55;break;
case "sketch":{r=g=b=253;break;}
}
if(fade){r=r*(1-fade*.65)+187*fade*.65;g=g*(1-fade*.65)+182*fade*.65;b=b*(1-fade*.65)+174*fade*.65;}
if(vignette){const dx=(x-w/2)/(w/2),rad=Math.max(0,Math.hypot(dx,dy)-.3);const f=Math.max(.1,1-rad*rad*vignette/110);r*=f;g*=f;b*=f;}
if(grain){const noise=(((x*37+y*83)^((x+y)*131))&31)-15;r+=noise*grain/45;g+=noise*grain/45;b+=noise*grain/45;}
if(old&&(style==="gta"||style==="anime"||style==="comic"||style==="sketch")&&x>0&&x<w-1&&y>0&&y<h-1){const j=i-4,k=i-w*4;const gx=Math.abs(old[j]-old[i])+Math.abs(old[j+1]-old[i+1])+Math.abs(old[j+2]-old[i+2]);const gy=Math.abs(old[k]-old[i])+Math.abs(old[k+1]-old[i+1])+Math.abs(old[k+2]-old[i+2]);const edge=gx+gy;
if(style==="sketch"){const shade=clamp(255-edge*.95);r=g=b=shade;}
else if(edge>(style==="anime"?102:style==="comic"?82:94)){const ink=style==="anime"?.28:.23;r=r*ink;g=g*ink;b=b*ink;}}
a[i]=clamp(r);a[i+1]=clamp(g);a[i+2]=clamp(b);
}}
if(sharp>0&&old){const copy=new Uint8ClampedArray(a),strength=sharp/240;for(let y=1;y<h-1;y++){for(let x=1;x<w-1;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){const v=copy[i+c];a[i+c]=clamp(v+strength*(v*4-copy[i-4+c]-copy[i+4+c]-copy[i-w*4+c]-copy[i+w*4+c]));}}}}
ctx.putImageData(img,0,0);
if(style==="comic"){ctx.save();ctx.fillStyle="#20172c";ctx.globalAlpha=.1;const step=Math.max(8,Math.round(w/90));for(let y=step;y<h;y+=step)for(let x=step;x<w;x+=step){ctx.beginPath();ctx.arc(x,y,Math.max(1,step*.14),0,Math.PI*2);ctx.fill();}ctx.restore();}
if(style==="neon"){const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#c7207726");grad.addColorStop(.5,"#00000000");grad.addColorStop(1,"#12bcd826");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);}
}
function paintOverlays(canvas){const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;if(state.strokes.length){const overlay=document.createElement("canvas");overlay.width=w;overlay.height=h;const c=overlay.getContext("2d");for(const line of state.strokes){c.save();c.globalCompositeOperation=line.eraser?"destination-out":"source-over";c.strokeStyle=line.color;c.fillStyle=line.color;c.lineWidth=Math.max(1,line.size*w/900);c.lineCap="round";c.lineJoin="round";const pts=line.pts;if(pts.length){c.beginPath();c.moveTo(pts[0][0]*w,pts[0][1]*h);if(pts.length===1){c.arc(pts[0][0]*w,pts[0][1]*h,c.lineWidth/2,0,Math.PI*2);c.fill();}else{for(let j=1;j<pts.length;j++)c.lineTo(pts[j][0]*w,pts[j][1]*h);c.stroke();}}c.restore();}ctx.drawImage(overlay,0,0);}
for(const t of state.texts){ctx.save();const size=Math.max(10,t.size*w/900);ctx.font="900 "+size+"px Inter,Arial,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=Math.max(2,size*.09);ctx.strokeStyle="#0000009c";ctx.strokeText(t.value,t.x*w,t.y*h,w*.94);ctx.fillStyle=t.color;ctx.fillText(t.value,t.x*w,t.y*h,w*.94);ctx.restore();}}
function renderInto(canvas,maxEdge,styleOverride,includeOverlays,sourceOverride){const src=sourceOverride||state.source;if(!src)return;const ctx=paintBase(canvas,src,maxEdge);const style=styleOverride||state.style;const adj=styleOverride?zeros():state.adj;if(style!=="original"||Object.values(adj).some(Boolean))stylePixels(canvas,style,adj);if(includeOverlays)paintOverlays(canvas);return ctx;}
function fitCanvas(){if(!state.source)return;const pad=22;const w=Math.max(10,el.viewport.clientWidth-pad),h=Math.max(10,el.viewport.clientHeight-pad);const ratio=el.canvas.width/el.canvas.height;let width=Math.min(w,h*ratio);let height=width/ratio;el.canvas.style.width=width+"px";el.canvas.style.height=height+"px";el.wrap.style.width=width+"px";el.wrap.style.height=height+"px";el.zoom.textContent=Math.round(width/el.canvas.width*100)+"%";}
function schedule(){if(!state.source||pending)return;pending=true;requestAnimationFrame(()=>{pending=false;if(!state.source)return;renderInto(el.canvas,1250,state.before?"original":null,!state.before);fitCanvas();el.wrap.classList.toggle("before",state.before);el.wrap.classList.toggle("drawing",state.tab==="draw");el.heading.textContent=styles.find(s=>s.id===state.style).name;});}
function thumbRender(){const src=state.source||demo;if(!src)return;$$(".stylethumb canvas").forEach(canvas=>renderInto(canvas,170,canvas.dataset.style,false,src));}
function setTab(tab){state.tab=tab;$$("[data-tab]").forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on?"true":"false");});const titles={looks:"Креативные стили",adjust:"Свет и цвет",crop:"Кадрирование",draw:"Рисование",text:"Текст и надписи",export:"Экспорт фото"};el.title.textContent=titles[tab];el.badge.textContent={looks:"14 LOOKS",adjust:"12 TOOLS",crop:"5 FORMATS",draw:"BRUSH",text:"TYPE",export:"HD / 4K"}[tab];const maker={looks:looksPanel,adjust:adjustPanel,crop:cropPanel,draw:drawPanel,text:textPanel,export:exportPanel}[tab];el.panel.innerHTML=maker();wirePanel(tab);if(tab==="looks")requestAnimationFrame(thumbRender);schedule();}
function looksPanel(){return '<div class="panelsec"><b>Выбери атмосферу</b><span>14 пресетов</span></div><p class="sectionnote">Эффекты работают на твоём устройстве. GTA — иллюстративный постер, Minecraft — блочная пиксельная графика.</p><div class="stylegrid">'+styles.map(s=>'<button class="stylecard '+(state.style===s.id?"selected":"")+'" data-style="'+s.id+'" aria-pressed="'+(state.style===s.id)+'"><span class="stylethumb"><canvas data-style="'+s.id+'" aria-hidden="true"></canvas></span><span class="stylecaption"><strong>'+s.name+'</strong><em>'+s.tag+'</em></span></button>').join("")+'</div>';}
function adjustPanel(){return '<p class="sectionnote">Точная настройка света, цвета и текстуры. Передвигай ползунки и сразу смотри результат.</p><div class="row between" style="margin-bottom:19px"><b>Ручная коррекция</b><button class="subtlebtn" id="resetSliders">Сбросить ползунки</button></div>'+params.map(p=>'<div class="control"><div class="controlhead"><label for="adj-'+p.key+'">'+p.label+'</label><output id="out-'+p.key+'">'+state.adj[p.key]+'</output></div><input class="range" type="range" id="adj-'+p.key+'" min="'+p.min+'" max="'+p.max+'" value="'+state.adj[p.key]+'" data-adjust="'+p.key+'"></div>').join("");}
function cropPanel(){const ratios=[["free","Оригинал"],["square","1:1"],["portrait","4:5"],["story","9:16"],["landscape","16:9"],["classic","3:2"]];return '<p class="sectionnote">Выбери соотношение сторон и сдвинь фотографию пальцем в кадре. Исходное изображение сохранится.</p><div class="panelsec"><b>Формат кадра</b></div><div class="chiprow">'+ratios.map(r=>'<button class="chip '+(state.crop===r[0]?"active":"")+'" data-crop="'+r[0]+'">'+r[1]+'</button>').join("")+'</div><div class="sectiondivider"></div><div class="panelsec"><b>Поворот и отражение</b></div><div class="row"><button class="mini-action" data-action="rotate">'+icon("rotate")+' Повернуть 90°</button><button class="mini-action" data-action="flip">'+icon("flip")+' Отразить</button></div><p class="sectionnote" style="margin-top:17px">Кадрирование и поворот можно отменить кнопкой ↶ вверху.</p>';}
function drawPanel(){return '<p class="sectionnote">Рисуй прямо пальцем по фото. Ластик удаляет нарисованные штрихи, не затрагивая исходное изображение.</p><div class="segment" style="margin-bottom:21px"><button data-mode="brush" class="'+(!state.brush.eraser?"active":"")+'">✎ Кисть</button><button data-mode="eraser" class="'+(state.brush.eraser?"active":"")+'">⌫ Ластик</button></div><div class="control"><div class="controlhead"><label for="brushSize">Размер кисти</label><output id="brushVal">'+state.brush.size+' px</output></div><input id="brushSize" class="range" type="range" min="2" max="90" value="'+state.brush.size+'"></div><div class="row between" style="margin-bottom:21px"><b>Цвет</b><input aria-label="Цвет кисти" class="colorinput" type="color" id="brushColor" value="'+state.brush.color+'"></div><button class="secondary full" id="removeStrokes">Очистить рисунок</button>';}
function textPanel(){return '<p class="sectionnote">Добавляй надписи поверх фотографии. Для перемещения выбери инструмент «Текст» и перетащи надпись пальцем.</p><div class="itemcard"><label class="tiny" for="textValue">Твоя надпись</label><input id="textValue" class="field" style="margin:10px 0 15px" maxlength="90" value="'+escapeAttr(state.text.value)+'" placeholder="Введи текст"><div class="control"><div class="controlhead"><label for="textSize">Размер</label><output id="textVal">'+state.text.size+'</output></div><input id="textSize" class="range" type="range" min="18" max="150" value="'+state.text.size+'"></div><div class="row between" style="margin-bottom:16px"><b>Цвет текста</b><input id="textColor" class="colorinput" aria-label="Цвет текста" type="color" value="'+state.text.color+'"></div><button class="primary full" id="addText">+ Добавить текст на фото</button></div><button class="secondary full" id="removeText">Удалить последнюю надпись</button>';}
function escapeAttr(v){return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");}
function exportPanel(){return '<div class="itemcard"><div class="row between"><b>Финальный результат</b><span class="badge">READY</span></div><p>Сохраняй в высоком качестве. Никаких водяных знаков и передачи фотографий на сервер.</p></div><div class="exportoption"><b>Формат</b><select id="format"><option value="image/png">PNG · без потерь</option><option value="image/jpeg">JPG · компактный</option><option value="image/webp">WEBP · современный</option></select></div><div class="exportoption"><b>Разрешение</b><select id="resolution"><option value="2048">До 2K</option><option value="4096" selected>До 4K</option><option value="1024">До 1K</option></select></div><div class="exportoption"><b>Качество JPG/WEBP</b><span>95%</span></div><button id="exportPanelButton" class="primary full" style="margin:18px 0">'+icon("download")+' Скачать обработанное фото</button><div class="tip">🔒 Изображение остаётся на устройстве. Редактирование и экспорт работают без регистрации. Максимальный размер зависит от памяти браузера.</div>';}
function wirePanel(tab){
if(tab==="looks")$$("[data-style]",el.panel).forEach(b=>b.addEventListener("click",()=>{if(state.style===b.dataset.style)return;if(!state.source){startDemo();}record();state.style=b.dataset.style;setTab("looks");schedule();}));
if(tab==="adjust"){ $$("[data-adjust]",el.panel).forEach(r=>{let started=false;const start=()=>{if(!started){record();started=true;}};r.addEventListener("pointerdown",start);r.addEventListener("keydown",start);r.addEventListener("input",()=>{if(!started)start();state.adj[r.dataset.adjust]=Number(r.value);$("#out-"+r.dataset.adjust).textContent=r.value;schedule();});r.addEventListener("change",()=>started=false);});$("#resetSliders").onclick=()=>{record();state.adj=zeros();setTab("adjust");schedule();};}
if(tab==="crop"){$$("[data-crop]",el.panel).forEach(b=>b.onclick=()=>{if(!state.source)startDemo();record();state.crop=b.dataset.crop;state.cropX=.5;state.cropY=.5;setTab("crop");schedule();});$('[data-action="rotate"]',el.panel).onclick=()=>rotate(90);$('[data-action="flip"]',el.panel).onclick=()=>flip("x");}
if(tab==="draw"){$$("[data-mode]",el.panel).forEach(b=>b.onclick=()=>{state.brush.eraser=b.dataset.mode==="eraser";setTab("draw");});$("#brushSize").oninput=e=>{state.brush.size=Number(e.target.value);$("#brushVal").textContent=e.target.value+" px";};$("#brushColor").oninput=e=>state.brush.color=e.target.value;$("#removeStrokes").onclick=()=>{if(!state.strokes.length)return;record();state.strokes=[];schedule();};}
if(tab==="text"){$("#textValue").oninput=e=>state.text.value=e.target.value;$("#textSize").oninput=e=>{state.text.size=Number(e.target.value);$("#textVal").textContent=e.target.value;};$("#textColor").oninput=e=>state.text.color=e.target.value;$("#addText").onclick=()=>{if(!state.source)startDemo();if(!state.text.value.trim()){notify("Введи текст надписи");return;}record();state.texts.push({value:state.text.value.trim(),size:state.text.size,color:state.text.color,x:.5,y:.5});schedule();notify("Надпись добавлена — перетащи её пальцем");};$("#removeText").onclick=()=>{if(!state.texts.length)return;record();state.texts.pop();schedule();};}
if(tab==="export"){$("#exportPanelButton").onclick=()=>download();}}
function makeDemo(){const c=document.createElement("canvas");c.width=1200;c.height=830;const x=c.getContext("2d");let g=x.createLinearGradient(0,0,0,830);g.addColorStop(0,"#1e2a54");g.addColorStop(.48,"#bb567a");g.addColorStop(1,"#e3aa66");x.fillStyle=g;x.fillRect(0,0,1200,830);
x.fillStyle="#ffbb83";x.beginPath();x.arc(836,246,123,0,Math.PI*2);x.fill();
x.fillStyle="#312d52";for(let i=0;i<30;i++){const px=i*48-12,height=75+(i*67%185);x.fillRect(px,475-height,46,height);for(let k=0;k<4;k++){x.fillStyle=k%2?"#f4ac8688":"#dd729b70";x.fillRect(px+8+(k%2)*14,475-height+25+Math.floor(k/2)*30,6,8);x.fillStyle="#312d52";}}
x.fillStyle="#22243c";x.beginPath();x.moveTo(0,490);x.lineTo(250,410);x.lineTo(425,490);x.lineTo(740,430);x.lineTo(970,500);x.lineTo(1200,450);x.lineTo(1200,830);x.lineTo(0,830);x.fill();
g=x.createLinearGradient(0,460,0,830);g.addColorStop(0,"#35324f");g.addColorStop(1,"#151c2e");x.fillStyle=g;x.fillRect(0,520,1200,310);
x.strokeStyle="#b56f7c";x.lineWidth=6;for(let i=0;i<8;i++){x.beginPath();x.moveTo(600,560);x.lineTo(i*220-300,830);x.stroke();}
x.fillStyle="#181d30";x.beginPath();x.moveTo(171,606);x.lineTo(270,525);x.lineTo(707,513);x.lineTo(820,596);x.lineTo(896,615);x.lineTo(912,695);x.lineTo(126,695);x.lineTo(133,624);x.closePath();x.fill();
x.fillStyle="#f2a4a0";x.beginPath();x.moveTo(305,531);x.lineTo(686,528);x.lineTo(772,594);x.lineTo(210,594);x.closePath();x.fill();
x.fillStyle="#252c48";x.beginPath();x.moveTo(326,541);x.lineTo(498,540);x.lineTo(493,580);x.lineTo(267,581);x.closePath();x.fill();x.beginPath();x.moveTo(518,540);x.lineTo(679,539);x.lineTo(736,584);x.lineTo(519,581);x.fill();
x.fillStyle="#2f314b";x.fillRect(145,599,744,66);x.fillStyle="#fdbe9b";x.fillRect(147,615,742,21);x.fillStyle="#20253c";x.fillRect(151,641,725,34);
x.fillStyle="#c5dafe";x.fillRect(156,624,81,21);x.fillRect(798,624,71,21);
x.fillStyle="#141825";for(const px of [275,728]){x.beginPath();x.arc(px,680,71,0,Math.PI*2);x.fill();x.fillStyle="#696d7f";x.beginPath();x.arc(px,680,39,0,Math.PI*2);x.fill();x.fillStyle="#1e253b";x.beginPath();x.arc(px,680,26,0,Math.PI*2);x.fill();}
x.fillStyle="#f6daa6";x.font="900 45px system-ui";x.fillText("NIGHT DRIVE",80,130);x.fillStyle="#efd4c4";x.font="500 19px system-ui";x.fillText("A CREATIVE PHOTO STORY",83,167);
return c;}
function startDemo(){loadSource(demo,"Neon-drive-demo.png",true);}
function loadSource(src,name,isDemo){state.source=src;state.name=name;state.style="original";state.crop="free";state.cropX=.5;state.cropY=.5;state.rotate=0;state.flipX=false;state.flipY=false;state.adj=zeros();state.strokes=[];state.texts=[];history=[];future=[];syncUndo();el.empty.classList.add("hidden");el.wrap.classList.add("open");el.project.textContent=name;const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;el.dimensions.textContent=w+" × "+h;el.heading.textContent="Original";setTab(state.tab);schedule();if(!isDemo)notify("Фото загружено — можно редактировать");}
async function fromFile(file){if(!file)return;if(!file.type.startsWith("image/")){notify("Нужна картинка JPG, PNG, WEBP или HEIC");return;}if(file.size>55*1024*1024){notify("Файл больше 55 МБ — попробуй уменьшить");return;}const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();loadSource(img,file.name,false);}catch(e){notify("Не удалось открыть фото. Попробуй JPG или PNG.");}finally{setTimeout(()=>URL.revokeObjectURL(url),4000);}}
function coords(e){const r=el.canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
function pointerDown(e){if(!state.source||state.before)return;if(state.tab!=="draw"&&state.tab!=="text"&&state.tab!=="crop")return;e.preventDefault();const p=coords(e);if(state.tab==="crop"&&state.crop!=="free"){record();drag={kind:"crop",prevX:e.clientX,prevY:e.clientY};}else if(state.tab==="draw"){record();const line={pts:[p],color:state.brush.color,size:state.brush.size,eraser:state.brush.eraser};state.strokes.push(line);drag={kind:"draw",line};}else if(state.texts.length){record();const item=state.texts[state.texts.length-1];item.x=p[0];item.y=p[1];drag={kind:"text",item};}if(drag)el.canvas.setPointerCapture(e.pointerId);schedule();}
function pointerMove(e){if(!drag)return;e.preventDefault();const p=coords(e);if(drag.kind==="draw")drag.line.pts.push(p);else if(drag.kind==="text"){drag.item.x=p[0];drag.item.y=p[1];}else if(drag.kind==="crop"){const g=geometry(state.source),r=el.canvas.getBoundingClientRect();if(g.rw>g.cw)state.cropX=Math.max(0,Math.min(1,state.cropX-(e.clientX-drag.prevX)/r.width*g.cw/(g.rw-g.cw)));if(g.rh>g.ch)state.cropY=Math.max(0,Math.min(1,state.cropY-(e.clientY-drag.prevY)/r.height*g.ch/(g.rh-g.ch)));drag.prevX=e.clientX;drag.prevY=e.clientY;}schedule();}
function pointerUp(){drag=null;}
async function download(){if(!state.source){notify("Сначала открой фотографию");return;}let format=$("#format")?.value||"image/png",maxEdge=Number($("#resolution")?.value||4096),name=state.name.replace(/\.[^.]*$/,"")||"picture";const c=document.createElement("canvas");try{renderInto(c,maxEdge,null,true);if(format==="image/jpeg"){const opaque=document.createElement("canvas");opaque.width=c.width;opaque.height=c.height;const ctx=opaque.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(c,0,0);c.width=0;c.height=0;const blob=await new Promise(res=>opaque.toBlob(res,format,.95));if(!blob)throw Error("Canvas export failed");saveBlob(blob,name+"-pixelforge.jpg");}else{const blob=await new Promise(res=>c.toBlob(res,format,.95));if(!blob)throw Error("Canvas export failed");saveBlob(blob,name+"-pixelforge."+(format==="image/png"?"png":"webp"));}notify("Файл готов — сохранение началось");}catch(e){console.error(e);notify("Не удалось экспортировать. Выбери 2K или меньший размер.");}finally{c.width=0;c.height=0;}}
function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function wire(){syncUndo();$$("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));$("#importMain").onclick=()=>el.input.click();$("#openAnother").onclick=()=>el.input.click();$("#tryDemo").onclick=startDemo;el.input.onchange=e=>{fromFile(e.target.files[0]);e.target.value="";};$("#undoTop").onclick=undo;$("#redoTop").onclick=redo;$("#reset").onclick=reset;$("#exportTop").onclick=()=>{if(state.source)download();else notify("Сначала открой фотографию");};
const compare=$("#compare");const down=e=>{if(!state.source)return;e.preventDefault();state.before=true;schedule();};const up=()=>{if(state.before){state.before=false;schedule();}};compare.addEventListener("pointerdown",down);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);compare.addEventListener("contextmenu",e=>e.preventDefault());el.canvas.addEventListener("pointerdown",pointerDown);el.canvas.addEventListener("pointermove",pointerMove);el.canvas.addEventListener("pointerup",pointerUp);el.canvas.addEventListener("pointercancel",pointerUp);
document.addEventListener("keydown",e=>{if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}});
el.viewport.addEventListener("dragover",e=>e.preventDefault());el.viewport.addEventListener("drop",e=>{e.preventDefault();fromFile(e.dataTransfer.files[0]);});new ResizeObserver(()=>fitCanvas()).observe(el.viewport);
window.addEventListener("paste",e=>{if(e.clipboardData?.files?.length)fromFile(e.clipboardData.files[0]);});
}
demo=makeDemo();wire();setTab("looks");if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();