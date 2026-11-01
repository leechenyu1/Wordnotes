const box=document.querySelector('#lines'),title=document.querySelector('#title'),saveStatus=document.querySelector('#save-status');
const jobs=new Map();let rows=[],saveTimer;
const store=(()=>{try{return localStorage}catch{return{getItem(){throw Error('浏览器禁止本地保存')},setItem(){throw Error('浏览器禁止本地保存')}}}})();
let embedded=null;try{embedded=JSON.parse(document.querySelector('#embedded-workspace').textContent)}catch{}
const workspace=WorkspaceCore.create(store,embedded);
function row(word='',meaning='',remark='',source='unknown'){return{id:WorkspaceCore.id(),word,meaning,remark,source}}
function drawProjects(){const nav=document.querySelector('#projects');nav.replaceChildren();for(const p of workspace.state.projects){const b=node('button','project-item');b.type='button';b.setAttribute('aria-current',p.id===workspace.state.activeProjectId?'page':'false');const name=node('span','project-name');name.textContent=p.name;const count=node('span','project-count');count.textContent=p.rows.filter(r=>r.word.trim()).length+' 条';b.append(name,count);b.onclick=()=>{save();for(const id of jobs.keys())cancel(id);workspace.switchTo(p.id);showProject();save()};nav.append(b)}}
function showProject(){stopBatch();const p=workspace.active();title.value=p.name;rows=p.rows;if(!rows.length)rows.push(row());box.replaceChildren();rows.forEach(r=>append(r));drawProjects()}
function save(){clearTimeout(saveTimer);workspace.active().rows=rows;workspace.rename(title.value);try{workspace.persist();saveStatus.textContent='已自动保存 · 可关闭后继续'}catch(e){saveStatus.textContent='自动保存失败，请备份所有项目';document.querySelector('#workspace-status').textContent=e.message}document.querySelector('#count').textContent=rows.filter(r=>r.word.trim()).length+' 条笔记';drawProjects()}
function node(tag,cls){const n=document.createElement(tag);n.className=cls;return n}
function cancel(id){const j=jobs.get(id);if(j){clearTimeout(j.timer);j.controller?.abort();jobs.delete(id)}}
function append(r,focus=false){const line=node('div','line');line.dataset.id=r.id;const number=node('span','number'),word=node('textarea','word'),arrow=node('span','arrow'),meaning=node('textarea','meaning'),remove=node('button','remove'),remark=node('input','remark'),feedback=node('div','feedback');word.value=r.word;word.placeholder='单词、短语或句子';word.setAttribute('aria-label','英文单词、短语或句子');word.maxLength=1000;word.rows=1;word.spellcheck=false;arrow.textContent='→';meaning.value=r.meaning;meaning.placeholder='自动补充释义…';meaning.rows=1;meaning.setAttribute('aria-label','词性与中文释义，可编辑');remark.value=r.remark;remark.placeholder='添加自己的备注或例句…';remark.setAttribute('aria-label','备注');remove.textContent='×';remove.setAttribute('aria-label','删除此行');feedback.setAttribute('role','status');const check=node('button','recheck');check.textContent='词典重查';check.type='button';check.onclick=()=>recheck(r,line);line.append(number,word,arrow,meaning,remove,remark,check,feedback);box.append(line);word.style.height='auto';word.style.height=Math.max(36,word.scrollHeight)+'px';if(r.meaning)feedback.textContent=NoteExport.sourceLabel(r.source);
const start=()=>{cancel(r.id);feedback.replaceChildren();r.meaning='';r.source='unknown';meaning.value='';save();if(!r.word.trim())return;if(!DictionaryCore.valid(r.word)){feedback.textContent='请输入英文单词、短语或句子，例如 How are you?' ;return}const job={timer:setTimeout(()=>lookup(r,meaning,feedback,job),800)};jobs.set(r.id,job)};
word.addEventListener('input',()=>{word.style.height='auto';word.style.height=Math.max(36,word.scrollHeight)+'px';r.word=word.value;start()});word.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const i=rows.indexOf(r);if(rows[i+1])box.children[i+1].querySelector('.word').focus();else add()}});
meaning.addEventListener('input',()=>{cancel(r.id);feedback.replaceChildren();r.meaning=meaning.value;r.source='manual';save()});remark.addEventListener('input',()=>{r.remark=remark.value;save()});remove.onclick=()=>{cancel(r.id);rows=rows.filter(x=>x!==r);line.remove();if(!rows.length)add();renumber();save()};if(focus)word.focus();renumber()}
function renumber(){[...box.children].forEach((n,i)=>n.querySelector('.number').textContent=String(i+1).padStart(2,'0'))}
function add(){const r=row();rows.push(r);append(r,true);save()}
async function lookup(r,field,feedback,job){
  if(jobs.get(r.id)!==job)return;
  if(!DictionaryCore.valid(r.word)){feedback.textContent='请输入英文单词、短语或句子';jobs.delete(r.id);return}
  const phrase=DictionaryCore.normalize(r.word).includes(' '),online=document.querySelector('#phrase-online').checked;
  job.controller=new AbortController();feedback.textContent='正在查词典…';let timeout;
  try{
    let text,source='dictionary';
    try{text=await Dictionary.lookup(r.word)}catch(e){if(e.message!=='NO_DICTIONARY'||!phrase||!online)throw e}
    if(jobs.get(r.id)!==job)return;
    if(!text&&phrase&&online){feedback.textContent='正在翻译完整短语或句子…';timeout=setTimeout(()=>job.controller.abort(),15000);text=await PhraseTranslation.translate(r.word,job.controller.signal);source='machine'}
    if(jobs.get(r.id)!==job)return;
    if(!text)throw Error('NOT_FOUND');
    r.meaning=text;r.source=source;field.value=text;feedback.textContent=source==='machine'?'在线翻译参考 · 可手动修改':'ECDICT 词典释义';save();
  }catch(e){if(jobs.get(r.id)!==job)return;feedback.textContent=e.message==='QUOTA'?'在线翻译额度暂不可用，可稍后重试或手动填写':e.message==='TOO_LONG'?'整句超过在线翻译长度限制（500 字节），请拆成较短句子':e.message==='NO_DICTIONARY'?'请先在上方导入英汉词库':e.name==='AbortError'?'在线翻译超时，可点击词典重查':e.message==='NOT_FOUND'?(phrase?'词库未收录此短语或句子，可启用在线翻译或手动填写':'词库未收录此词，可检查拼写或手动填写'):'在线翻译暂不可用，可重试或手动填写'}
  finally{clearTimeout(timeout);if(jobs.get(r.id)===job)jobs.delete(r.id)}
}
function recheck(r,line){cancel(r.id);const job={};jobs.set(r.id,job);lookup(r,line.querySelector('.meaning'),line.querySelector('.feedback'),job)}
window.addEventListener('dictionary-ready',()=>{fillBatch()});
title.addEventListener('input',save);document.querySelector('#add').onclick=add;document.querySelector('#export').onclick=()=>{save();const output=NoteExport.serialize(document.querySelector('#export-format').value,title.value,rows);const url=URL.createObjectURL(new Blob([output.content],{type:output.mime}));const a=document.createElement('a');a.href=url;a.download=output.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const phraseToggle=document.querySelector('#phrase-online');try{phraseToggle.checked=localStorage.getItem('word-notes-phrase-online')!=='false'}catch{}
phraseToggle.addEventListener('change',()=>{try{localStorage.setItem('word-notes-phrase-online',String(phraseToggle.checked))}catch{}if(!phraseToggle.checked)for(const r of rows){const job=jobs.get(r.id);if(job?.controller&&DictionaryCore.normalize(r.word).includes(' ')){cancel(r.id);const line=[...box.children].find(n=>n.dataset.id===r.id);if(line)line.querySelector('.feedback').textContent='在线翻译已关闭，可点击词典重查'}}});
document.querySelector('#new-project').onclick=()=>{save();for(const id of jobs.keys())cancel(id);workspace.add('未命名项目 '+(workspace.state.projects.length+1));showProject();save();title.focus();title.select()};
function download(content,mime,name){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.querySelector('#backup-all').onclick=()=>{save();download(workspace.backup(),'application/json;charset=utf-8','word-notes-all-projects.json')};
document.querySelector('#restore-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;const currentProjectId=workspace.state.activeProjectId;try{const input=JSON.parse(await file.text());if(workspace.state.activeProjectId!==currentProjectId){document.querySelector('#workspace-status').textContent='项目已切换，请重新选择备份文件';return}save();for(const id of jobs.keys())cancel(id);const added=workspace.importData(input);showProject();save();document.querySelector('#workspace-status').textContent='已导入 '+added.length+' 个项目，原项目仍保留'}catch(e){document.querySelector('#workspace-status').textContent='导入失败：'+e.message}finally{event.target.value=''}};
document.querySelector('#snapshot').onclick=()=>{save();if(document.querySelector('script[src],link[rel="stylesheet"]')){document.querySelector('#workspace-status').textContent='请打开下载的 WordNotes_Local.html，或使用完整项目备份';return}const clone=document.documentElement.cloneNode(true);clone.querySelector('#embedded-workspace').textContent=workspace.backup().replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');clone.querySelector('#projects').replaceChildren();clone.querySelector('#notes-preview').replaceChildren();clone.querySelector('#notes-import-status').textContent='';clone.querySelector('#notes-import').setAttribute('disabled','');clone.querySelector('#batch-status').textContent='';clone.querySelector('#batch-stop').setAttribute('hidden','');clone.querySelector('#lines').replaceChildren();clone.querySelector('#dictionary-status').textContent='正在检查本地词库…';clone.querySelector('#save-status').textContent='正在恢复笔记…';clone.querySelector('#workspace-status').textContent='';clone.querySelectorAll('[disabled]').forEach(n=>n.removeAttribute('disabled'));clone.querySelector('#notes-import').setAttribute('disabled','');download('<!doctype html>\n'+clone.outerHTML,'text/html;charset=utf-8','WordNotes_Local.html')};
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});

let batch=null;
function stopBatch(){if(!batch)return;const previous=batch;batch=null;if(previous.jobId)cancel(previous.jobId);document.querySelector('#batch-stop').hidden=true;document.querySelector('#batch-fill').disabled=false;document.querySelector('#batch-status').textContent='已停止补全，已有内容已保存'}
async function fillBatch(){
  stopBatch();const projectId=workspace.state.activeProjectId,queue=rows.filter(r=>r.word.trim()&&!r.meaning);if(!queue.length){document.querySelector('#batch-status').textContent='没有需要补全的条目';return}
  const token={projectId};batch=token;document.querySelector('#batch-stop').hidden=false;document.querySelector('#batch-fill').disabled=true;let finished=0,success=0;
  for(const r of queue){
    if(batch!==token||workspace.state.activeProjectId!==projectId)break;
    if(rows.includes(r)&&!r.meaning){const line=[...box.children].find(n=>n.dataset.id===r.id);if(line){cancel(r.id);const job={};jobs.set(r.id,job);token.jobId=r.id;await lookup(r,line.querySelector('.meaning'),line.querySelector('.feedback'),job);if(r.meaning)success++}}
    if(batch!==token)break;finished++;document.querySelector('#batch-status').textContent='已处理 '+finished+' / '+queue.length+' 条 · 补全 '+success+' 条';await new Promise(resolve=>setTimeout(resolve,r.source==='machine'?300:0));
  }
  if(batch===token){batch=null;document.querySelector('#batch-stop').hidden=true;document.querySelector('#batch-fill').disabled=false;document.querySelector('#batch-status').textContent='补全结束：'+success+' 条成功，'+(finished-success)+' 条未补全';save()}
}
document.querySelector('#batch-fill').onclick=fillBatch;document.querySelector('#batch-stop').onclick=stopBatch;
let importRows=null,importName='',fileRevision=0;
const preview=document.querySelector('#notes-preview'),importButton=document.querySelector('#notes-import'),importStatus=document.querySelector('#notes-import-status');
function selection(){return FileImport.select(importRows||[],document.querySelector('#notes-destination').value==='current'?rows:[],document.querySelector('#notes-deduplicate').checked)}
function drawPreview(){preview.replaceChildren();if(!importRows){importButton.disabled=true;return}const data=selection();const info=node('p','preview-count');info.textContent='共 '+data.rows.length+' 条：单词 '+data.single+' 条，短语 / 句子 '+data.multiple+' 条'+(data.duplicates?'；忽略重复 '+data.duplicates+' 条':'');const list=node('ol','preview-list');for(const r of data.rows.slice(0,50)){const item=node('li','');item.textContent=r.word;list.append(item)}preview.append(info,list);if(data.rows.length>50){const rest=node('p','');rest.textContent='预览前 50 条；确认后全部 '+data.rows.length+' 条都会显示。';preview.append(rest)}importButton.disabled=!data.rows.length}
document.querySelector('#notes-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;const revision=++fileRevision;importRows=null;drawPreview();importStatus.textContent='正在读取文件…';try{const result=await FileImport.read(file,document.querySelector('#notes-encoding').value);if(revision!==fileRevision)return;importRows=result;importName=file.name.replace(/\.[^.]+$/,'')||'导入的笔记';drawPreview();importStatus.textContent='读取完成，请确认预览后导入'}catch(e){if(revision===fileRevision)importStatus.textContent='读取失败：'+e.message}};
document.querySelector('#notes-encoding').onchange=()=>{if(document.querySelector('#notes-file').files.length)document.querySelector('#notes-file').onchange({target:document.querySelector('#notes-file')})};document.querySelector('#notes-deduplicate').onchange=drawPreview;document.querySelector('#notes-destination').onchange=drawPreview;
importButton.onclick=()=>{
  if(!importRows)return;const data=selection();if(!data.rows.length)return;save();stopBatch();for(const id of jobs.keys())cancel(id);
  if(document.querySelector('#notes-destination').value==='new')workspace.add(importName);
  const p=workspace.active();p.rows=p.rows.filter(r=>r.word.trim()||r.meaning.trim()||r.remark.trim());for(const r of data.rows)p.rows.push(row(r.word,r.meaning,r.remark,r.source));showProject();save();
  importRows=null;preview.replaceChildren();importButton.disabled=true;document.querySelector('#notes-file').value='';importStatus.textContent='已导入 '+data.rows.length+' 条；已自动保存';if(document.querySelector('#notes-auto').checked)fillBatch();
};
showProject();save();
