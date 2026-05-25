import mammoth from 'mammoth/mammoth.browser.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Suppress the fake worker warning as we are already in a worker
const originalWarn = console.warn;
console.warn = function (msg) {
  if (msg && typeof msg === 'string' && msg.includes('Setting up fake worker')) {
    return;
  }
  originalWarn.apply(console, arguments);
};

self.addEventListener('error', (e) => {
  self.postMessage({ type: 'ERROR', error: "Extraction worker critical error: " + (e.message || "unknown error"), isSystemError: true });
});

self.addEventListener('unhandledrejection', (e) => {
  self.postMessage({ type: 'ERROR', error: "Extraction worker unhandled rejection: " + (e.reason ? e.reason.message || e.reason : "unknown reason"), isSystemError: true });
});


self.onmessage = async (e) => {
  const { file, type } = e.data;

  try {
    let extractedContent = null;
    let format = 'html';

    if (type === 'docx') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting DOCX (30%)...', progress: 30 });
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      extractedContent = result.value; // The generated HTML
    }
    else if (type === 'xlsx' || type === 'csv') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting XLSX (30%)...', progress: 30 });
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // Convert first sheet to HTML
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      extractedContent = XLSX.utils.sheet_to_html(worksheet);
    }
    else if (type === 'pptx') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting PPTX (30%)...', progress: 30 });
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let text = "";

      const slideFiles = Object.keys(zip.files).filter(name => name.match(/ppt\/slides\/slide\d+\.xml/));
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const xml = await zip.files[slideFile].async("text");
        const matches = xml.matchAll(/<a:t.*?>(.*?)<\/a:t>/g);
        let slideText = "";
        for (const match of matches) {
          slideText += match[1] + " ";
        }
        if (slideText.trim()) {
          text += `<h2>Slide ${i + 1}</h2>\n<p>${slideText}</p>\n`;
        }
      }
      extractedContent = text;
    }
    else if (type === 'html' || type === 'htm') {
      self.postMessage({ type: 'PROGRESS', payload: 'Reading HTML (30%)...', progress: 30 });
      extractedContent = await file.text();
    }
    else if (type === 'txt') {
      self.postMessage({ type: 'PROGRESS', payload: 'Reading TXT (30%)...', progress: 30 });
      extractedContent = await file.text();
      format = 'txt';
    }
    else if (type === 'pdf') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting PDF (30%)...', progress: 30 });
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + "\n\n";
      }
      extractedContent = text;
      format = 'txt';
    }
    else {
      throw new Error("Unsupported file type: " + type);
    }

    self.postMessage({ type: 'EXTRACTION_SUCCESS', payload: { content: extractedContent, format } });
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
