/* ECDICT CSV reader: preserves quoted commas, quotes and multiline definitions. */
(function(root){
  function normalize(word){return word.trim().toLowerCase().replace(/’/g,"'").replace(/\s+/g,' ')}
  function valid(word){return /[a-z]/i.test(word)&&/^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\s+&%$€£=]*$/u.test(word.trim())&&!/[<>]/.test(word)}
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,'');let headers=null,fields=[],field='',quoted=false,entries=new Map(),aliases=new Map();
    function flush(){fields.push(field);field='';if(!headers){headers=fields.map(v=>v.trim());if(!headers.includes('word')||!headers.includes('translation'))throw Error('请选择 ECDICT CSV（需要 word、translation 列）')}else{
      const at=name=>fields[headers.indexOf(name)]||'';
      const word=normalize(at('word'));
      const translation=at('translation').replace(/\\n/g,'\n').trim();
      if(word&&translation){entries.set(word,translation);for(const pair of at('exchange').split('/')){const colon=pair.indexOf(':');const type=pair.slice(0,colon);if(!['p','d','i','3','r','t','s'].includes(type))continue;for(const form of pair.slice(colon+1).split(',')){const key=normalize(form);if(key&&key!==word&&!aliases.has(key))aliases.set(key,word)}}}
    }fields=[]}
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"'&&field==='')quoted=true;else if(c===','){fields.push(field);field=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;flush()}else field+=c}
    if(quoted)throw Error('CSV 引号未闭合，文件可能不完整');if(field||fields.length)flush();if(!entries.size)throw Error('词库内没有有效中文释义');
    return{entries:[...entries],aliases:[...aliases]};
  }
  function lookup(data,word){word=normalize(word);const exact=data.entries.get(word);if(exact)return exact;const base=data.aliases.get(word);const meaning=base&&data.entries.get(base);return meaning?meaning+'\n（词形原形：'+base+'）':null}
  function workerSource(){return 'const normalize='+normalize.toString()+';const parseCSV='+parseCSV.toString()+';onmessage=e=>{try{postMessage({data:parseCSV(e.data)})}catch(error){postMessage({error:error.message})}};'}
  root.DictionaryCore={parseCSV,lookup,normalize,valid,workerSource};
})(globalThis);
