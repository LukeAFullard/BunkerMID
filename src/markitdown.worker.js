self.addEventListener('error', (e) => {
  self.postMessage({ type: 'ERROR', error: "Worker critical error: " + (e.message || "unknown error"), isSystemError: true });
});

self.addEventListener('unhandledrejection', (e) => {
  self.postMessage({ type: 'ERROR', error: "Worker unhandled rejection: " + (e.reason ? e.reason.message || e.reason : "unknown reason"), isSystemError: true });
});

let pyodideReadyPromise = null;

// Send heartbeat so main thread doesn't time out during slow downloads
const heartbeatInterval = setInterval(() => {
  self.postMessage({ type: 'PROGRESS', payload: 'Downloading AI extraction engine (~10MB)...' });
}, 5000);

async function initPyodide() {
  self.postMessage({ type: 'PROGRESS', payload: 'Loading Pyodide runtime...' });

  let loadPyodide;
  try {
    // Dynamically import Pyodide
    const pyodideModule = await import("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs");
    loadPyodide = pyodideModule.loadPyodide;
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: "Failed to dynamically import Pyodide: " + err.message, isSystemError: true });
    throw err;
  }

  let pyodide;
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
    });
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: "Failed to initialize Pyodide: " + err.message, isSystemError: true });
    throw err;
  }

  try {
    self.postMessage({ type: 'PROGRESS', payload: 'Loading Python package manager (micropip)...' });
    await pyodide.loadPackage("micropip");
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: "Failed to load micropip: " + err.message, isSystemError: true });
    throw err;
  }

  try {
    self.postMessage({ type: 'PROGRESS', payload: 'Installing Core Dependencies...' });
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
  `);
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: "Failed to install Python dependencies: " + err.message, isSystemError: true });
    throw err;
  }

  try {
    self.postMessage({ type: 'PROGRESS', payload: 'Initializing MarkItDown Engine...' });
    await pyodide.runPythonAsync(`
from markitdown import MarkItDown
import io

md = MarkItDown()

def convert_content(content, format="html"):
    stream = io.BytesIO(content.encode('utf-8'))
    ext = "." + format
    result = md.convert_stream(stream, file_extension=ext)
    return result.text_content
    `);
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: "Failed to initialize MarkItDown Engine: " + err.message, isSystemError: true });
    throw err;
  }

  return pyodide;
}

pyodideReadyPromise = initPyodide().then(pyodide => {
  clearInterval(heartbeatInterval);
  self.postMessage({ type: 'READY' });
  return pyodide;
}).catch(err => {
  clearInterval(heartbeatInterval);
  console.error("Pyodide init failed:", err);
  self.postMessage({ type: 'ERROR', error: "Pyodide init failed: " + err.message, isSystemError: true });
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
