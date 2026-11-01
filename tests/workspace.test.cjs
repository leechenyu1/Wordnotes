const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync('dist/workspace.js','utf8'),c);const core=c.WorkspaceCore;
function storage(){const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),m}}
const note={word:'take care of',meaning:'照顾',remark:'例句',source:'dictionary'};
test('projects, edits, names and selected project survive reopening',()=>{
 const s=storage(),w=core.create(s);const first=w.active();first.rows.push(note);w.rename('课程笔记');const second=w.add('视频生词');second.rows.push({...note,word:'cream'});w.persist();
 const reopen=core.create(s);assert.equal(reopen.state.projects.length,2);assert.equal(reopen.active().name,'视频生词');reopen.switchTo(first.id);assert.equal(reopen.active().name,'课程笔记');assert.equal(reopen.active().rows[0].word,'take care of');reopen.rename('英语课程');reopen.persist();assert.equal(core.create(s).active().name,'英语课程');
});
test('migrates the previous single notebook without deleting it',()=>{
 const s=storage();s.setItem('word-notes-notebook-v1',JSON.stringify({title:'旧笔记',rows:[note]}));const w=core.create(s);assert.equal(w.active().name,'旧笔记');assert.equal(w.active().rows[0].source,'dictionary');w.persist();assert.ok(s.getItem('word-notes-notebook-v1'));assert.equal(core.create(s).active().rows[0].meaning,'照顾');
});
test('backups merge into existing projects with unique identities',()=>{
 const s=storage(),w=core.create(s);w.active().rows.push(note);const backup=JSON.parse(w.backup());w.importData(backup);w.importData(backup);assert.equal(w.state.projects.length,3);assert.equal(new Set(w.state.projects.map(p=>p.id)).size,3);assert.equal(w.active().rows[0].meaning,'照顾');w.importData({schemaVersion:1,title:'单项目 JSON',rows:[note]});assert.equal(w.active().name,'单项目 JSON');
});
test('bad backups are rejected atomically; corrupted saved data is preserved',()=>{
 const s=storage(),w=core.create(s),before=w.backup();assert.throws(()=>w.importData({schemaVersion:2,projects:[{id:'a',name:'bad',rows:[{word:'x'}]}]}));assert.equal(w.state.projects.length,JSON.parse(before).projects.length);
 s.setItem('word-notes-workspace-v2','broken');const broken=core.create(s);assert.ok(broken.loadError);assert.throws(()=>broken.persist());assert.equal(s.getItem('word-notes-workspace-v2'),'broken');
});
test('portable embedded notes load with fresh or unavailable browser storage',()=>{
 const w=core.create(storage());w.active().rows.push(note);w.rename('可携带项目');const backup=JSON.parse(w.backup());assert.equal(core.create(storage(),backup).active().name,'可携带项目');
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};const result=core.create(denied,backup);assert.equal(result.active().rows[0].meaning,'照顾');assert.throws(()=>result.persist());
});
test('self-contained dictionary worker needs no file or network imports',()=>{
 vm.runInContext(fs.readFileSync('dist/dictionary-core.js','utf8'),c);let response;const worker=vm.createContext({postMessage:x=>response=x});vm.runInContext(c.DictionaryCore.workerSource(),worker);worker.onmessage({data:'word,translation\ntake care of,照顾'});assert.equal(response.data.entries[0][1],'照顾');
});
