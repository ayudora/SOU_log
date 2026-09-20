'use strict';
const $ = id => document.getElementById(id);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fresh = () => ({id:null,date:today(),title:'',orientation:'landscape',memo:'',photo:null,x:50,y:50});
const profile=()=>LabelCore.profile(state.paper);
const count=()=>LabelCore.count(profile());
let state = {version:2,renderVersion:3,paper:DEFAULT_PAPER,logs:[],slots:Array(LabelCore.count(LabelCore.profile(DEFAULT_PAPER))).fill(null),blocked:Array(LabelCore.count(LabelCore.profile(DEFAULT_PAPER))).fill(false),cal:{x:0,y:0,scale:100},draft:fresh()};
let ready=false;
let db, photo = null, fits = true, selectedSlot = 0, saveTimer, noticeTimer, queue = Promise.resolve(), photoTicket = 0, loadingPhoto = false;
function notify(message){ $('toast').textContent=message; $('toast').hidden=false; clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>$('toast').hidden=true,4500); }
async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('sou-making-notes',1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function readDB(){return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function persist(){clearTimeout(saveTimer); const snapshot=structuredClone(state); queue=queue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{if(!db||!ready){reject(new Error('storage'));return;} const tx=db.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'state');tx.oncomplete=()=>{$('storageStatus').textContent='この端末に保存済み · 写真を外部へ送信しません';resolve(true);};tx.onerror=tx.onabort=()=>reject(tx.error);})).catch(()=>{$('storageStatus').textContent='端末に保存できません。バックアップを保存してください。';return false;});return queue;}
function scheduleSave(){clearTimeout(saveTimer);$('storageStatus').textContent='保存中…';saveTimer=setTimeout(persist,350);}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});}
function wrap(ctx,text,width){const lines=[];for(const para of text.split('\n')){let line='';for(const c of Array.from(para)){if(line && ctx.measureText(line+c).width>width){lines.push(line);line='';}line+=c;}lines.push(line);}return lines;}
function renderSticker(canvas,record,im){return LabelCore.render(canvas,record,im,profile());}
function updatePreview(){const p=profile(),vertical=state.draft.orientation==='portrait';$('previewSize').textContent=`${vertical?p.height:p.width} × ${vertical?p.width:p.height} mm`;$('previewDimension').textContent=`← ${vertical?p.height:p.width} mm →`;$('sticker').classList.toggle('portrait',state.draft.orientation==='portrait');fits=renderSticker($('sticker'),state.draft,photo)&&state.draft.memo.length<=80;$('fitWarning').hidden=fits;$('charCount').textContent=`${state.draft.memo.length} / 80`;$('photoControls').hidden=!photo;const enabled=Boolean(photo||state.draft.memo.trim()||state.draft.title.trim())&&fits&&!loadingPhoto;$('save').disabled=!enabled;$('saveSticker').disabled=!enabled;}
async function syncDraft(){const ticket=++photoTicket;photo=null;loadingPhoto=Boolean(state.draft.photo);$('date').value=state.draft.date;$('logTitle').value=state.draft.title;$('orientation').value=state.draft.orientation;$('memo').value=state.draft.memo;$('cropX').value=state.draft.x;$('cropY').value=state.draft.y;$('editorTitle').textContent=state.draft.id?'記録を編集':'記録';updatePreview();if(state.draft.photo){try{const im=await loadImage(state.draft.photo);if(ticket!==photoTicket)return;photo=im;}catch{notify('写真を読み込めませんでした。選び直してください。');}}loadingPhoto=false;updatePreview();}
function showView(name){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==name);document.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(name==='logs')renderLogs();if(name==='print')renderSheet();window.scrollTo({top:0,behavior:'smooth'});}
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function button(text,fn,cls){const el=element('button',cls,text);el.onclick=fn;return el;}
function updateCounts(){$('logCount').textContent=state.logs.length;}
function addToSheet(id){if(state.logs.find(l=>l.id===id)?.needsReview){notify('旧版のメモが長いため、編集して文字の収まりを確認してください。');return false;}const i=LabelCore.nextSlot(state.slots,state.blocked);if(i<0){notify('空いているラベルがありません。配置または使用済みの指定を見直してください。');return false;}state.slots[i]=id;return true;}
function readOptionalDate(){state.draft.date=$('date').value||'';}
async function commit(toSheet){readOptionalDate();updatePreview();if(!fits||loadingPhoto||(!photo&&!state.draft.memo.trim()&&!state.draft.title.trim()))return;const rec={...state.draft,needsReview:false,id:state.draft.id||crypto.randomUUID(),sticker:$('sticker').toDataURL('image/png'),printSticker:LabelCore.physicalCanvas($('sticker'),state.draft.orientation,()=>element('canvas')).toDataURL('image/png')};const index=state.logs.findIndex(l=>l.id===rec.id);if(index<0)state.logs.unshift(rec);else state.logs[index]=rec;const added=toSheet&&addToSheet(rec.id);state.draft=fresh();await syncDraft();const saved=await persist();updateCounts();if(toSheet)showView('print');else showView('logs');notify(saved?(added?'ログを保存して、シールに追加しました':'ログを保存しました'):'保存できませんでした。ログからバックアップを保存してください。');}
function iconButton(icon,label,action){const b=button('',action,'icon-button');b.title=label;b.setAttribute('aria-label',label);const img=element('img');img.src=`icons/${icon}.svg`;img.alt='';img.setAttribute('aria-hidden','true');b.append(img);return b;}
function renderLogs(){
 const root=$('logList');root.replaceChildren();updateCounts();
 if(!state.logs.length){const box=element('div','empty');box.append(element('h3','','保存したログはありません'),button('＋ 記録する',()=>showView('create'),'primary'));root.append(box);return;}
 for(const rec of state.logs){
  const card=element('article','log-card'),mat=element('div','sticker-mat'),img=element('img'),actions=element('div','log-actions');
  img.src=rec.sticker;img.alt=[rec.date,rec.title,rec.memo].filter(Boolean).join(' / ')||'写真メモ';img.classList.toggle('portrait',rec.orientation==='portrait');mat.append(img);card.append(mat);
  actions.append(iconButton('print','印刷に追加',async()=>{if(addToSheet(rec.id)){await persist();updateCounts();notify('印刷に追加しました');}}),
   iconButton('pencil','編集',async()=>{if((state.draft.memo||state.draft.photo||state.draft.title)&&!confirm('編集中の下書きを置き換えますか？'))return;state.draft={...rec};delete state.draft.sticker;delete state.draft.printSticker;await syncDraft();scheduleSave();showView('create');}),
   iconButton('floppy-disk','画像保存',()=>download(rec.sticker,`PhotoMemo_${rec.date||'undated'}_${rec.id.slice(0,8)}.png`)),
   iconButton('trash-can','削除',async()=>{if(!confirm('このログを削除しますか？印刷の配置からも外れます。'))return;state.logs=state.logs.filter(l=>l.id!==rec.id);state.slots=state.slots.map(id=>id===rec.id?null:id);if(state.draft.id===rec.id){state.draft=fresh();await syncDraft();}await persist();renderLogs();}));
  if(rec.needsReview)card.append(element('p','error','文字が収まりません。編集してから配置してください。'));
  card.append(actions);root.append(card);
 }
}
function geometry(index){return LabelCore.geometry(profile(),state.cal,index);}
function validBounds(){return !['offsetX','offsetY','scale'].some(id=>!$(id).checkValidity()||$(id).value==='')&&LabelCore.inBounds(profile(),state.cal);}
function renderSheet(){
 const root=$('paper');root.replaceChildren();
 for(let i=0;i<count();i++){
  const rec=state.logs.find(l=>l.id===state.slots[i]),g=geometry(i),used=state.blocked[i];
  const b=button('',()=>openSlot(i),'slot');b.classList.toggle('used',used);
  b.style.cssText=`left:${g.left/profile().sheetWidth*100}%;top:${g.top/profile().sheetHeight*100}%;width:${g.width/profile().sheetWidth*100}%;height:${g.height/profile().sheetHeight*100}%`;
  b.setAttribute('aria-label',`${i+1}番のラベル：${used?'使用済み':rec?(rec.title||rec.memo||rec.date):'空き'}`);
  if(rec&&!used){const im=element('img');im.src=rec.printSticker;im.alt='';b.append(im);}else b.append(element('span','',used?'使用済み':'＋'));
  b.append(element('span','number',i+1));root.append(b);
 }
 updateCounts();$('boundsError').hidden=validBounds();$('printButton').disabled=!validBounds()||!LabelCore.printableIndices(state).length;$('testPrint').disabled=!validBounds();
}
function openSlot(i){selectedSlot=i;$('slotTitle').textContent=`${i+1}番のラベル`;$('slotChoices').replaceChildren();$('markUsed').textContent=state.blocked[i]?'未使用に戻す':'使用済みにする';
 if(state.blocked[i])$('slotChoices').append(element('p','hint','使用済みの位置は、自動配置・通常印刷から除外します。'));
 else if(!state.logs.length)$('slotChoices').append(element('p','hint','先に「記録する」からログを保存してください。'));
 else for(const rec of state.logs){const b=button('',async()=>{state.slots[i]=rec.id;$('slotDialog').close();renderSheet();await persist();});const im=element('img');im.src=rec.sticker;im.alt=rec.title||rec.memo||'写真の記録';b.append(im,element('span','',rec.needsReview?'編集して文字を調整':rec.title||rec.date));b.disabled=Boolean(rec.needsReview);$('slotChoices').append(b);}
 $('slotDialog').showModal();
}
let printMode = false;
function preparePrint(test){const root=$('printRoot');root.replaceChildren();if(!validBounds())return;
 const indices=test?Array.from({length:count()},(_,i)=>i):LabelCore.printableIndices(state);
 for(const i of indices){const rec=state.logs.find(l=>l.id===state.slots[i]);if(!test&&(!rec||rec.needsReview))continue;const g=geometry(i),el=element(test?'div':'img',test?'print-cell test-cell':'print-cell');el.style.cssText=`left:${g.left}mm;top:${g.top}mm;width:${g.width}mm;height:${g.height}mm`;if(test)el.textContent=`${i+1} / ${g.width.toFixed(1)} × ${g.height.toFixed(1)} mm`;else{el.src=rec.printSticker;el.alt='';}root.append(el);}
 if(test)root.append(element('div','test-caption',`写真メモログ ${profile().width}×${profile().height}mm / X ${state.cal.x} / Y ${state.cal.y} mm / ${state.cal.scale}%`));
}
async function printSheet(test){if(!validBounds())return;printMode=test;preparePrint(test);await Promise.all([...$('printRoot').querySelectorAll('img')].map(im=>im.decode()));await document.fonts.ready;window.print();}
window.addEventListener('beforeprint',()=>preparePrint(printMode));window.addEventListener('afterprint',()=>{printMode=false;});
function download(url,name){const a=element('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
function exportBackup(){const blob=new Blob([JSON.stringify(state)],{type:'application/json'}),url=URL.createObjectURL(blob);download(url,`PhotoMemo_backup_${today()}.json`);setTimeout(()=>URL.revokeObjectURL(url),10000);}
function validRecord(r,legacy=false){return r&&typeof r.memo==='string'&&r.memo.length<=80&&(legacy||(typeof r.title==='string'&&r.title.length<=24&&['landscape','portrait'].includes(r.orientation)))&&(r.date===''||/^\d{4}-\d{2}-\d{2}$/.test(r.date))&&Number.isFinite(r.x)&&r.x>=0&&r.x<=100&&Number.isFinite(r.y)&&r.y>=0&&r.y<=100&&(r.photo===null||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo));}
function validateState(s){const legacy=s?.version===1;
 if(!s||![1,2].includes(s.version)||!Array.isArray(s.logs)||!Array.isArray(s.slots)||s.slots.length!==(legacy?20:LabelCore.profile(s.paper)?LabelCore.count(LabelCore.profile(s.paper)):0)||!validRecord({...s.draft,date:s.draft?.date||today()},legacy)||!s.cal)throw Error('format');
 if(!legacy&&(!LabelCore.profile(s.paper)||!Array.isArray(s.blocked)||s.blocked.length!==s.slots.length||s.blocked.some(v=>typeof v!=='boolean')))throw Error('paper');
 const ids=new Set();for(const l of s.logs){if(!validRecord(l,legacy)||typeof l.id!=='string'||ids.has(l.id)||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(l.sticker)||(!legacy&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(l.printSticker)))throw Error('record');ids.add(l.id);}
 if(s.slots.some((id,i)=>(id!==null&&!ids.has(id))||(!legacy&&s.blocked[i]&&id!==null)))throw Error('slot');
 if(![s.cal.x,s.cal.y,s.cal.scale].every(Number.isFinite)||Math.abs(s.cal.x)>20||Math.abs(s.cal.y)>20||s.cal.scale<98||s.cal.scale>102)throw Error('calibration');return s;
}
async function migrate(s){validateState(s);if(s.version===2){const next=structuredClone(s);delete next.selected;return next.renderVersion===3?next:await rebuildImages(next);}const next={version:2,renderVersion:3,paper:DEFAULT_PAPER,logs:[],slots:Array(LabelCore.count(LabelCore.profile(DEFAULT_PAPER))).fill(null),blocked:Array(LabelCore.count(LabelCore.profile(DEFAULT_PAPER))).fill(false),cal:{x:0,y:0,scale:100},draft:{...s.draft,title:'',orientation:'landscape'}};
 for(const old of s.logs){const rec={...old,title:'',orientation:'landscape'},canvas=element('canvas'),im=rec.photo?await loadImage(rec.photo):null;rec.needsReview=!LabelCore.render(canvas,rec,im);rec.sticker=canvas.toDataURL('image/png');rec.printSticker=rec.sticker;next.logs.push(rec);}
 return rebuildImages(next);
}
async function preserveLegacy(old,key='legacy-v1'){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(old,key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});}
async function importPhoto(file){if(!file)return;const ticket=++photoTicket;loadingPhoto=true;updatePreview();let url;try{if(file.size>35*1024*1024)throw Error('size');url=URL.createObjectURL(file);const im=await loadImage(url),c=element('canvas');const s=Math.min(1,1600/Math.max(im.width,im.height));c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);const src=c.toDataURL('image/jpeg',.9);const compressed=await loadImage(src);if(ticket!==photoTicket)return;state.draft.photo=src;state.draft.x=50;state.draft.y=50;photo=compressed;$('cropX').value=50;$('cropY').value=50;scheduleSave();}catch{notify('写真を読み込めません。35MB以下のJPEG・PNGなどを選んでください。');}finally{if(url)URL.revokeObjectURL(url);if(ticket===photoTicket){loadingPhoto=false;updatePreview();}}}

async function rebuildImages(next){
 const p=LabelCore.profile(next.paper);
 for(const rec of next.logs){const canvas=element('canvas'),im=rec.photo?await loadImage(rec.photo):null;rec.needsReview=!LabelCore.render(canvas,rec,im,p);rec.sticker=canvas.toDataURL('image/png');rec.printSticker=LabelCore.physicalCanvas(canvas,rec.orientation,()=>element('canvas')).toDataURL('image/png');}
 next.renderVersion=3;return next;
}
function syncPaperUI(){
 const p=profile(),sel=$('paperProfile');sel.replaceChildren();
 for(const candidate of Object.values(PAPER_PROFILES)){const o=element('option','',candidate.name);o.value=candidate.id;sel.append(o);}
 sel.value=state.paper;$('paperNote').textContent=p.note||`${p.width}×${p.height}mm／${count()}面`;
 $('paperDetails').textContent=p.positions?'配置は用紙定義に従います。':`左余白${p.left}mm・上余白${p.top}mm／横の隙間${p.gapX}mm・縦の隙間${p.gapY}mm`;
 $('paper').setAttribute('aria-label',`A4用紙の${count()}面レイアウト`);
 for(const o of $('orientation').options)o.textContent=o.value==='portrait'?`縦向き ${p.height}×${p.width}mm`:`横向き ${p.width}×${p.height}mm`;
}
async function changePaper(id){
 if(id===state.paper)return;if(!LabelCore.profile(id))return;
 if(!confirm('用紙を変更します。ログと下書きは残し、配置・使用済み指定・印刷補正をリセットします。')){syncPaperUI();return;}
 $('app').inert=true;
 try{const next=structuredClone(state),n=LabelCore.count(LabelCore.profile(id));next.paper=id;next.slots=Array(n).fill(null);next.blocked=Array(n).fill(false);next.cal={x:0,y:0,scale:100};await rebuildImages(next);state=next;syncPaperUI();syncCalibration();await syncDraft();renderLogs();renderSheet();await persist();}
 catch{notify('用紙を変更できませんでした。現在の内容は維持しています。');syncPaperUI();}
 finally{$('app').inert=false;}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('paperProfile').onchange=()=>changePaper($('paperProfile').value);
$('date').required=false;
$('date').onchange=()=>{readOptionalDate();updatePreview();scheduleSave();};
$('camera').onclick=()=>$('cameraInput').click();$('choosePhoto').onclick=()=>$('photoInput').click();for(const id of ['cameraInput','photoInput'])$(id).onchange=e=>{importPhoto(e.target.files[0]);e.target.value='';};
for(const [id,key] of [['memo','memo'],['logTitle','title'],['orientation','orientation'],['date','date'],['cropX','x'],['cropY','y']])$(id).oninput=()=>{if(key==='title'&&$(id).value.length>24)$(id).value=$(id).value.slice(0,24);if(key==='memo'&&$(id).value.length>80)$(id).value=$(id).value.slice(0,80);state.draft[key]=(key==='x'||key==='y')?Number($(id).value):$(id).value;updatePreview();scheduleSave();};
$('removePhoto').onclick=()=>{++photoTicket;loadingPhoto=false;state.draft.photo=null;photo=null;updatePreview();scheduleSave();};
$('save').onclick=()=>commit(false);$('saveSticker').onclick=()=>commit(true);$('newLog').onclick=()=>showView('create');$('resetDraft').onclick=async()=>{if((state.draft.photo||state.draft.memo||state.draft.title)&&!confirm('下書きを消して、新しく記録しますか？'))return;state.draft=fresh();await syncDraft();scheduleSave();};
$('closeDialog').onclick=()=>$('slotDialog').close();$('emptySlot').onclick=async()=>{state.slots[selectedSlot]=null;$('slotDialog').close();renderSheet();await persist();};$('clearSheet').onclick=async()=>{if(!confirm('新しい用紙に切り替え、配置と使用済み指定を解除しますか？ログは残ります。'))return;state.slots.fill(null);state.blocked.fill(false);renderSheet();await persist();};
$('markUsed').onclick=async()=>{state.blocked[selectedSlot]=!state.blocked[selectedSlot];if(state.blocked[selectedSlot])state.slots[selectedSlot]=null;$('slotDialog').close();renderSheet();await persist();};
for(const [id,key] of [['offsetX','x'],['offsetY','y'],['scale','scale']])$(id).oninput=()=>{if(!$(id).checkValidity()||$(id).value===''){ $('printButton').disabled=true;$('testPrint').disabled=true;return;}state.cal[key]=Number($(id).value);renderSheet();scheduleSave();};
function syncCalibration(){$('offsetX').value=state.cal.x;$('offsetY').value=state.cal.y;$('scale').value=state.cal.scale;}
$('resetCalibration').onclick=()=>{state.cal={x:0,y:0,scale:100};syncCalibration();renderSheet();scheduleSave();};$('printButton').onclick=()=>printSheet(false).catch(()=>notify('印刷の準備に失敗しました。もう一度お試しください。'));$('testPrint').onclick=()=>printSheet(true).catch(()=>notify('印刷を開始できませんでした。'));$('backup').onclick=exportBackup;$('restore').onclick=()=>$('restoreInput').click();
$('restoreInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>150*1024*1024)throw Error('size');const raw=validateState(JSON.parse(await file.text()));if(!confirm(`${raw.logs.length}件のログを復元します。現在のログ・下書き・配置を置き換えます。${raw.version===1?'旧版の配置は解除し、新用紙向けに変換します。':''}続けますか？`))return;const incoming=await migrate(raw);state=incoming;await syncDraft();syncPaperUI();syncCalibration();const ok=await persist();renderLogs();renderSheet();notify(ok?'バックアップを復元しました':'復元しましたが端末に保存できません。');}catch{notify('このバックアップは読み込めません。写真メモログまたは旧版で保存したJSONを選んでください。');}};
document.addEventListener('visibilitychange',()=>{if(ready&&document.visibilityState==='hidden')persist();});
(async()=>{let migrated=false;try{db=await openDB();const saved=await readDB();if(saved){validateState(saved);if(saved.version===1){await preserveLegacy(saved);migrated=true;}else if(saved.renderVersion!==3){await preserveLegacy(saved,'before-photo-memo-v3');}state=await migrate(saved);}$('storageStatus').textContent='この端末に保存します · 写真を外部へ送信しません';}catch{db=undefined;$('storageStatus').textContent='保存データを開けません。元データは上書きしません。';}ready=true;await syncDraft();syncPaperUI();syncCalibration();renderLogs();renderSheet();$('app').inert=false;if(db)await persist();if(migrated){await persist();$('migrationNotice').hidden=false;}})();
