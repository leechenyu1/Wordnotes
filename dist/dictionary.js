/* Dictionary lookup stays local; optional phrase translation is handled separately. */
const Dictionary=(()=>{
  let current=null,busy=false;
  const status=document.querySelector('#dictionary-status'),online=document.querySelector('#dictionary-download'),picker=document.querySelector('#dictionary-file');
  const URL='https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';
  function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('word-notes-dictionary',1);req.onupgradeneeded=()=>req.result.createObjectStore('dictionary');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function read(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('dictionary'),req=tx.objectStore('dictionary').get('ecdict');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error)}})}
  async function write(data){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('dictionary','readwrite');tx.objectStore('dictionary').put(data,'ecdict');tx.oncomplete=()=>{db.close();resolve()};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)}})}
  function parse(text){return new Promise((resolve,reject)=>{
    let worker,url,settled=false;
    function cleanup(){worker?.terminate();if(url)globalThis.URL.revokeObjectURL(url)}
    function fallback(){if(settled)return;settled=true;cleanup();setTimeout(()=>{try{resolve(DictionaryCore.parseCSV(text))}catch(e){reject(e)}},30)}
    try{url=globalThis.URL.createObjectURL(new Blob([DictionaryCore.workerSource()],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>{if(settled)return;settled=true;cleanup();e.data.error?reject(Error(e.data.error)):resolve(e.data.data)};worker.onerror=fallback;worker.postMessage(text)}catch{fallback()}
  })}
  function activate(data){current={entries:new Map(data.entries.map(([k,v])=>[DictionaryCore.normalize(k),v])),aliases:new Map((data.aliases||[]).map(([k,v])=>[DictionaryCore.normalize(k),DictionaryCore.normalize(v)]))};status.textContent='ECDICT 已就绪 · '+current.entries.size.toLocaleString()+' 条中文词条';window.dispatchEvent(new Event('dictionary-ready'))}
  async function install(text){status.textContent='正在整理词库，请稍候…';const data=await parse(text);let persisted=true;try{await write(data)}catch{persisted=false}activate(data);if(!persisted)status.textContent+=' · 无法保存，刷新后需重新导入'}
  function lock(value){busy=value;online.disabled=value;picker.disabled=value}
  const ready=(async()=>{try{const saved=await read();if(saved?.entries?.length)activate(saved);else status.textContent='尚未导入词库，请下载导入或选择 CSV 文件'}catch{status.textContent='尚未导入词库；浏览器存储不可用时仅本次访问有效'}})();
  online.onclick=async()=>{await ready;if(busy)return;lock(true);status.textContent='正在下载完整 ECDICT（文件较大，请稍候）…';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180000);try{const response=await fetch(URL,{signal:controller.signal});if(!response.ok)throw Error('下载失败');const reader=response.body.getReader(),chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.byteLength;status.textContent='正在下载 ECDICT · '+(size/1048576).toFixed(1)+' MB'}const text=await new Blob(chunks).text();await install(text)}catch{status.textContent=(current?'原词库仍可用。':'')+'下载未完成；请通过下方词库链接下载 CSV，再选择文件导入'}finally{clearTimeout(timeout);lock(false)}};
  picker.onchange=async()=>{await ready;const file=picker.files[0];if(!file||busy)return;lock(true);try{await install(await file.text())}catch(e){status.textContent=e.message+(current?'；原词库仍可用':'')}finally{lock(false);picker.value=''}};
  return{ready,lookup:async word=>{await ready;if(!current)throw Error('NO_DICTIONARY');return DictionaryCore.lookup(current,word)}};
})();
