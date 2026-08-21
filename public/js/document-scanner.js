/**
 * CROQUI WEB - SMART DOCUMENT SCANNER & CROPPER MODULE
 * Digitalizador Inteligente com Recorte Manual dos 4 Cantos, Filtros e Botão Flutuante (+)
 */

window.DocumentScannerApp = (function() {
  let pages = []; // Coleção de páginas recortadas e processadas
  let currentTargetInputId = null;
  let currentTargetBadgeId = null;
  let activeStream = null;
  let currentFilter = 'bw'; // 'bw' (Documento P&B), 'original' (Colorido), 'gray' (Tons de Cinza)
  let currentFacingMode = 'environment';
  let isFlashOn = false;
  let activePageIndex = 0;
  let currentZoomLevel = 1.0;

  // Estado da foto bruta em processo de edição/recorte
  let rawCapturedCanvas = null;
  let corners = {
    tl: { x: 0.1, y: 0.1 },
    tr: { x: 0.9, y: 0.1 },
    br: { x: 0.9, y: 0.9 },
    bl: { x: 0.1, y: 0.9 }
  };
  let activeDraggingCorner = null;

  // DOM Getters
  const el = {
    modal: () => document.getElementById('modal-scanner'),
    videoFeed: () => document.getElementById('scanner-video-feed'),
    fileInputNative: () => document.getElementById('scanner-native-input'),
    pagesCarousel: () => document.getElementById('scanner-pages-carousel'),
    pageCounter: () => document.getElementById('scanner-page-counter'),
    activePreviewCanvas: () => document.getElementById('scanner-active-preview-canvas'),
    filterPill: () => document.getElementById('scanner-filter-label-pill'),
    btnRotate: () => document.getElementById('scanner-btn-rotate'),
    btnDeletePage: () => document.getElementById('scanner-btn-delete-page'),
    btnAddPageNative: () => document.getElementById('scanner-btn-add-native'),
    btnCaptureWebRTC: () => document.getElementById('scanner-btn-capture'),
    btnFinishPdf: () => document.getElementById('scanner-btn-finish-pdf'),
    btnClose: () => document.getElementById('scanner-btn-close'),
    webRtcContainer: () => document.getElementById('scanner-webrtc-container'),
    nativeContainer: () => document.getElementById('scanner-native-container'),
    footerStrip: () => document.getElementById('scanner-footer-strip'),
    actionFlash: () => document.getElementById('scanner-action-flash'),
    actionFilters: () => document.getElementById('scanner-action-filters'),
    actionToggleCamera: () => document.getElementById('scanner-action-toggle-camera'),

    // Crop Editor Elements
    cropEditorContainer: () => document.getElementById('scanner-crop-editor-container'),
    cropCanvasBox: () => document.getElementById('crop-canvas-box'),
    cropSourceCanvas: () => document.getElementById('crop-source-canvas'),
    cropPolygonPath: () => document.getElementById('crop-polygon-path'),
    cropConfirmBar: () => document.getElementById('scanner-crop-confirm-bar'),
    mainActionsRow: () => document.getElementById('scanner-main-actions-row'),
    btnApplyCrop: () => document.getElementById('scanner-btn-apply-crop'),
    btnCancelCrop: () => document.getElementById('scanner-btn-cancel-crop'),
    handleTL: () => document.getElementById('handle-tl'),
    handleTR: () => document.getElementById('handle-tr'),
    handleBR: () => document.getElementById('handle-br'),
    handleBL: () => document.getElementById('handle-bl'),

    // FAB & Filter Elements
    fabContainer: () => document.getElementById('fab-container'),
    fabMainBtn: () => document.getElementById('fab-main-btn'),
    fabMenu: () => document.getElementById('fab-menu'),
    filterBar: () => document.getElementById('scanner-filter-bar')
  };

  function init() {
    setupListeners();
    setupCropEditorDragHandlers();
    setupFabListeners();
    setupTapToFocus();
    setupFilterPills();
  }

  function setupListeners() {
    document.addEventListener('click', function(e) {
      if (e.target.matches('.btn-open-scanner') || e.target.closest('.btn-open-scanner')) {
        const btn = e.target.matches('.btn-open-scanner') ? e.target : e.target.closest('.btn-open-scanner');
        const inputId = btn.getAttribute('data-target-input');
        const badgeId = btn.getAttribute('data-target-badge');
        openScanner(inputId, badgeId);
      }
    });

    const modal = el.modal();
    if (!modal) return;

    el.btnClose()?.addEventListener('click', closeScanner);
    el.btnCaptureWebRTC()?.addEventListener('click', captureFromWebRtc);
    el.actionToggleCamera()?.addEventListener('click', function() {
      currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
      startWebRtcCamera();
    });
    el.actionFilters()?.addEventListener('click', cycleFilter);
    el.actionFlash()?.addEventListener('click', toggleFlash);
    document.getElementById('scanner-btn-zoom')?.addEventListener('click', toggleZoomLevel);

    el.fileInputNative()?.addEventListener('change', handleNativeFileSelect);
    el.btnAddPageNative()?.addEventListener('click', function() {
      el.fileInputNative()?.click();
    });

    el.btnRotate()?.addEventListener('click', rotateActivePage);
    el.btnDeletePage()?.addEventListener('click', deleteActivePage);
    el.btnFinishPdf()?.addEventListener('click', generatePdfAndAttach);

    el.btnApplyCrop()?.addEventListener('click', applyCropAndAddPage);
    el.btnCancelCrop()?.addEventListener('click', function() {
      showWebRtcContainer();
      startWebRtcCamera();
    });
  }

  function setupFabListeners() {
    const mainBtn = el.fabMainBtn();
    const menu = el.fabMenu();
    if (!mainBtn || !menu) return;

    mainBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isActive = mainBtn.classList.toggle('active');
      menu.style.display = isActive ? 'flex' : 'none';
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#fab-container')) {
        mainBtn.classList.remove('active');
        menu.style.display = 'none';
      }
    });

    menu.querySelectorAll('.fab-menu-item').forEach(item => {
      item.addEventListener('click', function() {
        const action = item.getAttribute('data-fab-action');
        mainBtn.classList.remove('active');
        menu.style.display = 'none';

        if (action === 'scan' || action === 'take-photo') {
          openScanner('upload-pdf', 'upload-pdf-badge');
        } else if (action === 'import-pdf') {
          const btnDash = document.getElementById('btn-open-upload-dash');
          if (btnDash) btnDash.click();
        } else if (action === 'import-img') {
          openScanner('upload-pdf', 'upload-pdf-badge');
          setTimeout(() => {
            el.fileInputNative()?.click();
          }, 300);
        }
      });
    });
  }

  function openScanner(targetInputId, targetBadgeId) {
    currentTargetInputId = targetInputId;
    currentTargetBadgeId = targetBadgeId;
    pages = [];
    activePageIndex = 0;
    currentFilter = 'bw';
    isFlashOn = false;
    currentZoomLevel = 1.0;

    updateFilterUI();
    updateFooterStripUI();
    updateZoomBtnUI(1.0);

    const fab = el.fabContainer();
    if (fab) fab.style.display = 'none';

    const modal = el.modal();
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    showWebRtcContainer();
    startWebRtcCamera();
  }

  function closeScanner() {
    stopWebRtcCamera();
    const modal = el.modal();
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    if (window.AdminApp && window.AdminApp.updateFabVisibility) {
      window.AdminApp.updateFabVisibility();
    }
  }

  function showWebRtcContainer() {
    stopWebRtcCamera();
    el.webRtcContainer() ? el.webRtcContainer().style.display = 'block' : null;
    el.nativeContainer() ? el.nativeContainer().style.display = 'none' : null;
    el.activePreviewCanvas() ? el.activePreviewCanvas().style.display = 'none' : null;
    el.cropEditorContainer() ? el.cropEditorContainer().style.display = 'none' : null;
    el.cropConfirmBar() ? el.cropConfirmBar().style.display = 'none' : null;
    el.filterBar() ? el.filterBar().style.display = 'none' : null;

    el.mainActionsRow() ? el.mainActionsRow().style.display = 'flex' : null;
    el.btnCaptureWebRTC() ? el.btnCaptureWebRTC().style.display = 'flex' : null;
  }

  function showCropEditor(sourceCanvas) {
    stopWebRtcCamera();
    rawCapturedCanvas = sourceCanvas;

    el.webRtcContainer() ? el.webRtcContainer().style.display = 'none' : null;
    el.nativeContainer() ? el.nativeContainer().style.display = 'none' : null;
    el.activePreviewCanvas() ? el.activePreviewCanvas().style.display = 'none' : null;
    el.cropEditorContainer() ? el.cropEditorContainer().style.display = 'flex' : null;
    el.cropConfirmBar() ? el.cropConfirmBar().style.display = 'flex' : null;
    el.filterBar() ? el.filterBar().style.display = 'none' : null;

    el.mainActionsRow() ? el.mainActionsRow().style.display = 'none' : null;
    el.btnCaptureWebRTC() ? el.btnCaptureWebRTC().style.display = 'none' : null;

    // Renderizar a foto bruta no canvas de edição do recorte
    const srcCanvas = el.cropSourceCanvas();
    if (!srcCanvas) return;

    srcCanvas.width = sourceCanvas.width;
    srcCanvas.height = sourceCanvas.height;
    const ctx = srcCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    // Cantos padrão (caixa A4 com margem interna de 10%)
    corners = {
      tl: { x: 0.12, y: 0.08 },
      tr: { x: 0.88, y: 0.08 },
      br: { x: 0.88, y: 0.92 },
      bl: { x: 0.12, y: 0.92 }
    };

    requestAnimationFrame(() => {
      updateCropHandlesPosition();
      setTimeout(updateCropHandlesPosition, 60);
    });
  }

  function showPreviewContainer() {
    stopWebRtcCamera();
    el.webRtcContainer() ? el.webRtcContainer().style.display = 'none' : null;
    el.nativeContainer() ? el.nativeContainer().style.display = 'none' : null;
    el.cropEditorContainer() ? el.cropEditorContainer().style.display = 'none' : null;
    el.cropConfirmBar() ? el.cropConfirmBar().style.display = 'none' : null;
    el.activePreviewCanvas() ? el.activePreviewCanvas().style.display = 'block' : null;
    el.filterBar() ? el.filterBar().style.display = 'flex' : null;

    el.mainActionsRow() ? el.mainActionsRow().style.display = 'flex' : null;
    el.btnCaptureWebRTC() ? el.btnCaptureWebRTC().style.display = 'flex' : null;
  }

  async function startWebRtcCamera() {
    stopWebRtcCamera();
    const video = el.videoFeed();
    if (!video) return;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = activeStream;
      await video.play();

      // Configurar capabilities avançadas de hardware (Zoom 1.0x baseline e Foco Contínuo)
      const track = activeStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities();
        const advancedSpecs = {};

        // Força zoom 1.0x (desativa zoom digital/óptico automático de lentes teleobjetivas)
        if (capabilities.zoom) {
          currentZoomLevel = capabilities.zoom.min || 1.0;
          advancedSpecs.zoom = currentZoomLevel;
          updateZoomBtnUI(currentZoomLevel);
        } else {
          updateZoomBtnUI(1.0);
        }

        // Ativa Auto-Foco Contínuo para digitalização perfeita de documentos
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
          if (capabilities.focusMode.includes('continuous')) {
            advancedSpecs.focusMode = 'continuous';
          } else if (capabilities.focusMode.includes('single-shot')) {
            advancedSpecs.focusMode = 'single-shot';
          }
        }

        if (Object.keys(advancedSpecs).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advancedSpecs] });
          } catch (cErr) {
            console.warn('Constraints avançadas de câmera não puderam ser aplicadas:', cErr);
          }
        }
      }
    } catch (err) {
      console.warn('Câmera WebRTC indisponível. Usando seletor nativo:', err);
      showNativeCaptureFallback();
    }
  }

  async function toggleZoomLevel() {
    if (!activeStream) return;
    const track = activeStream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') {
      alert('Controle de zoom não suportado nesta câmera.');
      return;
    }

    const capabilities = track.getCapabilities();
    if (!capabilities.zoom) {
      alert('Zoom óptico/digital não suportado por este dispositivo.');
      return;
    }

    const minZ = capabilities.zoom.min || 1.0;
    const maxZ = Math.min(capabilities.zoom.max || 4.0, 3.0);
    const step = (maxZ - minZ) >= 1.0 ? 0.5 : 0.2;

    if (currentZoomLevel < minZ || currentZoomLevel >= maxZ) {
      currentZoomLevel = minZ;
    } else {
      currentZoomLevel = Math.min(currentZoomLevel + step, maxZ);
    }

    try {
      await track.applyConstraints({ advanced: [{ zoom: currentZoomLevel }] });
      updateZoomBtnUI(currentZoomLevel);
    } catch (zErr) {
      console.warn('Erro ao aplicar zoom:', zErr);
    }
  }

  function updateZoomBtnUI(zoomVal) {
    const btn = document.getElementById('scanner-btn-zoom');
    if (btn) btn.textContent = `🔍 ${zoomVal.toFixed(1)}x`;
  }

  function setupTapToFocus() {
    const container = el.webRtcContainer();
    if (!container) return;

    container.addEventListener('click', async function(e) {
      if (e.target.closest('#scanner-btn-zoom') || e.target.closest('.wa-action-item')) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      showFocusRing(x, y);

      if (!activeStream) return;
      const track = activeStream.getVideoTracks()[0];
      if (!track || typeof track.getCapabilities !== 'function') return;

      const capabilities = track.getCapabilities();
      if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
        try {
          if (capabilities.focusMode.includes('single-shot')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
            setTimeout(() => {
              if (activeStream && capabilities.focusMode.includes('continuous')) {
                track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
              }
            }, 1000);
          } else if (capabilities.focusMode.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch (fErr) {
          console.warn('Erro ao ajustar auto-foco:', fErr);
        }
      }
    });
  }

  function showFocusRing(x, y) {
    let ring = document.getElementById('scanner-focus-ring');
    if (!ring) {
      ring = document.createElement('div');
      ring.id = 'scanner-focus-ring';
      ring.className = 'scanner-focus-ring';
      el.webRtcContainer()?.appendChild(ring);
    }

    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.classList.add('active');

    setTimeout(() => {
      ring.classList.remove('active');
    }, 800);
  }

  function stopWebRtcCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
    }
    const video = el.videoFeed();
    if (video) video.srcObject = null;
  }

  function toggleFlash() {
    if (!activeStream) return;
    const track = activeStream.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.torch) {
      alert('Lanterna não suportada por esta câmera.');
      return;
    }

    isFlashOn = !isFlashOn;
    track.applyConstraints({ advanced: [{ torch: isFlashOn }] })
      .then(() => {
        const flashIcon = document.getElementById('scanner-flash-icon');
        if (flashIcon) flashIcon.parentElement.classList.toggle('active', isFlashOn);
      })
      .catch(err => console.warn('Erro flash:', err));
  }

  function setupFilterPills() {
    const filterBar = el.filterBar();
    if (!filterBar) return;

    filterBar.querySelectorAll('.filter-pill-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const selectedFilter = btn.getAttribute('data-filter');
        currentFilter = selectedFilter;

        if (pages.length > 0 && pages[activePageIndex]) {
          pages[activePageIndex].filter = currentFilter;
          renderActivePagePreview();
        }
        updateFilterUI();
      });
    });
  }

  function cycleFilter() {
    const filters = ['bw', 'magic', 'gray', 'original'];
    const currentIndex = filters.indexOf(currentFilter);
    currentFilter = filters[(currentIndex + 1) % filters.length];

    const filterBar = el.filterBar();
    if (filterBar) {
      filterBar.style.display = 'flex';
    }

    if (pages.length > 0 && pages[activePageIndex]) {
      pages[activePageIndex].filter = currentFilter;
      renderActivePagePreview();
    }
    updateFilterUI();
  }

  function updateFilterUI() {
    const filterBar = el.filterBar();
    if (filterBar) {
      filterBar.querySelectorAll('.filter-pill-btn').forEach(btn => {
        const isMatch = btn.getAttribute('data-filter') === currentFilter;
        btn.classList.toggle('active', isMatch);
      });
    }

    const filterIcon = document.getElementById('scanner-filter-icon');
    if (filterIcon) {
      filterIcon.parentElement.classList.toggle('active', currentFilter !== 'original');
    }
  }

  function showNativeCaptureFallback() {
    stopWebRtcCamera();
    el.webRtcContainer() ? el.webRtcContainer().style.display = 'none' : null;
    el.nativeContainer() ? el.nativeContainer().style.display = 'block' : null;
    el.activePreviewCanvas() ? el.activePreviewCanvas().style.display = 'none' : null;
  }

  function captureFromWebRtc() {
    const video = el.videoFeed();
    if (!video || !video.videoWidth) {
      el.fileInputNative()?.click();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    showCropEditor(canvas);
  }

  function handleNativeFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          showCropEditor(canvas);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  // --- LÓGICA DE ARRASTE DOS 4 CANTOS (CROP EDITOR) ---
  function setupCropEditorDragHandlers() {
    const handles = [el.handleTL(), el.handleTR(), el.handleBR(), el.handleBL()];

    const startDrag = (cornerKey, e) => {
      e.preventDefault();
      activeDraggingCorner = cornerKey;
    };

    const doDrag = (e) => {
      if (!activeDraggingCorner || !rawCapturedCanvas) return;
      const box = el.cropCanvasBox();
      if (!box) return;

      const rect = box.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let normX = (clientX - rect.left) / rect.width;
      let normY = (clientY - rect.top) / rect.height;

      normX = Math.max(0, Math.min(1, normX));
      normY = Math.max(0, Math.min(1, normY));

      corners[activeDraggingCorner] = { x: normX, y: normY };
      updateCropHandlesPosition();
    };

    const stopDrag = () => {
      activeDraggingCorner = null;
    };

    handles.forEach(h => {
      if (!h) return;
      const cornerKey = h.getAttribute('data-corner');
      h.addEventListener('mousedown', (e) => startDrag(cornerKey, e));
      h.addEventListener('touchstart', (e) => startDrag(cornerKey, e), { passive: false });
    });

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);

    window.addEventListener('resize', () => {
      if (el.cropEditorContainer() && el.cropEditorContainer().style.display !== 'none') {
        updateCropHandlesPosition();
      }
    });
  }

  function updateCropHandlesPosition() {
    const box = el.cropCanvasBox();
    if (!box) return;

    const w = box.clientWidth;
    const h = box.clientHeight;

    const pTL = { x: corners.tl.x * w, y: corners.tl.y * h };
    const pTR = { x: corners.tr.x * w, y: corners.tr.y * h };
    const pBR = { x: corners.br.x * w, y: corners.br.y * h };
    const pBL = { x: corners.bl.x * w, y: corners.bl.y * h };

    if (el.handleTL()) { el.handleTL().style.left = pTL.x + 'px'; el.handleTL().style.top = pTL.y + 'px'; }
    if (el.handleTR()) { el.handleTR().style.left = pTR.x + 'px'; el.handleTR().style.top = pTR.y + 'px'; }
    if (el.handleBR()) { el.handleBR().style.left = pBR.x + 'px'; el.handleBR().style.top = pBR.y + 'px'; }
    if (el.handleBL()) { el.handleBL().style.left = pBL.x + 'px'; el.handleBL().style.top = pBL.y + 'px'; }

    const poly = el.cropPolygonPath();
    if (poly) {
      poly.setAttribute('points', `${pTL.x},${pTL.y} ${pTR.x},${pTR.y} ${pBR.x},${pBR.y} ${pBL.x},${pBL.y}`);
    }
  }

  // Transformação de Perspectiva Bilinear de 4 Pontos (Desentorta o documento)
  function warpPerspective(sourceCanvas, corners, destW, destH) {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;

    const pTL = { x: corners.tl.x * sw, y: corners.tl.y * sh };
    const pTR = { x: corners.tr.x * sw, y: corners.tr.y * sh };
    const pBR = { x: corners.br.x * sw, y: corners.br.y * sh };
    const pBL = { x: corners.bl.x * sw, y: corners.bl.y * sh };

    const srcCtx = sourceCanvas.getContext('2d');
    const srcImgData = srcCtx.getImageData(0, 0, sw, sh);
    const srcData = srcImgData.data;

    const destCanvas = document.createElement('canvas');
    destCanvas.width = destW;
    destCanvas.height = destH;
    const destCtx = destCanvas.getContext('2d');
    const destImgData = destCtx.createImageData(destW, destH);
    const destData = destImgData.data;

    for (let y = 0; y < destH; y++) {
      const v = y / (destH - 1);
      const invV = 1 - v;

      const leftX = pTL.x * invV + pBL.x * v;
      const leftY = pTL.y * invV + pBL.y * v;
      const rightX = pTR.x * invV + pBR.x * v;
      const rightY = pTR.y * invV + pBR.y * v;

      for (let x = 0; x < destW; x++) {
        const u = x / (destW - 1);
        const invU = 1 - u;

        const srcX = leftX * invU + rightX * u;
        const srcY = leftY * invU + rightY * u;

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, sw - 1);
        const y1 = Math.min(y0 + 1, sh - 1);

        const dx = srcX - x0;
        const dy = srcY - y0;

        const idx00 = (y0 * sw + x0) * 4;
        const idx10 = (y0 * sw + x1) * 4;
        const idx01 = (y1 * sw + x0) * 4;
        const idx11 = (y1 * sw + x1) * 4;

        const w00 = (1 - dx) * (1 - dy);
        const w10 = dx * (1 - dy);
        const w01 = (1 - dx) * dy;
        const w11 = dx * dy;

        const r = srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11;
        const g = srcData[idx00 + 1] * w00 + srcData[idx10 + 1] * w10 + srcData[idx01 + 1] * w01 + srcData[idx11 + 1] * w11;
        const b = srcData[idx00 + 2] * w00 + srcData[idx10 + 2] * w10 + srcData[idx01 + 2] * w01 + srcData[idx11 + 2] * w11;
        const a = srcData[idx00 + 3] * w00 + srcData[idx10 + 3] * w10 + srcData[idx01 + 3] * w01 + srcData[idx11 + 3] * w11;

        const destIdx = (y * destW + x) * 4;
        destData[destIdx] = r;
        destData[destIdx + 1] = g;
        destData[destIdx + 2] = b;
        destData[destIdx + 3] = a;
      }
    }

    destCtx.putImageData(destImgData, 0, 0);
    return destCanvas;
  }

  function applyCropAndAddPage() {
    if (!rawCapturedCanvas) return;

    const sw = rawCapturedCanvas.width;
    const sh = rawCapturedCanvas.height;

    const pTL = { x: corners.tl.x * sw, y: corners.tl.y * sh };
    const pTR = { x: corners.tr.x * sw, y: corners.tr.y * sh };
    const pBR = { x: corners.br.x * sw, y: corners.br.y * sh };
    const pBL = { x: corners.bl.x * sw, y: corners.bl.y * sh };

    const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
    const botW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
    const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
    const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

    const cropW = Math.max(topW, botW);
    const cropH = Math.max(leftH, rightH);

    const destW = Math.max(800, Math.round(cropW));
    const destH = Math.round(destW * 1.414);

    // Executa a Transformação de Perspectiva Bilinear de 4 Pontos para desentortar o documento
    const rectifiedCanvas = warpPerspective(rawCapturedCanvas, corners, destW, destH);

    const pageObj = {
      originalCanvas: rectifiedCanvas,
      rotation: 0,
      filter: currentFilter
    };

    pages.push(pageObj);
    activePageIndex = pages.length - 1;

    showPreviewContainer();
    renderActivePagePreview();
    updateFooterStripUI();
  }

  function rotateActivePage() {
    if (pages.length === 0 || !pages[activePageIndex]) return;
    pages[activePageIndex].rotation = (pages[activePageIndex].rotation + 90) % 360;
    renderActivePagePreview();
    updateFooterStripUI();
  }

  function deleteActivePage() {
    if (pages.length === 0) return;
    pages.splice(activePageIndex, 1);
    if (activePageIndex >= pages.length) {
      activePageIndex = Math.max(0, pages.length - 1);
    }

    if (pages.length === 0) {
      showWebRtcContainer();
      startWebRtcCamera();
    } else {
      renderActivePagePreview();
    }
    updateFooterStripUI();
  }

  function renderActivePagePreview() {
    const previewCanvas = el.activePreviewCanvas();
    if (!previewCanvas || pages.length === 0 || !pages[activePageIndex]) return;

    const page = pages[activePageIndex];
    const srcCanvas = page.originalCanvas;
    const isRotated90or270 = page.rotation === 90 || page.rotation === 270;

    const destWidth = isRotated90or270 ? srcCanvas.height : srcCanvas.width;
    const destHeight = isRotated90or270 ? srcCanvas.width : srcCanvas.height;

    previewCanvas.width = destWidth;
    previewCanvas.height = destHeight;

    const ctx = previewCanvas.getContext('2d');
    ctx.save();
    ctx.translate(destWidth / 2, destHeight / 2);
    ctx.rotate((page.rotation * Math.PI) / 180);
    ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    ctx.restore();

    applyFilterToCanvas(previewCanvas, page.filter);
    updateFilterUI();
  }

  function applyFilterToCanvas(canvas, filterType) {
    if (filterType === 'original') return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (filterType === 'gray') {
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      } else if (filterType === 'bw') {
        // High Contrast Document Scan (P&B adaptativo com curva de contraste para não apagar texto fino)
        let v;
        if (gray > 180) {
          v = 255;
        } else if (gray < 80) {
          v = 0;
        } else {
          const norm = (gray - 80) / 100;
          v = Math.pow(norm, 1.4) * 255;
        }
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      } else if (filterType === 'magic') {
        // Mágico (CamScanner Color: Aumenta contraste da cor e clareia o papel fundo)
        const factor = 1.35;
        const cbR = Math.min(255, Math.max(0, (r - 128) * factor + 128 + 15));
        const cbG = Math.min(255, Math.max(0, (g - 128) * factor + 128 + 15));
        const cbB = Math.min(255, Math.max(0, (b - 128) * factor + 128 + 15));

        if (gray > 165) {
          data[i] = Math.min(255, cbR + 35);
          data[i + 1] = Math.min(255, cbG + 35);
          data[i + 2] = Math.min(255, cbB + 35);
        } else {
          data[i] = cbR;
          data[i + 1] = cbG;
          data[i + 2] = cbB;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function updateFooterStripUI() {
    const strip = el.footerStrip();
    const carousel = el.pagesCarousel();
    const counter = el.pageCounter();

    if (!strip) return;

    if (pages.length === 0) {
      strip.style.display = 'none';
      return;
    }

    strip.style.display = 'flex';
    if (counter) counter.textContent = `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}`;

    if (!carousel) return;
    carousel.innerHTML = '';

    pages.forEach((page, idx) => {
      const item = document.createElement('div');
      item.className = `scanner-page-thumb ${idx === activePageIndex ? 'active' : ''}`;
      
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 50;
      thumbCanvas.height = 65;
      const tCtx = thumbCanvas.getContext('2d');

      const isRot = page.rotation === 90 || page.rotation === 270;
      const sw = isRot ? page.originalCanvas.height : page.originalCanvas.width;
      const sh = isRot ? page.originalCanvas.width : page.originalCanvas.height;

      tCtx.save();
      tCtx.scale(50 / sw, 65 / sh);
      if (isRot) {
        tCtx.translate(sw / 2, sh / 2);
        tCtx.rotate((page.rotation * Math.PI) / 180);
        tCtx.drawImage(page.originalCanvas, -page.originalCanvas.width / 2, -page.originalCanvas.height / 2);
      } else {
        tCtx.drawImage(page.originalCanvas, 0, 0);
      }
      tCtx.restore();

      item.appendChild(thumbCanvas);
      item.addEventListener('click', function() {
        activePageIndex = idx;
        currentFilter = pages[idx].filter || 'bw';
        showPreviewContainer();
        renderActivePagePreview();
        updateFooterStripUI();
      });

      carousel.appendChild(item);
    });
  }

  async function generatePdfAndAttach() {
    if (pages.length === 0) {
      alert('Tire ao menos uma foto e confirme o recorte do documento.');
      return;
    }

    const finishBtn = el.btnFinishPdf();
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = 'Gerando PDF...';
    }

    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        throw new Error('Biblioteca jsPDF não carregada.');
      }

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();

        const tempCanvas = document.createElement('canvas');
        const page = pages[i];
        const srcCanvas = page.originalCanvas;
        const isRot = page.rotation === 90 || page.rotation === 270;

        const rawW = isRot ? srcCanvas.height : srcCanvas.width;
        const rawH = isRot ? srcCanvas.width : srcCanvas.height;

        // Limita a dimensão máxima (1440px) para evitar PDFs gigantescos sem perder legibilidade
        const maxDim = 1440;
        let targetW = rawW;
        let targetH = rawH;

        if (Math.max(rawW, rawH) > maxDim) {
          const scale = maxDim / Math.max(rawW, rawH);
          targetW = Math.round(rawW * scale);
          targetH = Math.round(rawH * scale);
        }

        tempCanvas.width = targetW;
        tempCanvas.height = targetH;

        const ctx = tempCanvas.getContext('2d');
        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((page.rotation * Math.PI) / 180);

        const drawW = isRot ? targetH : targetW;
        const drawH = isRot ? targetW : targetH;
        ctx.drawImage(srcCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        applyFilterToCanvas(tempCanvas, page.filter || 'bw');

        // Qualidade JPEG 0.72 otimizada para croquis e documentos
        const imgData = tempCanvas.toDataURL('image/jpeg', 0.72);
        const imgRatio = tempCanvas.width / tempCanvas.height;
        let renderW = pdfWidth;
        let renderH = pdfWidth / imgRatio;

        if (renderH > pdfHeight) {
          renderH = pdfHeight;
          renderW = pdfHeight * imgRatio;
        }

        const marginX = (pdfWidth - renderW) / 2;
        const marginY = (pdfHeight - renderH) / 2;

        doc.addImage(imgData, 'JPEG', marginX, marginY, renderW, renderH);
      }

      const pdfBlob = doc.output('blob');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Croqui_Digitalizado_${timestamp}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Anexar PDF ao input de upload
      if (currentTargetInputId) {
        const inputEl = document.getElementById(currentTargetInputId);
        if (inputEl) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(pdfFile);
          inputEl.files = dataTransfer.files;
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      if (currentTargetBadgeId) {
        const badgeEl = document.getElementById(currentTargetBadgeId);
        if (badgeEl) {
          const sizeKb = (pdfFile.size / 1024).toFixed(0);
          badgeEl.innerHTML = `
            <div class="scanned-pdf-badge">
              <span>📄 <strong>${fileName}</strong> (${pages.length} ${pages.length === 1 ? 'pág' : 'págs'} - ${sizeKb} KB)</span>
              <span class="badge-tag">Digitalizado via Câmera</span>
            </div>
          `;
          badgeEl.style.display = 'block';
        }
      }

      closeScanner();

      // Abrir automaticamente a janela de cadastro de Croqui com o PDF anexado
      const modalUpload = document.getElementById('modal-upload');
      if (modalUpload) {
        modalUpload.classList.add('active');
        modalUpload.style.display = 'flex';
      }
    } catch (err) {
      console.error('Erro ao gerar PDF digitalizado:', err);
      alert('Falha ao gerar o arquivo PDF: ' + err.message);
    } finally {
      if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = '✅ Concluir PDF';
      }
    }
  }

  return {
    init,
    openScanner,
    closeScanner
  };
})();

document.addEventListener('DOMContentLoaded', function() {
  window.DocumentScannerApp.init();
});
