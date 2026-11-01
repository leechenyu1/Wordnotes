/* Entire lines become entries; whitespace inside phrases never splits them into words. */
(function(root){
  function decode(buffer,encoding='auto'){
    const bytes=new Uint8Array(buffer);
    if(encoding!=='auto')return new TextDecoder(encoding,{fatal:true}).decode(bytes);
    if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);
    if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }
  function lines(text){return String(text).replace(/^\uFEFF/,'').split(/\r\n|\n|\r/).map(s=>s.trim()).filter(Boolean)}
  function makeRow(word,meaning='',remark='',source='unknown'){return{word:String(word??'').trim(),meaning:String(meaning??''),remark:String(remark??''),source:String(source||'unknown')}}
  function csv(text,delimiter=','){
    const table=[];let row=[],field='',quote=false;text=text.replace(/^\uFEFF/,'');
    const end=()=>{row.push(field);if(row.some(s=>s.trim()))table.push(row);row=[];field=''};
    for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quote=false;else field+=c}else if(c==='"'&&!field)quote=true;else if(c===delimiter){row.push(field);field=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;end()}else field+=c}
    if(quote)throw Error('CSV 引号没有闭合，请检查文件');if(field||row.length)end();return table;
  }
  const wordNames=['word','english','phrase','sentence','term','英文','单词','短语','句子','英文单词 / 短语','英文单词 / 短语 / 句子'];
  const meaningNames=['meaning','translation','中文','释义','中文释义'];const remarkNames=['remark','note','notes','备注'];
  function fromText(text,extension){
    if(extension==='csv'||extension==='tsv'){
      const table=csv(text,extension==='tsv'?'\t':',');if(!table.length)return[];
      const header=table[0].map(s=>s.trim().toLowerCase()),w=header.findIndex(s=>wordNames.includes(s));
      if(w>=0){const m=header.findIndex(s=>meaningNames.includes(s)),n=header.findIndex(s=>remarkNames.includes(s)),src=header.findIndex(s=>s==='source'||s==='来源');return table.slice(1).map(cols=>makeRow(cols[w],cols[m]||'',cols[n]||'',({ECDICT:'dictionary','在线翻译参考':'machine','手动编辑':'manual'}[cols[src]]||cols[src]||'unknown'))).filter(r=>r.word)}
      return table.map(cols=>makeRow(cols[0],cols[1]||'',cols[2]||'')).filter(r=>r.word);
    }
    if(extension==='json'){
      const d=JSON.parse(text.replace(/^\uFEFF/,''));const list=Array.isArray(d)?d:d.rows;
      if(!Array.isArray(list))throw Error('请选择字符串数组或含 rows 的 JSON；完整项目备份请使用左侧恢复功能');
      return list.flatMap(item=>typeof item==='string'?lines(item).map(word=>makeRow(word)):item&&typeof item.word==='string'?[makeRow(item.word,item.meaning,item.remark,item.source)]:[]).filter(r=>r.word);
    }
    return lines(text).map(word=>makeRow(word));
  }
  function select(rows,existing=[],deduplicate=false){
    const seen=new Set(existing.map(r=>DictionaryCore.normalize(r.word)));let duplicates=0;
    const selected=[];for(const r of rows){const key=DictionaryCore.normalize(r.word);if(deduplicate&&seen.has(key)){duplicates++;continue}seen.add(key);selected.push(r)}
    const single=selected.filter(r=>!DictionaryCore.normalize(r.word).includes(' ')).length;
    return{rows:selected,duplicates,single,multiple:selected.length-single};
  }
  async function docx(buffer){
    const bytes=new Uint8Array(buffer),v=new DataView(buffer);let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break}
    if(eocd<0)throw Error('不是有效的 DOCX 文件');
    const count=v.getUint16(eocd+10,true);let pos=v.getUint32(eocd+16,true),xml;
    for(let i=0;i<count;i++){
      if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)throw Error('DOCX 文件结构不完整');
      const method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),nameLen=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true);
      const name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nameLen));
      if(name==='word/document.xml'){
        if(size>20*1024*1024)throw Error('Word 文本过大，请另存为 TXT 后分批导入');
        if(v.getUint16(pos+8,true)&1)throw Error('暂不支持加密或受密码保护的 Word 文件');
        if(local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)throw Error('DOCX 文件结构不完整');
        const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);if(start+compressed>bytes.length)throw Error('DOCX 文件不完整');const content=bytes.slice(start,start+compressed);
        if(method===0)xml=new TextDecoder().decode(content);else if(method===8){let stream;try{stream=new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw'))}catch{throw Error('浏览器不支持 Word 解压，请在 Word 中另存为 TXT 后导入')}
          const reader=stream.getReader(),chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>20*1024*1024){await reader.cancel();throw Error('Word 文本过大，请另存为 TXT 分批导入')}chunks.push(value)}xml=await new Blob(chunks).text();
        }else throw Error('不支持该 Word 文件的压缩方式');break;
      }
      pos+=46+nameLen+extra+comment;
    }
    if(!xml)throw Error('Word 文件中未找到正文');
    const document=new DOMParser().parseFromString(xml,'application/xml');if(document.getElementsByTagName('parsererror').length)throw Error('Word 正文格式无效');
    const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const paragraphs=[...document.getElementsByTagNameNS(NS,'p')].filter(p=>{for(let a=p.parentElement;a;a=a.parentElement)if(a.namespaceURI===NS&&['del','moveFrom'].includes(a.localName))return false;return true});
    const result=[];for(const p of paragraphs){let text='';function walk(n){if(n.nodeType!==1)return;if(n.namespaceURI===NS){if(n!==p&&n.localName==='p')return;if(['del','moveFrom'].includes(n.localName))return;if(n.localName==='t'){text+=n.textContent;return}if(n.localName==='tab'){text+=' ';return}if(['br','cr'].includes(n.localName)){text+='\n';return}}for(const child of n.childNodes)walk(child)}walk(p);result.push(...lines(text))}
    return result.map(word=>makeRow(word));
  }
  async function read(file,encoding='auto'){
    if(file.size>25*1024*1024)throw Error('文件超过 25 MB，请分成较小文件导入');
    const ext=file.name.split('.').pop().toLowerCase();if(!['txt','md','csv','tsv','json','docx'].includes(ext))throw Error('支持 TXT、MD、CSV、TSV、JSON、DOCX；PDF、扫描件及旧版 DOC 请先转换为 TXT');
    const buffer=await file.arrayBuffer();let rows;if(ext==='docx')rows=await docx(buffer);else{let text;try{text=decode(buffer,encoding)}catch{throw Error('文件编码无法识别，请切换 UTF-8、UTF-16 或 GB18030 后重新选择文件')}rows=fromText(text,ext)}
    if(!rows.length)throw Error('没有找到非空条目');if(rows.length>10000)throw Error('超过 10,000 条，请拆分文件后导入；未导入任何条目');return rows;
  }
  root.FileImport={read,decode,lines,csv,fromText,select,docx};
})(globalThis);
