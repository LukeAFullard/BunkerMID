# Realistic Browser-Native Markdown Extraction Engine (Powered by MarkItDown)

Implementing a robust document-to-markdown conversion tool natively in the browser requires acknowledging the strict memory, runtime, and asynchronous constraints of modern web environments (especially on mobile devices).

While porting Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) *entirely* via Pyodide seems appealing, its internal file-extraction dependencies (like `pdfminer.six`) assume unlimited RAM and local filesystem access. This leads to crashes, deadlocks, and slow performance, particularly for large PDFs or ML models.

## The Role of Microsoft MarkItDown

**Microsoft MarkItDown is undeniably the best product on the market for semantic markdown generation.** Its true value lies in its document structure handling, normalization, cleanup, and intelligent formatting—not necessarily in how it reads bytes from a PDF.

To bring MarkItDown to the browser successfully, we use a **Hybrid Architecture**. We replace MarkItDown's heavy, server-bound extraction libraries with lightweight JS-native tools, but we **still use MarkItDown in Pyodide** for the final, best-in-class formatting and semantic organization.

Instead of `File → MarkItDown handles everything (Crashes)`, we use:
`File → JS-Native Extraction (Fast & Safe) → Structured Text → MarkItDown in Pyodide (Superior Formatting)`

## Licensing Verification
*   **PDF.js**: Apache 2.0
*   **Mammoth.js**: BSD-2-Clause
*   **SheetJS**: Community Edition (Apache 2.0) is commercially usable. Stick to this for basic spreadsheet → markdown, as advanced features require the paid Pro version.
*   **Transformers.js**: Apache 2.0
*   **Tesseract.js**: Apache 2.0
*   **Microsoft MarkItDown**: MIT

## The Ideal Browser-Native Architecture

### Web Worker Architecture

To prevent UI blocking, we utilize Web Workers:
```
Main Thread:
  ↓ File Upload & Format Detection (MIME type / fallback to extension)
  ↓ Route to Extraction Worker

Extraction Worker (Pure JS - Fast & Stable):
  ↓ PDF.js / Mammoth / SheetJS
  ↓ Structured Text Output / Images as base64
  ↓ Progress Reporting back to Main Thread

OCR Worker (optional JS - Fast & Stable):
  ↓ Tesseract.js / Transformers.js
  ↓ Merged Text Output

MarkItDown Worker (Pyodide - Superior Quality):
  ↓ Receives pre-extracted structured text
  ↓ Microsoft MarkItDown formatting heuristics & cleanup
  ↓ Final High-Quality Markdown
```

### Recommended Extraction Tools per File Type

| File Type        | Recommended Extraction Tool     | Notes                                    |
| ---------------- | ------------------------------- | ---------------------------------------- |
| **PDF**          | PDF.js                          | Faster, memory-optimized, browser-native |
| **DOCX / PPTX**  | Mammoth.js                      | Extracts semantic HTML                   |
| **XLSX**         | SheetJS                         | Extracts basic tables                    |
| **HTML**         | DOMParser                       | Native browser API                       |
| **OCR / Images** | Transformers.js or Tesseract.js | Run in a separate Web Worker             |
| **Formatting**   | **Microsoft MarkItDown**        | Runs in Pyodide (Wasm) on extracted text |

## Phased Execution Plan

### Phase 1: Realistic MVP (No PDFs, No OCR)
Support basic document formats using pure JavaScript libraries for extraction, then route to MarkItDown for formatting.
* **Supported Formats**: DOCX, XLSX, PPTX, HTML, TXT
* **File Handling**: Limit max file size (e.g., 10MB). Support UTF-8, UTF-16.
* **Approach**: Use Mammoth.js for DOCX, SheetJS for XLSX. Pass output to MarkItDown in Pyodide.

### Phase 2: Lightweight PDFs
PDFs are the biggest danger zone for memory issues.
* **Approach**: Use Mozilla's battle-tested `PDF.js` entirely in JavaScript for extraction.
* **Process**: Extract text and basic layout externally. Process large files in chunks (e.g., 10 pages at a time) to yield to the main thread. Once extracted, pass the raw text structure to MarkItDown in Pyodide for formatting.
* **Extraction Nuances**: Use heuristics to detect tables (bounding box analysis). Detect if PDF is scanned (low text/image ratio) to trigger OCR warnings. Extract images as base64.

### Phase 3: OCR (Optional Enhancement)
Do not force OCR to run synchronously inside a Python Wasm thread.
* **Approach**: Use a separate JS-native ML worker (e.g., Tesseract.js for mobile, Transformers.js with `Xenova/trocr-base-handwritten` for desktop).
* **Process**:
  1. Trigger logic: Auto-enable OCR if text length is low but image count is high.
  2. JS extracts images.
  3. JS sends tasks to the OCR worker (with a timeout, e.g., 60s per page).
  4. JS injects OCR text into the MarkItDown stream for semantic placement.

### Phase 4: Advanced AI Enrichment
Things like image captioning, semantic structuring, and table understanding.
* **Approach**: Treat these as optional plugins. Use lightweight WebGPU models like Florence-2 (Apache 2.0 license) only on capable desktop environments (detect device memory > 4GB and not mobile).

## Error Handling & Progress

*   **Corrupted file detection** and early exit.
*   **Timeout limits** (e.g., 30s for standard extraction, 60s for OCR).
*   **Graceful degradation**: If OCR fails or times out, return raw text or a placeholder.
*   **Progress reporting**: Workers emit events (e.g., `{ type: 'progress', stage: 'extracting', percent: 45 }`) for UI updates.
*   **Enterprise Hybrid Approach**: For absolute maximum fidelity, if client-side JS extraction confidence is low (< 80%), or for unsupported complex formats, offer to send the file to a standard server-side deployment of Microsoft MarkItDown via API.

## Summary

By using fast JS libraries to extract the data, and **Microsoft MarkItDown** inside WebAssembly to format the data, we achieve the exact output quality of the market leader, but with the performance, privacy, and stability of a pure browser-native application.
