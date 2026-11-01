const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({TextDecoder,TextEncoder,Blob,DecompressionStream});for(const name of ['dictionary-core','import','export'])vm.runInContext(fs.readFileSync('dist/'+name+'.js','utf8'),c);const imp=c.FileImport;
const plain='\uFEFFapple\r\n\r\ntake care of\rI haven\'t seen him for a long time.\n  banana  ';
test('one physical nonempty line becomes one entry; phrases and sentences stay intact',()=>{
 const rows=imp.fromText(plain,'txt');assert.equal(rows.length,4);assert.equal(rows[1].word,'take care of');assert.equal(rows[2].word,"I haven't seen him for a long time.");assert.equal(rows[3].word,'banana');assert.equal(c.DictionaryCore.valid(rows[2].word),true);assert.equal(c.DictionaryCore.valid('How are you?'),true);assert.equal(c.DictionaryCore.valid('<script>bad</script>'),false);
});
test('optional deduplication covers repeated lines and current notes without altering order',()=>{
 const rows=imp.fromText('apple\nApple\ntake care of\ntake   care of','txt');assert.equal(imp.select(rows,[],false).rows.length,4);const d=imp.select(rows,[{word:'APPLE'}],true);assert.equal(d.rows.length,1);assert.equal(d.duplicates,3);assert.equal(d.rows[0].word,'take care of');assert.equal(d.multiple,1);
});
test('reads CSV/TSV headers, multiline quoted cells, and exported CSV',()=>{
 const parsed=imp.fromText('英文,中文,备注\r\napple,苹果,常见\r\n"take care of","照顾\n照料","带,逗号"','csv');assert.equal(parsed.length,2);assert.equal(parsed[1].word,'take care of');assert.equal(parsed[1].meaning,'照顾\n照料');assert.equal(parsed[1].remark,'带,逗号');
 assert.equal(imp.fromText('word\tmeaning\napple\t苹果','tsv')[0].meaning,'苹果');const exported=c.NoteExport.serialize('csv','标题',[{word:'take care of',meaning:'照顾',remark:'例句',source:'dictionary'}]);const restored=imp.fromText(exported.content,'csv');assert.equal(restored[0].source,'dictionary');assert.equal(restored[0].word,'take care of');assert.throws(()=>imp.fromText('"broken','csv'));
});
test('JSON accepts word arrays and earlier single-project exports; workspace backups use restore',()=>{
 assert.equal(imp.fromText('["apple","take care of"]','json').length,2);assert.equal(imp.fromText(JSON.stringify({rows:[{word:'apple',meaning:'苹果',remark:'备注'}]}),'json')[0].meaning,'苹果');assert.throws(()=>imp.fromText('{"projects":[]}','json'));
});
test('decodes BOM UTF-16, UTF-8, and rejects unsupported files without importing',async()=>{
 const utf16=Buffer.concat([Buffer.from([255,254]),Buffer.from('apple\r\ntake care of','utf16le')]);assert.equal(imp.decode(utf16),'apple\r\ntake care of');
 const file={name:'words.txt',size:100,arrayBuffer:async()=>new TextEncoder().encode(plain).buffer};assert.equal((await imp.read(file)).length,4);await assert.rejects(()=>imp.read({...file,name:'scan.pdf'}),/PDF/);await assert.rejects(()=>imp.read({...file,size:30*1024*1024}),/25 MB/);await assert.rejects(()=>imp.docx(new ArrayBuffer(0)),/DOCX/);
});
test('batch lookup runs sequentially and preserves rows with existing meanings',async()=>{
 const app=fs.readFileSync('dist/app.js','utf8'),part=app.slice(app.indexOf('let batch=null;'),app.indexOf("document.querySelector('#batch-fill').onclick"));
 const elements=new Map();const document={querySelector:s=>{if(!elements.has(s))elements.set(s,{});return elements.get(s)}};
 const rows=[{id:'a',word:'apple',meaning:'',source:'unknown'},{id:'b',word:'take care of',meaning:'已有释义',source:'manual'},{id:'c',word:'cream',meaning:'',source:'unknown'}];let running=0,max=0,count=0;
 const box={children:rows.map(r=>({dataset:{id:r.id},querySelector:()=>({})}))},jobs=new Map();
 const ctx=vm.createContext({document,workspace:{state:{activeProjectId:'p'}},rows,box,jobs,cancel:id=>jobs.delete(id),setTimeout,Promise,save(){},lookup:async(r)=>{running++;max=Math.max(max,running);await new Promise(done=>setTimeout(done,1));r.meaning='已补全';r.source='dictionary';running--;count++}});
 vm.runInContext(part,ctx);await ctx.fillBatch();assert.equal(max,1);assert.equal(count,2);assert.equal(rows[1].meaning,'已有释义');assert.match(elements.get('#batch-status').textContent,/2 条成功/);
});
test('reads DOCX stored and deflated document XML, preserving paragraph and manual line breaks',async()=>{
 const {deflateRawSync}=require('node:zlib');
 const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>apple</w:t></w:r></w:p><w:p><w:r><w:t>take</w:t><w:tab/><w:t>care of</w:t><w:br/><w:t>How are you?</w:t></w:r></w:p></w:body></w:document>';
 const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const node=(name,children=[],text='')=>({nodeType:1,namespaceURI:NS,localName:name,childNodes:children,textContent:text,parentElement:null});
 const paragraphs=[node('p',[node('r',[node('t',[],'apple')])]),node('p',[node('r',[node('t',[],'take'),node('tab'),node('t',[],'care of'),node('br'),node('t',[],'How are you?')])])];
 const ctx=vm.createContext({TextDecoder,TextEncoder,Blob,DecompressionStream,DOMParser:class{parseFromString(input){assert.equal(input,xml);return{getElementsByTagName:()=>[],getElementsByTagNameNS:()=>paragraphs}}}});vm.runInContext(fs.readFileSync('dist/import.js','utf8'),ctx);
 function archive(method){const name=Buffer.from('word/document.xml'),plain=Buffer.from(xml),body=method===8?deflateRawSync(plain):plain;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(method,8);local.writeUInt32LE(body.length,18);local.writeUInt32LE(plain.length,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(method,10);central.writeUInt32LE(body.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+body.length,16);
  const bytes=Buffer.concat([local,name,body,central,name,end]);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)}
 for(const method of [0,8]){const imported=await ctx.FileImport.docx(archive(method));assert.equal(imported.length,3);assert.equal(imported[1].word,'take care of');assert.equal(imported[2].word,'How are you?')}
});
