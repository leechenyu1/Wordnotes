/* Pure serializers: keep notes and source labels in every format. */
(function(root){
  const sourceLabel=source=>({dictionary:'ECDICT',machine:'在线翻译参考',manual:'手动编辑'}[source]||'原有笔记');
  const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const md=value=>String(value??'').replace(/\\/g,'\\\\').replace(/[|`*_[\]<>#]/g,'\\$&').replace(/\r?\n/g,'<br>');
  function csv(value){let s=String(value??'');if(/^[\s\uFEFF]*[=+@-]/u.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function serialize(format,title,rows){
    title=title.trim()||'单词笔记';const notes=rows.filter(r=>r.word.trim()||r.meaning.trim()||r.remark.trim()).map(r=>({word:r.word,meaning:r.meaning,remark:r.remark,source:r.source||'unknown'}));
    let content,mime;switch(format){
      case 'txt':content=title+'\n\n'+notes.map(r=>r.word+' → '+r.meaning+'\n来源：'+sourceLabel(r.source)+(r.remark?'\n备注：'+r.remark:'')).join('\n\n');mime='text/plain';break;
      case 'md':content='# '+md(title)+'\n\n| 英文单词 / 短语 | 中文释义 | 备注 | 来源 |\n| --- | --- | --- | --- |\n'+notes.map(r=>'| '+[r.word,r.meaning,r.remark,sourceLabel(r.source)].map(md).join(' | ')+' |').join('\n');mime='text/markdown';break;
      case 'csv':content='\uFEFF'+[['英文单词 / 短语','中文释义','备注','来源'],...notes.map(r=>[r.word,r.meaning,r.remark,sourceLabel(r.source)])].map(row=>row.map(csv).join(',')).join('\r\n');mime='text/csv';break;
      case 'json':content=JSON.stringify({schemaVersion:1,title,exportedAt:new Date().toISOString(),rows:notes},null,2);mime='application/json';break;
      case 'html':content='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html(title)+'</title><style>body{max-width:1050px;margin:40px auto;padding:20px;font:15px/1.8 system-ui;color:#34372f}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #ddd;padding:12px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#f1f3ec}@media print{body{margin:0}tr{break-inside:avoid}}</style><h1>'+html(title)+'</h1><table><thead><tr><th>英文单词 / 短语</th><th>中文释义</th><th>备注</th><th>来源</th></tr></thead><tbody>'+notes.map(r=>'<tr>'+[r.word,r.meaning,r.remark,sourceLabel(r.source)].map(v=>'<td>'+html(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></html>';mime='text/html';break;
      default:throw Error('不支持的导出格式');
    }
    const filename=title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/^\.+|[. ]+$/g,'').slice(0,80)||'word-notes';
    return{content,mime:mime+';charset=utf-8',filename:filename+'.'+format};
  }
  root.NoteExport={serialize,sourceLabel};
})(globalThis);
