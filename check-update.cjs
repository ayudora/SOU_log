const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {LabelCore:C,PAPER_PROFILES,DEFAULT_PAPER}=require('./label-core.js');
const base={id:'r',date:'',title:'',memo:'本文',orientation:'landscape',photo:null,x:50,y:50,sticker:'data:image/png;base64,AAAA',printSticker:'data:image/png;base64,AAAA'};
function canvas(){const text=[],draw=[];let font='3px sans-serif';const ctx={scale(){},fillRect(){},drawImage(...v){draw.push(v)},fillText(...v){text.push(v)},rotate(){},translate(){},measureText:s=>({width:Array.from(s).length*parseFloat(font.replace('bold ',''))}),set font(v){font=v},get font(){return font}};return {text,draw,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,AAAA'};}
for(const orientation of ['landscape','portrait'])for(const image of [null,{width:1200,height:1600}])for(const date of ['','2026-09-20'])for(const title of ['','題名']){
 const c=canvas();assert.ok(C.render(c,{...base,orientation,date,title},image));
 let expected=orientation==='portrait'&&image?3+49/1.5+3:3.5;
 if(date){assert.equal(c.text[0][2],expected);expected+=5.5;}
 if(title){assert.equal(c.text[date?1:0][2],expected);expected+=6.4;}
 assert.equal(c.text.at(-1)[0],'本文');assert.equal(c.text.at(-1)[2],expected);
 if(image&&orientation==='landscape'){assert.equal(c.draw[0][7],36.75);assert.equal(c.draw[0][8],49);}
}
const custom={id:'test',name:'テスト',sheetWidth:210,sheetHeight:297,width:50,height:50,columns:4,rows:5,left:5,top:23.5,gapX:0,gapY:0};
assert.equal(C.count(custom),20);assert.deepEqual(C.geometry(custom,{x:0,y:0,scale:100},19),{left:155,top:223.5,width:50,height:50});
const irregular={...custom,positions:[{left:20,top:30},{left:140,top:200},{left:220,top:20}]};
assert.equal(C.count(irregular),3);assert.equal(C.inBounds(irregular,{x:0,y:0,scale:100}),false);
function node(){return {...canvas(),value:'0',style:{},children:[],checkValidity:()=>true,append(...v){this.children.push(...v)},replaceChildren(){this.children=[]}}}
const nodes=new Map(),context=vm.createContext({console,Date,Set,Promise,structuredClone,clearTimeout,setTimeout,window:{addEventListener(){}},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:()=>node()}});
const core=fs.readFileSync(__dirname+'/label-core.js','utf8').replace('"a4-business-10": Object.freeze({',`"test":Object.freeze(${JSON.stringify(custom)}),\n"a4-business-10": Object.freeze({`);
vm.runInContext(core,context);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8').split("document.querySelectorAll('[data-view]').forEach(b=>")[0],context);
const run=s=>vm.runInContext(s,context);context.fixture=base;
assert.equal(run('validRecord(fixture)'),true);
assert.equal(run("validateState({...state,logs:[fixture],paper:'test',slots:Array(20).fill(null),selected:Array(20).fill(true),blocked:Array(20).fill(false)}).slots.length"),20);
assert.throws(()=>run("validateState({...state,paper:'missing'})"));
(async()=>{const migrated=await run('migrate({...state,renderVersion:undefined,logs:[fixture]})');assert.equal(migrated.renderVersion,3);assert.equal(migrated.logs[0].date,'');assert.equal(migrated.logs[0].memo,'本文');assert.equal(migrated.slots.length,10);
 // Isolate the real profile-change transaction from rendering and persistence.
 context.confirm=()=>true;run('syncPaperUI=()=>{};syncCalibration=()=>{};syncDraft=async()=>{};renderLogs=()=>{};renderSheet=()=>{};persist=async()=>true;state.logs=[fixture];state.slots[0]=fixture.id;state.blocked[1]=true;state.cal.x=2;');
 await run("changePaper('test')");assert.equal(run('state.slots.length'),20);assert.equal(run('state.logs[0].memo'),'本文');assert.equal(run('state.logs[0].date'),'');assert.equal(run('state.slots.every(v=>v===null)'),true);assert.equal(run('state.blocked.some(Boolean)'),false);assert.equal(run('state.cal.x'),0);
 context.confirm=()=>false;await run("changePaper('a4-business-10')");assert.equal(run('state.paper'),'test');
 context.crypto={randomUUID:()=> 'blank-date-regression'};
 run("updatePreview=()=>{};updateCounts=()=>{};showView=()=>{};notify=()=>{};state.draft={...fixture,id:null,date:'2026-09-20'};document.getElementById('date').value='';document.getElementById('date').checkValidity=()=>false;");
 await run('commit(false)');assert.equal(run("state.logs.find(l=>l.id==='blank-date-regression').date"),'');
 const normalized=await run("migrate({...state,selected:Array(state.slots.length).fill(false)})");assert.equal('selected' in normalized,false);
 assert.deepEqual(C.printableIndices({slots:['r','r',null],blocked:[false,false,false],selected:[false,false,false],logs:[base]}),[0,1]);
 console.log('PASS: layout, profiles, blank-date commit even with native invalid state, old selection discarded, all placed labels printed.');})().catch(e=>{console.error(e);process.exitCode=1});
