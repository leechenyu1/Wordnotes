importScripts('dictionary-core.js');
onmessage=event=>{try{postMessage({data:DictionaryCore.parseCSV(event.data)})}catch(e){postMessage({error:e.message})}};
