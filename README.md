# 词间 · 单词笔记

静态 HTML/CSS/JavaScript 应用，部署目录为 `dist/`。每行输入英文单词或短语，800 毫秒后从本地 ECDICT 数据补充中文释义。Enter 继续下一行；支持编辑释义、备注、删除、TXT、Markdown、CSV、JSON、HTML 五种格式导出。笔记保存在当前浏览器 localStorage。

## 导入词库

更新部署时上传完整 `dist/`，包括新增的 dictionary*.js 及授权说明页。打开网站后点击“下载并导入 ECDICT”，浏览器从上游仓库下载 ecdict.csv。CSV 由 Web Worker 解析，保留 word、translation 与 exchange 词形关系，存入 IndexedDB。成功后显示真实导入条数。也可从 https://github.com/skywind3000/ECDICT/blob/master/ecdict.csv 下载 CSV，再通过“从 CSV 文件导入”选择文件。

完整词库未内置在发布包中：执行环境无法解析 raw.githubusercontent.com，尚未验证真实词库下载、浏览器布局或 IndexedDB 持久化。下载成功与否以页面反馈为准。浏览器不支持持久化时会提示刷新后需重新导入。当前页面加载后查询无需外部翻译服务，不保证整个网站能在断网后重新打开。

ECDICT 上游项目：https://github.com/skywind3000/ECDICT ，项目声明 MIT，授权原文：https://github.com/skywind3000/ECDICT/blob/master/LICENSE 。不是牛津/朗文官方词典，词条可能有误。单词查不到时允许手写。短语优先整条查询词库，未收录时在页面开关启用的情况下调用 MyMemory（https://mymemory.translated.net/doc/spec.php）翻译整个短语。该开关默认启用并记忆选择，页面明确说明短语会发送给第三方，结果标注“在线翻译参考”。可关闭该功能；免费接口存在额度限制，不保证短语准确性。保留多词性释义和换行；词形查询优先精确词条，再查 exchange 列声明的原形。已有笔记不自动覆盖，点击每行“词典重查”可主动替换。

## 检查

`node --test tests/*.test.cjs`：13 项通过，覆盖 CSV 解析、短语空白归一化、精确查询优先、在线短语兜底及开关、过期请求、五种导出、JSON 保真、CSV 引号/换行及公式防护、HTML/Markdown 转义。JavaScript 语法检查通过。

## 部署状态

用户已将旧版本手动上传至 Netlify。新版代码仅在本地更新，需在同一 Netlify 项目的 Deploys 页面重新上传 `dist/`。Sites 身份保留于 `.openai/hosting.json`；此前源码上传因 DNS 不可用失败，不要重新创建项目。


## 导出

页面右上选择格式后点击“导出”。TXT 适合纯文本，Markdown 适合笔记，CSV 含 UTF-8 BOM 便于表格软件读取，JSON 保留结构化数据及来源字段，HTML 是独立可打开的文档，也可在浏览器中打印为 PDF（没有直接 PDF 文件导出功能）。全部格式保留英文、中文、备注与来源，跳过完全空白行。CSV 对可能被识别为公式的单元格添加文本前缀。JSON 导出是结构化备份，当前尚无 JSON 导入界面。

未执行真实网络接口或浏览器视觉验证。新增 export.js、phrase.js 需要与其他 dist 文件一起上传，不要只替换 index.html。

## 本地单文件版与项目管理

用户要求改为本地使用，不再部署。运行 `python3 scripts/build-local.py` 会生成 `../outputs/WordNotes_Local.html`。CSS、脚本和 CSV 解析 Worker 源码均嵌入同一文件，双击可打开；Worker 使用 Blob URL，不支持时退回主线程解析，无需本地服务器。词库仍需首次下载或选择 CSV；在线短语翻译仍需联网。

新增多个项目、新建、切换、直接编辑标题改名。所有项目内容和上次选择以 `word-notes-workspace-v2` 存入 localStorage；每次输入同步保存，并在 pagehide 和隐藏页面时保存。自动迁移同一浏览器来源下的旧单项目数据，保留原 key。file URL 下的持久化由浏览器决定，移动文件、换浏览器、无痕模式或清理浏览器数据可能导致无法读取原记录，不能承诺绝对永久保存。页面显示保存失败时应立即备份。

“备份所有项目”下载 JSON；“导入 / 恢复 JSON”支持完整项目备份和原来的单项目 JSON，以新增项目方式导入，不覆盖已有项目。“保存可携带副本”仅在单文件版启用，将所有笔记嵌入可独立运行的 HTML，适合在其他位置打开后恢复。备份和可携带 HTML 均不包含词库文件。来自旧 Netlify 网站的笔记必须先在旧站点导出 JSON，再导入本地版，不会自动跨来源迁移。

`node --test tests/*.test.cjs` 当前 19 项通过，新增项目持久化/重命名/切换、旧数据迁移、备份合并、无效数据保护、可携带数据恢复、内嵌 Worker 自包含检查。浏览器运行环境不可用，尚未完成实际浏览器视觉与真实关闭重开验证。

## 从文件批量导入

新增“从文件批量导入”面板，支持 TXT/MD/CSV/TSV/JSON/DOCX。文本文件按 CRLF、LF 或 CR 分行，忽略空行，单个词保留为单词，多个词保持整行短语/句子，不按空格拆词。支持 UTF-8、带 BOM 的 UTF-16 自动判断，以及手动选择 UTF-16/GB18030。CSV/TSV 识别英文、释义和备注表头，没有表头时第一列英文、第二列释义、第三列备注。JSON 接受字符串数组或单项目 rows。完整多项目备份仍用左侧恢复入口。

导入前预览前 50 条及总数，确认后全部显示，可选择创建以文件命名的新项目或追加到当前项目，默认保留重复，可勾选去重。默认补全空白释义；已有释义不覆盖。所有导入内容在查词前先保存。批量补全串行运行，可停止，切换项目时停止；网络额度耗尽后不重复请求。句子支持常见英文标点，在线服务每条超过 500 字节明确提示拆分。文本域支持换行显示长句。

DOCX 在本地解压读取 word/document.xml，按实际段落和手动换行分行；Word 自动折行不会形成条目，表格每个单元格内的段落分别导入。加密文档、旧 DOC、PDF 和扫描图片不支持；请先另存为 TXT。DOCX deflate-raw 解压依赖浏览器 DecompressionStream，不支持时有转换提示。单文件最大 25MB、每次最多 10,000 条；超过时明确拒绝，不悄悄截断。文件读取不上传，未收录短语/句子只有在启用在线开关后才发送至 MyMemory。

当前 26 项测试通过（`node --test tests/*.test.cjs`），新增分行/编码/去重/CSV 往返/JSON/DOCX 解压及段落/串行补全测试。尚未进行浏览器视觉、文件选择器及真实网络端到端验证。
