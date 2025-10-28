// script.js - client-side logic

const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const proceedBtn = document.getElementById('proceedBtn');
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let uploadedFiles = []; // {id, file, name, arrayBuffer}
let currentFileIndex = -1;
let currentPage = 1;
let currentPdfDoc = null; // pdf.js document for preview
let pdfScale = 1.2;

// Rects stored relative to rendered canvas size
let rects = []; // {id, x, y, w, h, padding, radius, fontSize, color, text}
let selectedRectId = null;

const pdfCanvas = document.getElementById('pdfCanvas');
const overlay = document.getElementById('overlay');
const thumbs = document.getElementById('thumbs');
const recentList = document.getElementById('recentList');
const currentPageLabel = document.getElementById('currentPageLabel');

const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const addRectBtn = document.getElementById('addRectBtn');
const clearRectsBtn = document.getElementById('clearRectsBtn');
const paddingControl = document.getElementById('paddingControl');
const radiusControl = document.getElementById('radiusControl');
const fontSizeControl = document.getElementById('fontSizeControl');
const colorControl = document.getElementById('colorControl');
const replacementText = document.getElementById('replacementText');
const replaceBtn = document.getElementById('replaceBtn');

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    const id = crypto.randomUUID();
    const ab = await f.arrayBuffer();
    uploadedFiles.push({ id, file: f, name: f.name, arrayBuffer: ab });
  }
  renderFileList();
  proceedBtn.disabled = uploadedFiles.length === 0;
});

function renderFileList() {
  fileListEl.innerHTML = '';
  uploadedFiles.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `<div class="file-name" title="${f.name}">${f.name}</div>
      <div class="file-actions">
        <button class="btn" data-idx="${idx}" title="Edit">✏️</button>
        <button class="btn danger" data-delete="${idx}" title="Remove">🗑</button>
      </div>`;
    fileListEl.appendChild(row);
    
    row.querySelector('[data-idx]')?.addEventListener('click', () => {
      currentFileIndex = idx;
      openEditorForFile(idx);
    });
    row.querySelector('[data-delete]')?.addEventListener('click', () => {
      uploadedFiles.splice(idx, 1);
      renderFileList();
      if (uploadedFiles.length === 0) { proceedBtn.disabled = true }
    });
  });
}

proceedBtn.addEventListener('click', () => {
  if (uploadedFiles.length === 0) return;
  currentFileIndex = 0;
  openEditorForFile(0);
});

async function openEditorForFile(idx) {
  rects = [];
  selectedRectId = null;
  const f = uploadedFiles[idx];
  // load with pdf.js for preview
  currentPdfDoc = await pdfjsLib.getDocument({ data: f.arrayBuffer }).promise;
  currentPage = 1;
  renderPage(currentPage);
  renderThumbs();
}

async function renderPage(pageNum) {
  if (!currentPdfDoc) return;
  const page = await currentPdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: pdfScale });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  
  // make it scale visually but still keep coordinate mapping correct
  pdfCanvas.style.width = "100%";
  pdfCanvas.style.height = "auto";
  
  // sync overlay size after canvas draws
  overlay.style.width = pdfCanvas.offsetWidth + 'px';
  overlay.style.height = pdfCanvas.offsetHeight + 'px';
  overlay.innerHTML = '';
  const ctx = pdfCanvas.getContext('2d');
  ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  
  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;
  
  // prepare overlay size/position
  overlay.style.width = pdfCanvas.style.width;
  overlay.style.height = pdfCanvas.style.height;
  overlay.innerHTML = '';
  overlay.style.pointerEvents = 'auto';
  
  // draw rects for this preview (rects are global, shown on every page preview for demonstration)
  rects.forEach(r => createRectElement(r));
  
  currentPageLabel.textContent = `Page ${currentPage} / ${currentPdfDoc.numPages}`;
}

prevPageBtn.addEventListener('click', () => {
  if (!currentPdfDoc) return;
  if (currentPage > 1) currentPage--;
  renderPage(currentPage);
});
nextPageBtn.addEventListener('click', () => {
  if (!currentPdfDoc) return;
  if (currentPage < currentPdfDoc.numPages) currentPage++;
  renderPage(currentPage);
});

function renderThumbs() {
  thumbs.innerHTML = '';
  for (let i = 1; i <= currentPdfDoc.numPages; i++) {
    const c = document.createElement('canvas');
    c.className = 'thumb';
    c.width = 80;
    c.height = 100;
    thumbs.appendChild(c);
    // render small
    currentPdfDoc.getPage(i).then(page => {
      const vp = page.getViewport({ scale: 80 / page.getViewport({ scale: 1 }).width });
      const ctx = c.getContext('2d');
      c.width = vp.width;
      c.height = vp.height;
      page.render({ canvasContext: ctx, viewport: vp });
    });
  }
}

// --- Rectangle drawing ---
let drawing = false;
let startX = 0,
  startY = 0;

addRectBtn.addEventListener('click', () => {
  overlay.style.cursor = 'crosshair';
  overlay.addEventListener('mousedown', startDrawOnce, { once: true });
});

function startDrawOnce(e) {
  drawing = true;
  const rect = overlay.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  overlay.addEventListener('mousemove', drawingMove);
  overlay.addEventListener('mouseup', endDrawOnce, { once: true });
}

function drawingMove(e) {
  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = Math.abs(x - startX);
  const h = Math.abs(y - startY);
  const left = Math.min(x, startX);
  const top = Math.min(y, startY);
  overlay.innerHTML = '';
  const temp = document.createElement('div');
  temp.className = 'rect';
  temp.style.left = left + 'px';
  temp.style.top = top + 'px';
  temp.style.width = w + 'px';
  temp.style.height = h + 'px';
  overlay.appendChild(temp);
}

function endDrawOnce(e) {
  overlay.removeEventListener('mousemove', drawingMove);
  overlay.style.cursor = 'default';
  drawing = false;
  const rectBounds = overlay.firstElementChild.getBoundingClientRect();
  const parentBounds = overlay.getBoundingClientRect();
  const x = rectBounds.left - parentBounds.left;
  const y = rectBounds.top - parentBounds.top;
  const w = rectBounds.width;
  const h = rectBounds.height;
  // create rect object relative to canvas size
  const id = crypto.randomUUID();
  const r = {
    id,
    x,
    y,
    w,
    h,
    padding: Number(paddingControl.value) || 0,
    radius: Number(radiusControl.value) || 0,
    fontSize: Number(fontSizeControl.value) || 12,
    color: colorControl.value || '#064e3b',
    text: ''
  };
  rects.push(r);
  overlay.innerHTML = '';
  createRectElement(r);
}

function createRectElement(r) {
  const el = document.createElement('div');
  el.className = 'rect';
  el.dataset.id = r.id;
  el.style.left = r.x + 'px';
  el.style.top = r.y + 'px';
  el.style.width = r.w + 'px';
  el.style.height = r.h + 'px';
  el.style.borderRadius = r.radius + 'px';
  // click to edit text
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    selectedRectId = r.id;
    // populate controls
    paddingControl.value = r.padding;
    radiusControl.value = r.radius;
    fontSizeControl.value = r.fontSize;
    colorControl.value = r.color;
    const t = prompt('Enter replacement text for this rectangle (this text will be applied to all pages at same coords):', r.text || '');
    if (t !== null) r.text = t;
  });
  overlay.appendChild(el);
}

clearRectsBtn.addEventListener('click', () => {
  rects = [];
  overlay.innerHTML = '';
});

// live update controls for selected rect
[paddingControl, radiusControl, fontSizeControl, colorControl].forEach(ctrl => {
  ctrl.addEventListener('change', () => {
    if (!selectedRectId) return;
    const r = rects.find(x => x.id === selectedRectId);
    if (!r) return;
    r.padding = Number(paddingControl.value);
    r.radius = Number(radiusControl.value);
    r.fontSize = Number(fontSizeControl.value);
    r.color = colorControl.value;
    // reflect change visually
    const el = overlay.querySelector(`[data-id='${r.id}']`);
    if (el) el.style.borderRadius = r.radius + 'px';
  });
});

// clicking outside overlays deselects rect
overlay.addEventListener('click', () => { selectedRectId = null; });

// --- Replacement & merging logic using pdf-lib ---
replaceBtn.addEventListener('click', async () => {
  if (uploadedFiles.length === 0) { alert('No files'); return }
  const text = replacementText.value || '';
  // set each rect's text if empty
  rects.forEach(r => { if (!r.text) r.text = text; });
  if (rects.length === 0) { if (!text) { alert('No rectangles or text provided'); return } }
  
  // Build merged PDF
  const mergedPdf = await PDFLib.PDFDocument.create();
  
  for (const fileEntry of uploadedFiles) {
    const src = await PDFLib.PDFDocument.load(fileEntry.arrayBuffer);
    const pagesCount = src.getPageCount();
    for (let i = 0; i < pagesCount; i++) {
      const [copiedPage] = await mergedPdf.copyPages(src, [i]);
      mergedPdf.addPage(copiedPage);
    }
  }
  
  // Now for each page in mergedPdf, draw rectangles and text at exact coordinates relative to original rendered size
  // IMPORTANT: We used pdf.js preview scale to calculate rect coordinates; we must map those to PDF points.
  // We'll assume the PDF user sees is rendered at pdfScale; compute transform per page based on page size.
  
  // We'll iterate again through original uploaded files/pages to know their sizes and mapping
  let pageIndexOffset = 0;
  for (const fileEntry of uploadedFiles) {
    const src = await PDFLib.PDFDocument.load(fileEntry.arrayBuffer);
    const srcPages = src.getPages();
    for (let p = 0; p < srcPages.length; p++) {
      const srcPage = srcPages[p];
      const mergedPage = mergedPdf.getPage(pageIndexOffset + p);
      const { width: pdfWidth, height: pdfHeight } = srcPage.getSize();
      
      // Our preview canvas width/height correspond to pdf.js viewport for the same page at pdfScale.
      // Calculate scale factors between preview pixel coords and PDF points.
      // pdf.js viewport width = pdfWidth * pdfScale
      const previewWidth = pdfWidth * pdfScale;
      const previewHeight = pdfHeight * pdfScale;
      const scaleX = pdfWidth / previewWidth; // = 1/pdfScale
      const scaleY = pdfHeight / previewHeight;
      
      // For each rect add a white rectangle (cover) and then write text
      rects.forEach(r => {
        const xPdf = r.x * scaleX;
        // PDF origin is bottom-left. Our overlay y is top-left; convert
        const yPdf = pdfHeight - ((r.y + r.h) * scaleY);
        const wPdf = r.w * scaleX;
        const hPdf = r.h * scaleY;
        
        // cover area (optional: white fill)
        mergedPage.drawRectangle({
          x: xPdf - (r.padding * scaleX),
          y: yPdf - (r.padding * scaleY),
          width: wPdf + (2 * r.padding * scaleX),
          height: hPdf + (2 * r.padding * scaleY),
          color: PDFLib.rgb(1, 1, 1),
        });
        
        // draw text centered in rect
        const fontSize = r.fontSize;
        const textX = xPdf + (wPdf / 2);
        const textY = yPdf + (hPdf / 2) - (fontSize / 2);
        
        mergedPage.drawText(r.text || '', {
          x: textX,
          y: textY,
          size: fontSize,
          color: PDFLib.rgb(hexToRgb01(r.color)),
          xSkew: 0,
          xHeight: 0,
          rotate: undefined,
          // center horizontally
          // pdf-lib doesn't offer direct center; compute left by measuring text width if needed
        });
      });
    }
    pageIndexOffset += src.getPageCount();
  }
  
  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes], { type: 'application/pdf' });
  saveAs(blob, 'merged-replaced.pdf');
  
  // show recently downloaded
  const url = URL.createObjectURL(blob);
  const item = document.createElement('div');
  item.innerHTML = `<a href="${url}" target="_blank">merged-replaced.pdf</a>`;
  recentList.prepend(item);
  alert('Downloaded merged PDF — also shown under Recent actions');
});

function hexToRgb01(hex) {
  if (!hex || typeof hex !== "string") {
    // fallback: dark green
    return { r: 0.1, g: 0.4, b: 0.3 };
  }
  const match = hex.match(/^#?([a-f\d]{6})$/i);
  if (!match) {
    // fallback if not valid hex
    return { r: 0.1, g: 0.4, b: 0.3 };
  }
  const bigint = parseInt(match[1], 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}
// small helper: if user clicks a file row's edit button it opens that file
// (already wired above). Extra: clicking thumb navigates to that page
thumbs.addEventListener('click', (e) => {
  const c = e.target.closest('canvas');
  if (!c) return;
  const idx = Array.from(thumbs.children).indexOf(c);
  if (idx >= 0) {
    currentPage = idx + 1;
    renderPage(currentPage);
  }
});

// END of script.js