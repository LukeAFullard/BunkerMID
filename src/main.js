const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const output = document.getElementById('output');
const loader = document.getElementById('loader');

import ExtractionWorker from './extraction.worker.js?worker';
let extractionWorker = new ExtractionWorker();

extractionWorker.onmessage = (e) => {
  const { type, payload, error } = e.data;
  if (type === 'SUCCESS') {
    output.value = payload;
    loader.style.display = 'none';
  } else if (type === 'ERROR') {
    output.value = 'Error: ' + error;
    loader.style.display = 'none';
  } else if (type === 'PROGRESS') {
    loader.innerText = payload;
  }
};

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = '#e9ecef';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.background = '#f8f9fa';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = '#f8f9fa';
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
});

function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    output.value = 'Error: File too large (max 10MB)';
    return;
  }
  loader.style.display = 'block';
  loader.innerText = 'Extracting data...';
  output.value = '';

  extractionWorker.postMessage({ file, type: file.name.split('.').pop().toLowerCase() });
}
