self.addEventListener("error",t=>{self.postMessage({type:"ERROR",error:"Worker critical error: "+(t.message||"unknown error"),isSystemError:!0})});self.addEventListener("unhandledrejection",t=>{self.postMessage({type:"ERROR",error:"Worker unhandled rejection: "+(t.reason?t.reason.message||t.reason:"unknown reason"),isSystemError:!0})});let a=null;async function n(){self.postMessage({type:"PROGRESS",payload:"Loading Pyodide runtime (25%)..."});let t;try{t=(await import("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs")).loadPyodide}catch(e){throw self.postMessage({type:"ERROR",error:"Failed to dynamically import Pyodide: "+e.message,isSystemError:!0}),e}let s;try{s=await t({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"})}catch(e){throw self.postMessage({type:"ERROR",error:"Failed to initialize Pyodide: "+e.message,isSystemError:!0}),e}try{self.postMessage({type:"PROGRESS",payload:"Loading Python package manager (50%)..."}),await s.loadPackage("micropip")}catch(e){throw self.postMessage({type:"ERROR",error:"Failed to load micropip: "+e.message,isSystemError:!0}),e}try{self.postMessage({type:"PROGRESS",payload:"Installing Core Dependencies (75%)..."}),await s.runPythonAsync(`
import micropip
import sys

# Install core dependencies of MarkItDown
await micropip.install(["beautifulsoup4", "charset-normalizer", "defusedxml", "markdownify", "requests", "urllib3", "certifi", "idna", "six", "soupsieve"])

# Mock Magika to avoid onnxruntime issues
class MockMagikaOutput:
    def __init__(self):
        self.mime_type = "text/html"
        self.label = "html"
        self.is_text = True
        self.group = "text"
        self.extensions = ["html"]
        self.description = "HTML document"

class MockMagikaPrediction:
    def __init__(self):
        self.output = MockMagikaOutput()

class MockMagikaResult:
    def __init__(self):
        self.output = MockMagikaOutput()
        self.status = "ok"
        self.prediction = MockMagikaPrediction()

class MockMagikaInstance:
    def identify_bytes(self, data):
        return MockMagikaResult()
    def identify_stream(self, stream):
        return MockMagikaResult()

class MockMagikaModule:
    Magika = MockMagikaInstance

sys.modules['magika'] = MockMagikaModule()

# Install MarkItDown without dependencies (since we mocked magika)
await micropip.install("markitdown", deps=False)
  `)}catch(e){throw self.postMessage({type:"ERROR",error:"Failed to install Python dependencies: "+e.message,isSystemError:!0}),e}try{self.postMessage({type:"PROGRESS",payload:"Initializing MarkItDown Engine (90%)..."}),await s.runPythonAsync(`
from markitdown import MarkItDown
import io

md = MarkItDown()

def convert_content(content, format="html"):
    stream = io.BytesIO(content.encode('utf-8'))
    ext = "." + format
    result = md.convert_stream(stream, file_extension=ext)
    return result.text_content
    `)}catch(e){throw self.postMessage({type:"ERROR",error:"Failed to initialize MarkItDown Engine: "+e.message,isSystemError:!0}),e}return s}a=n().then(t=>(self.postMessage({type:"READY"}),t)).catch(t=>{console.error("Pyodide init failed:",t),self.postMessage({type:"ERROR",error:"Pyodide init failed: "+t.message})});self.onmessage=async t=>{const{content:s,format:e,taskId:o}=t.data;try{const r=await a;self.postMessage({type:"PROGRESS",payload:"Formatting Markdown (70%)...",progress:70,taskId:o}),r.globals.set("current_content",s),r.globals.set("current_format",e);const i=await r.runPythonAsync("convert_content(current_content, current_format)");self.postMessage({type:"SUCCESS",payload:i,taskId:o})}catch(r){self.postMessage({type:"ERROR",error:r.message,taskId:o})}};
