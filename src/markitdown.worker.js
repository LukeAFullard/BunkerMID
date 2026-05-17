import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs";

let pyodideReadyPromise = null;

async function initPyodide() {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
  });
  await pyodide.loadPackage("micropip");

  await pyodide.runPythonAsync(`
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

from markitdown import MarkItDown
import io

md = MarkItDown()

def convert_content(content, format="html"):
    stream = io.BytesIO(content.encode('utf-8'))
    ext = "." + format
    result = md.convert_stream(stream, file_extension=ext)
    return result.text_content
  `);
  return pyodide;
}

pyodideReadyPromise = initPyodide().then(pyodide => {
  self.postMessage({ type: 'READY' });
  return pyodide;
}).catch(err => {
  console.error("Pyodide init failed:", err);
  self.postMessage({ type: 'ERROR', error: "Pyodide init failed: " + err.message });
});

self.onmessage = async (e) => {
  const { content, format, taskId } = e.data;
  try {
    const pyodide = await pyodideReadyPromise;
    pyodide.globals.set("current_content", content);
    pyodide.globals.set("current_format", format);

    const result = await pyodide.runPythonAsync(`convert_content(current_content, current_format)`);

    self.postMessage({ type: 'SUCCESS', payload: result, taskId });
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message, taskId });
  }
};
