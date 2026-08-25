/**
 * CROQUI WEB - PDF VIEWER MODAL CONTROLLER
 * Renderizador de PDFs responsivo com PDF.js e Touch Zoom Engine
 */

window.PdfViewer = (function() {
  const modal = document.getElementById('modal-pdf-viewer');
  const iframe = document.getElementById('pdf-iframe');
  const canvas = document.getElementById('pdf-canvas');
  const viewportWrapper = document.getElementById('pdf-viewport-wrapper');
  const spinner = document.getElementById('pdf-loading-spinner');
  
  const titleEl = document.getElementById('pdf-viewer-title');
  const sizeEl = document.getElementById('pdf-viewer-size');
  const zoomLevelEl = document.getElementById('pdf-zoom-level');
  
  const downloadBtn = document.getElementById('btn-pdf-modal-download');
  const qrBtn = document.getElementById('btn-pdf-modal-qr');
  const closeBtn = document.getElementById('btn-close-pdf');
  
  const zoomInBtn = document.getElementById('btn-pdf-zoom-in');
  const zoomOutBtn = document.getElementById('btn-pdf-zoom-out');
  const zoomResetBtn = document.getElementById('btn-pdf-zoom-reset');
  
  const pageControlsEl = document.getElementById('pdf-page-controls');
  const prevPageBtn = document.getElementById('btn-pdf-prev-page');
  const nextPageBtn = document.getElementById('btn-pdf-next-page');
  const pageNumEl = document.getElementById('pdf-page-num');

  // PDF.js State
  let currentCroqui = null;
  let pdfDoc = null;
  let pageNum = 1;
  let renderTask = null;

  // Zoom & Pan State
  let scale = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // Touch Pinch State
  let startPinchDist = 0;
  let startPinchScale = 1.0;

  // Configure PDF.js Worker if library is loaded
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function resetZoomPan() {
    scale = 1.0;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function applyTransform() {
    if (!canvas) return;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function zoomBy(factor) {
    const newScale = Math.min(Math.max(scale * factor, 0.5), 5.0);
    if (newScale !== scale) {
      scale = newScale;
      applyTransform();
    }
  }

  function renderPage(num) {
    if (!pdfDoc || !canvas) return;

    if (renderTask) {
      renderTask.cancel();
      renderTask = null;
    }

    pdfDoc.getPage(num).then(page => {
      const containerWidth = viewportWrapper.clientWidth || (window.innerWidth * 0.9);
      const containerHeight = viewportWrapper.clientHeight || (window.innerHeight * 0.7);

      const unscaledViewport = page.getViewport({ scale: 1.0 });
      
      // Calculate initial fit to screen scale so croqui fits perfectly on mobile
      const scaleX = (containerWidth - 24) / unscaledViewport.width;
      const scaleY = (containerHeight - 24) / unscaledViewport.height;
      const fitScale = Math.min(scaleX, scaleY, 1.5); // Cap initial scale to 1.5x

      // High-DPI canvas rendering for crisp text/lines
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: fitScale * dpr });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        renderTask = null;
        if (spinner) spinner.style.display = 'none';
        if (canvas) canvas.style.display = 'block';
      }).catch(err => {
        if (err && err.name !== 'RenderingCancelledException') {
          console.warn('Erro na renderização do PDF.js:', err);
        }
      });
    }).catch(err => {
      console.error('Erro ao carregar página do PDF:', err);
      useFallbackIframe();
    });
  }

  function loadPdf(url) {
    if (spinner) spinner.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
    if (iframe) iframe.style.display = 'none';

    resetZoomPan();

    if (!window.pdfjsLib) {
      useFallbackIframe(url);
      return;
    }

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then(pdf => {
      pdfDoc = pdf;
      pageNum = 1;

      // Handle multi-page controls
      if (pdfDoc.numPages > 1) {
        if (pageControlsEl) pageControlsEl.style.display = 'flex';
        updatePageBadge();
      } else {
        if (pageControlsEl) pageControlsEl.style.display = 'none';
      }

      renderPage(pageNum);
    }).catch(err => {
      console.warn('Falha no PDF.js, utilizando iframe fallback:', err);
      useFallbackIframe(url);
    });
  }

  function useFallbackIframe(url) {
    if (spinner) spinner.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (iframe) {
      iframe.src = url || `/api/croquis/${currentCroqui?.id}/file`;
      iframe.style.display = 'block';
    }
  }

  function updatePageBadge() {
    if (pageNumEl && pdfDoc) {
      pageNumEl.textContent = `${pageNum}/${pdfDoc.numPages}`;
    }
  }

  function open(croqui) {
    currentCroqui = croqui;
    titleEl.textContent = `Croqui: ${croqui.bairro} - ${croqui.quarteirao} (${croqui.regiao})`;
    sizeEl.textContent = formatBytes(croqui.file_size);

    const fileUrl = `/api/croquis/${croqui.id}/file`;

    // Configure modal download button link
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      if (window.PublicApp) {
        window.PublicApp.downloadCroqui(croqui.id);
      } else {
        window.open(fileUrl, '_blank');
      }
    };

    // Configure QR Code modal trigger
    qrBtn.onclick = () => {
      openQRCodeModal(croqui);
    };

    // Track view counter via API
    fetch(`/api/croquis/${croqui.id}/view`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (window.PublicApp) window.PublicApp.refreshDataSilently();
      })
      .catch(err => console.error('Erro ao contabilizar visualização:', err));

    // Log history
    if (window.CroquiModules && window.CroquiModules.History) {
      window.CroquiModules.History.logConsultation(croqui);
    }

    modal.classList.add('active');

    // Small delay to ensure modal dimensions are computed correctly before PDF render
    setTimeout(() => {
      loadPdf(fileUrl);
    }, 50);
  }

  function close() {
    modal.classList.remove('active');
    if (renderTask) {
      renderTask.cancel();
      renderTask = null;
    }
    if (iframe) iframe.src = 'about:blank';
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pdfDoc = null;
    currentCroqui = null;
    resetZoomPan();
  }

  function openQRCodeModal(croqui) {
    const qrModal = document.getElementById('modal-qrcode');
    const qrTitle = document.getElementById('qr-title');
    const qrContainer = document.getElementById('qr-container');

    qrTitle.textContent = `${croqui.bairro} - ${croqui.quarteirao}`;
    const directUrl = `${window.location.origin}/?bairro=${encodeURIComponent(croqui.bairro)}&quarteirao=${encodeURIComponent(croqui.quarteirao)}`;
    
    qrContainer.innerHTML = window.CroquiModules.QRCode.generateSVG(directUrl);
    qrModal.classList.add('active');
  }

  // --- TOUCH ZOOM ENGINE & MOUSE DRAG HANDLERS ---
  function setupGestureHandlers() {
    if (!viewportWrapper) return;

    // TOUCH EVENTS (Mobile Pinch & Pan)
    viewportWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // Pinch-to-zoom start
        startPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        startPinchScale = scale;
      } else if (e.touches.length === 1) {
        // Drag/Pan start
        isDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      }
    }, { passive: false });

    viewportWrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && startPinchDist > 0) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = currentDist / startPinchDist;
        const targetScale = Math.min(Math.max(startPinchScale * ratio, 0.5), 5.0);
        scale = targetScale;
        applyTransform();
      } else if (e.touches.length === 1 && isDragging) {
        // Only prevent default if zoomed in or dragging pan
        if (scale > 1.05 || Math.abs(panX) > 5 || Math.abs(panY) > 5) {
          e.preventDefault();
        }
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        applyTransform();
      }
    }, { passive: false });

    viewportWrapper.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) startPinchDist = 0;
      if (e.touches.length === 0) isDragging = false;
    });

    viewportWrapper.addEventListener('touchcancel', () => {
      startPinchDist = 0;
      isDragging = false;
    });

    // MOUSE EVENTS (Desktop Drag & Mouse Wheel)
    viewportWrapper.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only main click
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    viewportWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      zoomBy(zoomFactor);
    }, { passive: false });
  }

  // --- BUTTON EVENT LISTENERS ---
  if (closeBtn) closeBtn.addEventListener('click', close);

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomBy(1.25));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomBy(0.8));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoomPan);

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (pageNum > 1) {
        pageNum--;
        updatePageBadge();
        renderPage(pageNum);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (pdfDoc && pageNum < pdfDoc.numPages) {
        pageNum++;
        updatePageBadge();
        renderPage(pageNum);
      }
    });
  }

  document.getElementById('btn-close-qr')?.addEventListener('click', () => {
    document.getElementById('modal-qrcode').classList.remove('active');
  });

  // Setup Touch & Mouse gestures
  setupGestureHandlers();

  return {
    open,
    close
  };
})();
