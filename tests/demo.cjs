const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','guitar-arpeggio-demo.html'),'utf8');
let now=0, nextTimer=0;
const timers=new Map();
function later(fn,ms){const id=++nextTimer;timers.set(id,{at:now+Math.max(0,ms),fn});return id;}
function advance(ms){const end=now+ms;let limit=10000;while(limit--){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at || a[0]-b[0])[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}assert(limit>0,'timer loop');now=end;}
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.listeners={};this.style={};this.ownerDocument=doc;this.clientWidth=1000;this._value='';this._text='';this.disabled=false;this.hidden=false;this.checked=false;this.dataset={};const names=new Set();this.classList={add:(v)=>names.add(v),remove:(v)=>names.delete(v),contains:(v)=>names.has(v)};}
  get value(){return this._value || (this.tagName==='select'?this.children[0]?.value??'':'');}
  set value(v){this._value=String(v);}
  get options(){return this.children;}
  get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  set textContent(v){this._text=String(v);this.children=[];}
  setAttribute(k,v){this.attrs[k]=String(v);}
  removeAttribute(k){delete this.attrs[k];}
  appendChild(v){this.children.push(v);return v;}
  append(...vs){this.children.push(...vs);}
  replaceChildren(...vs){this.children=vs;this._text='';if(this.tagName==='select')this._value='';}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
  querySelectorAll(selector){let all=[];for(const child of this.children)if(child instanceof Element){all.push(child,...child.querySelectorAll('*'));}if(selector==='*')return all;
    if(selector==='.playing')return all.filter(c=>c.classList.contains('playing'));
    const attrs=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
    if(attrs.length)return all.filter(c=>attrs.every(([,k,v])=>k in c.attrs && (v===undefined || c.attrs[k]===v)));
    return all.filter(c=>c.attrs.class?.split(' ').includes(selector.slice(1)));
  }
  async fire(name,extra={}){for(const f of this.listeners[name]??[])await f({key:'',preventDefault(){},...extra});}
}
let doc;
const ids={};const presets=[];
doc={getElementById:id=>ids[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelectorAll:()=>presets};
for(const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
 const [,tag,attrs,id]=m;const e=ids[id]=new Element(tag);e.hidden=/\bhidden\b/.test(attrs);e.checked=/\bchecked\b/.test(attrs);
 e.value=/\bvalue="([^"]*)"/.exec(attrs)?.[1]??'';
 if(tag==='select'){
  const content=html.slice(m.index+m[0].length).split('</select>')[0];
  for(const opt of content.matchAll(/<option value="([^"]+)"([^>]*)>([^<]*)/g)){const o=new Element('option');o.value=opt[1];o.textContent=opt[3];e.append(o);if(/selected/.test(opt[2]))e.value=o.value;}
 }
}
for(const m of html.matchAll(/data-progression="([^"]+)"/g)){const e=new Element('button');e.dataset.progression=m[1];presets.push(e);}
const starts=[];
class AudioContext {
 constructor(){this.state='running';this.destination={};}
 get currentTime(){return now/1000;}
 async resume(){this.state='running';}
 createGain(){const param={setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}};return {gain:param,connect(){return this;},disconnect(){}};}
 createOscillator(){return {frequency:{value:0},connect(){return this;},disconnect(){},start(at){starts.push(at);},stop(){}};}
}
function Option(text,value){const e=new Element('option');e.value=value;e.textContent=text;return e;}
const context=vm.createContext({document:doc,Option,window:{AudioContext,addEventListener(){}},setTimeout:later,clearTimeout:id=>timers.delete(id),console});
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context);
async function change(id,value){ids[id].value=value;await ids[id].fire('change');}
async function click(id){assert(!ids[id].disabled,id+' disabled');await ids[id].fire('click');}
(async()=>{
 assert.equal(ids['chord-title'].textContent,'Am arpeggio');
 await change('mode','progression');
 assert.equal(ids['progression-error'].textContent,'');
 assert.equal(ids['chord-title'].textContent,'Dm7 arpeggio');
 assert.equal(ids['chord-cards'].children.length,3);
 assert.match(ids['transition-info'].textContent,/common tones: D, F/);
 assert(ids.board.querySelectorAll('.gaj-next-note').length>0);
 assert.equal(ids.tab.textContent.split('\n').length,6);
 await ids['chord-cards'].children[1].fire('click');
 assert.equal(ids['chord-title'].textContent,'G7 arpeggio');
 ids['progression-input'].value='C/E';await ids['progression-input'].fire('input');await click('apply-progression');
 assert.match(ids['progression-error'].textContent,/unsupported/);assert(ids.play.disabled);
 ids['progression-input'].value='Dm7 G7 Cmaj7';await click('apply-progression');
 assert.equal(ids.play.disabled,false);
 ids['range-start'].value='13';ids['range-end'].value='13';await ids['range-end'].fire('change');
 assert.match(ids['progression-error'].textContent,/No 6-string shape/);
 ids['range-start'].value='0';ids['range-end'].value='15';await ids['range-end'].fire('change');
 await change('tempo','120');await change('beats','2');
 ids['loop-progression'].checked=false;await ids['loop-progression'].fire('change');
 await click('play');advance(70);
 assert.equal(ids.play.textContent,'Stop');assert.equal(ids.board.querySelectorAll('.playing').length,1);
 advance(1000);assert.equal(ids['chord-title'].textContent,'G7 arpeggio');
 advance(1000);assert.equal(ids['chord-title'].textContent,'Cmaj7 arpeggio');
 advance(1300);assert.equal(ids.play.textContent,'Play progression');assert.equal(ids.status.textContent,'Progression complete.');
 assert.equal(timers.size,0);
 ids['loop-progression'].checked=true;await ids['loop-progression'].fire('change');
 await click('play');advance(3100);assert.equal(ids['chord-title'].textContent,'Dm7 arpeggio');assert.equal(ids.play.textContent,'Stop');
 await click('play');assert.equal(timers.size,0);assert.equal(ids.board.querySelectorAll('.playing').length,0);
 await click('play');await change('mode','sweep');assert.equal(timers.size,0);assert.equal(ids.play.textContent,'Play shape');
 await change('direction','down');await click('play');advance(60);assert.equal(ids.board.querySelector('.playing').attrs['data-string'],'1');await click('play');
 await change('mode','full');assert.equal(ids.practice.hidden,true);
 for(const preset of presets){await change('mode','progression');await preset.fire('click');assert.equal(ids['progression-error'].textContent,'');}
 console.log('Passed: demo controls, annotated SVG/tab, invalid input recovery, fret limits, chord changes, completion, loop restart, Stop cancellation, and sweep/full-neck regression checks with simulated DOM and audio clock.');
})().catch(e=>{console.error(e);process.exitCode=1;});
