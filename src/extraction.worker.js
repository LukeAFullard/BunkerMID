self.addEventListener('error', (e) => {
  self.postMessage({ type: 'ERROR', error: "Extraction worker critical error: " + (e.message || "unknown error"), isSystemError: true });
});

self.addEventListener('unhandledrejection', (e) => {
  self.postMessage({ type: 'ERROR', error: "Extraction worker unhandled rejection: " + (e.reason ? e.reason.message || e.reason : "unknown reason"), isSystemError: true });
});

import * as mammoth from 'mammoth/mammoth.browser.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const markitdownWorker = new Worker(new URL('./markitdown.worker.js', import.meta.url), { type: 'module' });

const taskMap = new Map();
let nextTaskId = 1;

markitdownWorker.onmessage = (e) => {
  const { type, payload, error, taskId } = e.data;
  if (type === 'READY') {
    console.log("MarkItDown worker is ready");
    self.postMessage({ type: "READY" });
    return;
  }
  if (type === 'ERROR' && !taskId) {
    console.error("MarkItDown worker failed to initialize", error);
    self.postMessage({ type: "ERROR", error, isSystemError: true });
    return;
  }

  if (type === 'PROGRESS' && !taskId) {
    self.postMessage({ type: "PROGRESS", payload });
    return;
  }

  if (e.data === undefined) {
    return;
  }

  if (taskId && taskMap.has(taskId)) {
    const { resolve, reject } = taskMap.get(taskId);
    taskMap.delete(taskId);
    if (type === 'SUCCESS') {
      resolve(payload);
    } else if (type === 'ERROR') {
      reject(new Error(error));
    }
  }
};

markitdownWorker.onerror = (err) => {
  const errMsg = err.message || "Failed to load worker script (Check adblockers or network connectivity)";
  self.postMessage({ type: "ERROR", error: "Worker script error: " + errMsg, isSystemError: true });
};

self.onmessage = async (e) => {
  const { file, type } = e.data;

  try {
    let extractedContent = null;
    let format = 'html';

    if (type === 'docx') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting DOCX...' });
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      extractedContent = result.value; // The generated HTML
    }
    else if (type === 'xlsx' || type === 'csv') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting XLSX...' });
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // Convert first sheet to HTML
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      extractedContent = XLSX.utils.sheet_to_html(worksheet);
    }
    else if (type === 'pptx') {
      self.postMessage({ type: 'PROGRESS', payload: 'Extracting PPTX...' });
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
      self.postMessage({ type: 'PROGRESS', payload: 'Reading HTML...' });
      extractedContent = await file.text();
    }
    else if (type === 'txt') {
      self.postMessage({ type: 'PROGRESS', payload: 'Reading TXT...' });
      extractedContent = await file.text();
      format = 'txt';
    }
    else {
      throw new Error("Unsupported file type: " + type);
    }

    self.postMessage({ type: 'PROGRESS', payload: 'Formatting with MarkItDown...' });

    const markdown = await new Promise((resolve, reject) => {
      const taskId = nextTaskId++;
      taskMap.set(taskId, { resolve, reject });
      markitdownWorker.postMessage({ taskId, content: extractedContent, format });
    });

    self.postMessage({ type: 'SUCCESS', payload: markdown });
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
