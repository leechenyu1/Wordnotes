const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('dist/export.js','utf8'),context);vm.runInContext(fs.readFileSync('dist/dictionary-core.js','utf8'),context);
const rows=[{word:'take care of',meaning:'照顾；照料\n关心',remark:'带逗号, "引号" | 管道',source:'dictionary'},{word:'',meaning:'',remark:'',source:'unknown'}];
test('all five exports preserve notes, skip empty rows, and choose correct extensions',()=>{
 for(const format of ['txt','md','csv','json','html']){const r=context.NoteExport.serialize(format,'我的笔记',rows);assert.ok(r.content.includes('take care of'));assert.ok(r.content.includes('照顾；照料'));assert.ok(r.content.includes('ECDICT')||r.content.includes('dictionary'));assert.equal(r.filename,'我的笔记.'+format)}
 const doc=JSON.parse(context.NoteExport.serialize('json','我的笔记',rows).content);assert.equal(doc.rows.length,1);assert.equal(doc.rows[0].remark,rows[0].remark);assert.equal(doc.rows[0].meaning,rows[0].meaning);
});
test('CSV preserves quotes and embedded newlines; spreadsheet formulas stay text',()=>{
 const out=context.NoteExport.serialize('csv','x',[{word:'=1+1',meaning:'一,"二"\n三',remark:'@SUM(1)',source:'manual'}]);
 assert.ok(out.content.startsWith('\uFEFF'));assert.ok(out.content.includes('"\'=1+1"'));assert.ok(out.content.includes('"一,""二""\n三"'));assert.ok(out.content.includes('"\'@SUM(1)"'));
});
test('HTML escapes active content, Markdown escapes table delimiters, filename is safe',()=>{
 const dangerous=[{word:'<script>alert(1)</script>',meaning:'a|b',remark:'<img src=x onerror=alert(1)>',source:'manual'}];
 const html=context.NoteExport.serialize('html','<Title>',dangerous);assert.ok(!html.content.includes('<script>'));assert.ok(html.content.includes('&lt;script&gt;'));assert.ok(!html.content.includes('<img '));
 assert.ok(context.NoteExport.serialize('md','x',dangerous).content.includes('a\\|b'));
 assert.equal(context.NoteExport.serialize('txt','../bad/name:*',rows).filename.includes('/'),false);
});
function appLookup(dictionary,translator,online=true){let saved=0;const r={id:'a',word:'take care of',meaning:'',remark:''},job={},jobs=new Map([['a',job]]),field={value:''},feedback={textContent:''};const ctx=vm.createContext({Dictionary:dictionary,PhraseTranslation:{translate:translator},DictionaryCore:context.DictionaryCore,document:{querySelector:()=>({checked:online})},AbortController,setTimeout,clearTimeout,Error,jobs,save:()=>saved++});const app=fs.readFileSync('dist/app.js','utf8');vm.runInContext(app.slice(app.indexOf('async function lookup('),app.indexOf('function recheck(')),ctx);return{r,field,feedback,run:()=>ctx.lookup(r,field,feedback,job),saved:()=>saved}}
test('dictionary phrase wins; missing phrase translates the entire input with a source label',async()=>{
 let called=0;let input;
 const exact=appLookup({lookup:async()=> '照顾'},async()=>{called++;return '翻译'});await exact.run();assert.equal(called,0);assert.equal(exact.r.source,'dictionary');assert.equal(exact.field.value,'照顾');
 const fallback=appLookup({lookup:async()=>null},async(text)=>{input=text;return '照料'});await fallback.run();assert.equal(input,'take care of');assert.equal(fallback.r.source,'machine');assert.match(fallback.feedback.textContent,/在线翻译参考/);
});
test('online fallback respects switch and never translates an unknown single word',async()=>{
 let called=0;const translate=async()=>{called++;return '结果'};
 const disabled=appLookup({lookup:async()=>null},translate,false);await disabled.run();assert.equal(called,0);assert.equal(disabled.r.meaning,'');
 const single=appLookup({lookup:async()=>null},translate);single.r.word='foobar';await single.run();assert.equal(called,0);
});
test('translation service errors preserve existing notes',async()=>{
 const fail=appLookup({lookup:async()=>null},async()=>{throw Error('NETWORK')});fail.r.meaning='自己写的释义';fail.field.value=fail.r.meaning;await fail.run();assert.equal(fail.r.meaning,'自己写的释义');assert.equal(fail.field.value,'自己写的释义');assert.equal(fail.saved(),0);assert.match(fail.feedback.textContent,/暂不可用/);
});
test('phrase API sends one normalized segment and rejects quota failures',async()=>{
 let url;const ctx=vm.createContext({DictionaryCore:context.DictionaryCore,TextEncoder,URL,fetch:async u=>{url=u;return{ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'照顾'}})}}});vm.runInContext(fs.readFileSync('dist/phrase.js','utf8'),ctx);assert.equal(await ctx.PhraseTranslation.translate(' Take   Care Of '),'照顾');assert.equal(url.searchParams.get('q'),'take care of');assert.equal(url.searchParams.get('langpair'),'en|zh-CN');
 ctx.fetch=async()=>({ok:true,json:async()=>({responseStatus:429,responseData:{translatedText:'LIMIT'}})});await assert.rejects(()=>ctx.PhraseTranslation.translate('some other phrase'));
});
