# Realistic Browser-Native Markdown Extraction Engine (Inspired by MarkItDown)

Implementing a robust document-to-markdown conversion tool natively in the browser requires acknowledging the strict memory, runtime, and asynchronous constraints of modern web environments (especially on mobile devices).

While porting Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) directly via Pyodide seems appealing, it assumes unlimited RAM, synchronous Python execution, and local filesystem access. This leads to crashes, deadlocks, and slow performance, particularly for large PDFs or ML models.

Instead of trying to run the entire MarkItDown Python package in WebAssembly, a much more realistic, performant, and reliable architecture is a **Browser-Native Extraction Pipeline**. In this model, we use highly optimized JS-native libraries to extract structured text, and only rely on formatting or optional ML pipelines as independent steps.

## Licensing Verification
*   **PDF.js**: Apache 2.0
*   **Mammoth.js**: BSD-2-Clause
*   **SheetJS**: Community Edition (Apache 2.0) is commercially usable. Stick to this for basic spreadsheet → markdown, as advanced features require the paid Pro version.
*   **Transformers.js**: Apache 2.0
*   **Tesseract.js**: Apache 2.0
*   **unified/remark**: MIT

## The Ideal Browser-Native Architecture

Instead of `File → MarkItDown (Python) → Markdown`, we use:
`File → JS-Native Extraction → Structured Text → Markdown Formatting/Cleanup`

### Web Worker Architecture

To prevent UI blocking, we utilize Web Workers:
```
Main Thread:
  ↓ File Upload & Format Detection (MIME type / fallback to extension)
  ↓ Route to Extraction Worker

Extraction Worker:
  ↓ PDF.js / Mammoth / SheetJS
  ↓ Structured Text Output / Images as base64
  ↓ Progress Reporting back to Main Thread

OCR Worker (optional):
  ↓ Tesseract.js / Transformers.js
  ↓ Merged Text Output

Formatting Thread:
  ↓ remark / unified
  ↓ Final Markdown
```

### Recommended Tools per File Type

| File Type        | Recommended Tool                | Notes                                    |
| ---------------- | ------------------------------- | ---------------------------------------- |
| **PDF**          | PDF.js                          | Faster, memory-optimized, browser-native |
| **DOCX / PPTX**  | Mammoth.js                      | Directly to semantic HTML/Markdown       |
| **XLSX**         | SheetJS                         | Directly to markdown tables              |
| **HTML**         | DOMParser                       | Native browser API                       |
| **OCR / Images** | Transformers.js or Tesseract.js | Run in a separate Web Worker             |
| **Formatting**   | unified / remark ecosystem      | JS-native markdown cleanup               |

## Phased Execution Plan

### Phase 1: Realistic MVP (No PDFs, No OCR)
Support basic document formats using pure JavaScript libraries. This is highly achievable, fast, and mobile-friendly.
* **Supported Formats**: DOCX, XLSX, PPTX, HTML, TXT, Markdown
* **File Handling**: Limit max file size (e.g., 10MB). Support UTF-8, UTF-16.
* **Approach**: Use Mammoth.js for DOCX, SheetJS for XLSX, and native DOM APIs for HTML.
* **Benefits**: No Pyodide needed, small bundle size, low RAM usage.

### Phase 2: Lightweight PDFs
PDFs are the biggest danger zone for memory issues.
* **Approach**: Use Mozilla's battle-tested `PDF.js` entirely in JavaScript.
* **Process**: Extract text and basic layout externally, then pass the extracted text into the formatting pipeline. Process large files in chunks (e.g., 10 pages at a time) to yield to the main thread.
* **Extraction Nuances**: Use heuristics to detect tables (bounding box analysis). Detect if PDF is scanned (low text/image ratio) to trigger OCR warnings. Extract images as base64 and insert as `![alt](data:image/png;base64,...)`.
* **Benefits**: Avoids `pdfminer.six` inside Wasm, which consumes excessive RAM and crashes mobile browsers.

### Phase 3: OCR (Optional Enhancement)
Do not force OCR to run synchronously inside a Python Wasm thread.
* **Approach**: Use a separate JS-native ML worker (e.g., Tesseract.js for mobile, Transformers.js with `Xenova/trocr-base-handwritten` for desktop).
* **Process**:
  1. Trigger logic: Auto-enable OCR if text length is low but image count is high.
  2. JS extracts images.
  3. JS sends tasks to the OCR worker (with a timeout, e.g., 60s per page).
  4. JS injects OCR text into the markdown stream.
* **Benefits**: Avoids Python ↔ JS synchronous lockups and deadlocks. Keeps the main thread clean.

### Phase 4: Advanced AI Enrichment
Things like image captioning, semantic structuring, and table understanding.
* **Approach**: Treat these as optional plugins. Use lightweight WebGPU models like Florence-2 (Apache 2.0 license) only on capable desktop environments (detect device memory > 4GB and not mobile).

## Error Handling & Progress

*   **Corrupted file detection** and early exit.
*   **Timeout limits** (e.g., 30s for standard extraction, 60s for OCR).
*   **Graceful degradation**: If OCR fails or times out, return raw text or a placeholder.
*   **Progress reporting**: Workers emit events (e.g., `{ type: 'progress', stage: 'extracting', percent: 45 }`) for UI updates.
*   **Hybrid Approach**: For enterprise-grade accuracy, if client-side extraction confidence is low (< 80%), optionally offer to send to a server-side MarkItDown API.

## Why this works better than Pyodide MarkItDown

1. **Async Orchestration**: JS orchestrates everything asynchronously without needing complex Python `run_until_complete` hacks.
2. **Memory Efficiency**: Browser file buffers aren't needlessly copied into a Pyodide MEMFS, reducing memory duplication.
3. **Mobile Support**: Pure JS tools and Web Workers run reliably on iOS Safari and Android Chrome, whereas full Pyodide + WebGPU ML models often get killed by mobile OS memory watchdogs.

By treating MarkItDown as an inspiration for semantic formatting rather than an extraction engine, you can build a stable, fast, and truly browser-only converter.
