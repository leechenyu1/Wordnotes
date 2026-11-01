(function(root){
  const cache=new Map();let exhausted=false;
  async function translate(text,signal){
    text=DictionaryCore.normalize(text);if(cache.has(text))return cache.get(text);
    if(exhausted)throw Error('QUOTA');
    if(new TextEncoder().encode(text).length>500)throw Error('TOO_LONG');
    const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',text);url.searchParams.set('langpair','en|zh-CN');
    const response=await fetch(url,{signal});if(response.status===429){exhausted=true;throw Error('QUOTA')}if(!response.ok)throw Error('NETWORK');const data=await response.json();if([403,429].includes(Number(data.responseStatus))){exhausted=true;throw Error('QUOTA')}
    const result=data.responseData?.translatedText;
    if(Number(data.responseStatus)!==200||typeof result!=='string'||!result.trim()||!/[\u3400-\u9fff]/u.test(result))throw Error('TRANSLATION');
    cache.set(text,result.trim());return result.trim();
  }
  root.PhraseTranslation={translate};
})(globalThis);
