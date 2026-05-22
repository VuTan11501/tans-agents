const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"

export function buildCodeSandboxHtml(language: string, code: string): string {
  const lang = language.toLowerCase()

  if (lang === "html") return code
  if (lang === "css") return buildCssHtml(code)
  if (lang === "py" || lang === "python") return buildPythonHtml(code)

  const runnableCode = isTypeScriptLanguage(lang) ? stripTypeScript(code) : code
  return buildJavaScriptHtml(runnableCode)
}

function buildJavaScriptHtml(code: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{font:13px monospace;margin:8px;color:#0a0a0a}.err{color:#dc2626}</style></head>
<body><div id="out"></div><script>
const out=document.getElementById('out');
function w(t,cls){const d=document.createElement('div');if(cls)d.className=cls;d.textContent=t;out.appendChild(d)}
const orig={log:console.log,error:console.error,warn:console.warn};
console.log=(...a)=>{w(a.map(String).join(' '));parent.postMessage({sb:'log',v:a.map(String).join(' ')},'*')};
console.error=(...a)=>{w(a.map(String).join(' '),'err');parent.postMessage({sb:'err',v:a.map(String).join(' ')},'*')};
console.warn=console.log;
window.onerror=(m)=>{w(String(m),'err');parent.postMessage({sb:'err',v:String(m)},'*')};
try{ ${escapeClosingScript(code)} }catch(e){console.error(e.message||String(e))}
</script></body></html>`
}

function buildPythonHtml(code: string): string {
  const pyCode = JSON.stringify(code)
  return buildJavaScriptHtml(`
(async()=>{
  console.log('Đang tải Python (Pyodide)...');
  const script=document.createElement('script');
  script.src=${JSON.stringify(PYODIDE_CDN)};
  script.onload=async()=>{
    try{
      const pyodide=await loadPyodide();
      pyodide.setStdout({batched:(text)=>console.log(text)});
      pyodide.setStderr({batched:(text)=>console.error(text)});
      await pyodide.runPythonAsync(${pyCode});
    }catch(e){console.error(e.message||String(e))}
  };
  script.onerror=()=>console.error('Không tải được Pyodide');
  document.body.appendChild(script);
})()
`)
}

function buildCssHtml(code: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${escapeStyleContent(code)}</style></head><body><div class="demo">Demo</div></body></html>`
}

function stripTypeScript(code: string): string {
  return code
    .replace(/\binterface\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[^{}]+)?\s*\{[^{}]*\}\s*/gs, "")
    .replace(/^\s*type\s+[A-Za-z_$][\w$]*(?:<[^>]+>)?\s*=\s*[^;]+;?\s*$/gm, "")
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,\s\[\]{}|&?.]*/g, "")
    .replace(/:\s*[A-Za-z_$][\w$<>,\s\[\]{}|&?.]*(?=\s*[,)=;])/g, "")
}

function isTypeScriptLanguage(language: string): boolean {
  return language === "ts" || language === "tsx" || language === "typescript"
}

function escapeClosingScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script")
}

function escapeStyleContent(code: string): string {
  return code.replace(/<\/style/gi, "<\\/style")
}
