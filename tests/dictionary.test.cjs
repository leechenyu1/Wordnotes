const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('dist/dictionary-core.js','utf8'),context);
const {parseCSV,lookup}=context.DictionaryCore;
function data(csv){const parsed=parseCSV(csv);return{entries:new Map(parsed.entries),aliases:new Map(parsed.aliases)}}
test('reads BOM, quoted commas, doubled quotes, literal and real newlines',()=>{
  const d=data('\uFEFFword,translation,exchange\r\ncream,"n. 奶油, 乳脂\\nv. 加奶油",\r\nquote,"n. ""引号""\nvt. 引用",');
  assert.equal(lookup(d,' CREAM '),'n. 奶油, 乳脂\nv. 加奶油');
  assert.equal(lookup(d,'quote'),'n. "引号"\nvt. 引用');
});
test('handles prototype-like words as ordinary data',()=>{
  const d=data('word,translation\nconstructor,n. 构造器\n__proto__,n. 原型');assert.equal(lookup(d,'constructor'),'n. 构造器');assert.equal(lookup(d,'__proto__'),'n. 原型');
});
test('exact definitions take precedence over inflection links',()=>{
  const d=data('word,translation,exchange\nrun,v. 跑,p:ran/i:running/3:runs\nrunning,n. 跑步,');assert.equal(lookup(d,'RUNNING'),'n. 跑步');assert.match(lookup(d,'ran'),/词形原形：run/);assert.equal(lookup(d,'nonexistent'),null);
});
test('rejects invalid and truncated CSV without accepting bogus data',()=>{
  assert.throws(()=>parseCSV('word,definition\ncream,cream'));
  assert.throws(()=>parseCSV('word,translation\ncream,"未完成'));
  assert.throws(()=>parseCSV('word,translation\ncream,'));
});
test('stale lookup cannot overwrite a word edited during lookup',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const r={id:'1',word:'cream',meaning:''},job={},jobs=new Map([['1',job]]),field={value:''},feedback={textContent:'',replaceChildren(){}};let saves=0;
  const c=vm.createContext({Dictionary:{lookup:()=>pending},DictionaryCore:context.DictionaryCore,document:{querySelector:()=>({checked:true})},AbortController,setTimeout,clearTimeout,jobs,Error,save:()=>saves++});
  const app=fs.readFileSync('dist/app.js','utf8');vm.runInContext(app.slice(app.indexOf('async function lookup('),app.indexOf('function recheck(')),c);
  const result=c.lookup(r,field,feedback,job);jobs.delete('1');r.word='apple';field.value='手写';resolve('n. 奶油');await result;
  assert.equal(field.value,'手写');assert.equal(saves,0);
});

test('phrase lookup normalizes whitespace and keeps whole-expression definitions',()=>{
  const d=data('word,translation\ntake care of,照顾；照料\ntake,v. 拿\ncare,n. 关心');
  assert.equal(lookup(d,'  TAKE   CARE\tOF  '),'照顾；照料');
  assert.equal(lookup(d,'take care'),null);
  assert.equal(context.DictionaryCore.valid("take care of"),true);
  assert.equal(context.DictionaryCore.valid("can't wait"),true);
  assert.equal(context.DictionaryCore.valid('take care <script>'),false);
});
