const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const output = document.getElementById('output');
const loaderContainer = document.getElementById('loader-container');
const loader = document.getElementById('loader');
const progressBar = document.getElementById('progress-bar');
const downloadBtn = document.getElementById('download-btn');
const dropText = document.getElementById('drop-text');

const extractionWorker = new Worker(new URL('./extraction.worker.js', import.meta.url));
const markitdownWorker = new Worker(new URL('./markitdown.worker.js', import.meta.url));

let currentFileName = 'document';
let isExtracting = false;
let initTimeout = null;
let currentTaskId = 1;

// Fallback timeout to ensure we don't hang silently if the worker fails to even start parsing
initTimeout = setTimeout(() => {
  dropZone.classList.add('disabled');
  dropText.innerText = 'Error: Worker initialization timed out. Please check your browser compatibility or adblockers.';
}, 10000);

markitdownWorker.onmessage = (e) => {
  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }

  const { type, payload, error, isSystemError } = e.data;
  if (type === 'READY') {
    dropZone.classList.remove('disabled');
    fileInput.disabled = false;
    dropText.innerText = 'Drag and drop a file here, or click to select';
    return;
  }

  if (type === 'ERROR') {
    if (isSystemError || !isExtracting) {
      dropZone.classList.add('disabled');
      fileInput.disabled = true;
      dropText.innerText = 'Error: ' + error;
      return;
    } else {
      output.value = 'Error: ' + error;
      loaderContainer.style.display = 'none';
      progressBar.value = 100;
      downloadBtn.disabled = true;
      isExtracting = false;
      return;
    }
  }

  if (type === 'SUCCESS') {
    output.value = payload;
    loaderContainer.style.display = 'none';
    progressBar.value = 100;
    downloadBtn.disabled = false;
    isExtracting = false;
  } else if (type === 'PROGRESS') {
    if (!isExtracting) {
      dropText.innerText = payload;
    } else {
      loader.innerText = payload;
      if (payload.includes('Extracting') || payload.includes('Reading')) {
        progressBar.value = 30;
      } else if (payload.includes('Formatting')) {
        progressBar.value = 70;
      }
    }
  }
};

markitdownWorker.onerror = (err) => {
  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }
  dropZone.classList.add('disabled');
  dropText.innerText = 'Error loading markitdown worker: ' + (err.message || "Failed to load worker script");
};

extractionWorker.onmessage = (e) => {
  const { type, payload, error, isSystemError } = e.data;

  if (type === 'EXTRACTION_SUCCESS') {
    // Send to markitdown worker for formatting
    const taskId = currentTaskId++;
    markitdownWorker.postMessage({ taskId, content: payload.content, format: payload.format });
  } else if (type === 'ERROR') {
    if (isSystemError || !isExtracting) {
      dropZone.classList.add('disabled');
      fileInput.disabled = true;
      dropText.innerText = 'Error: ' + error;
    } else {
      output.value = 'Error: ' + error;
      loaderContainer.style.display = 'none';
      progressBar.value = 100;
      downloadBtn.disabled = true;
      isExtracting = false;
    }
  } else if (type === 'PROGRESS') {
    if (!isExtracting) {
      dropText.innerText = payload;
    } else {
      loader.innerText = payload;
      if (payload.includes('Extracting') || payload.includes('Reading')) {
        progressBar.value = 30;
      } else if (payload.includes('Formatting')) {
        progressBar.value = 70;
      }
    }
  }
};

extractionWorker.onerror = (err) => {
  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }
  dropZone.classList.add('disabled');
  dropText.innerText = 'Error loading extraction worker: ' + (err.message || "Failed to load worker script");
};



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
  // Reset so the same file can be selected again
  e.target.value = '';
});

downloadBtn.addEventListener('click', () => {
  const text = output.value;
  if (!text) return;
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentFileName}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    output.value = 'Error: File too large (max 10MB)';
    return;
  }
  loaderContainer.style.display = 'block';
  progressBar.value = 10;
  loader.innerText = 'Extracting data...';
  output.value = '';
  downloadBtn.disabled = true;

  isExtracting = true;
  currentFileName = file.name.replace(/\.[^/.]+$/, "");
  extractionWorker.postMessage({ file, type: file.name.split('.').pop().toLowerCase() });
}
