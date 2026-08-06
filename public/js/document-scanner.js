/**
 * CROQUI WEB - DOCUMENT SCANNER MODULE (WHATSAPP STYLE)
 * Digitalizador de Documentos em PDF estilo WhatsApp para Celulares e Desktops
 */

window.DocumentScannerApp = (function() {
  let pages = []; // Elementos de imagem ou canvas de cada página digitalizada
  let currentTargetInputId = null; // ID do input de formulário que receberá o PDF ('upload-pdf' ou 'replace-pdf')
  let currentTargetBadgeId = null; // ID do container de badge de arquivo digitalizado
  let activeStream = null; // Stream da câmera WebRTC
  let currentFilter = 'bw'; // 'bw' (Documento P&B), 'original' (Cor), 'gray' (Tons de cinza)
  let currentFacingMode = 'environment'; // 'environment' (traseira) ou 'user' (frontal)
  let isFlashOn = false; // Estado da lanterna/flash
  let activePageIndex = 0;

  // DOM Getters para os Elementos do Scanner estilo WhatsApp
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
    greenBox: () => document.getElementById('scanner-green-box'),
    footerStrip: () => document.getElementById('scanner-footer-strip'),
    actionFlash: () => document.getElementById('scanner-action-flash'),
    actionFilters: () => document.getElementById('scanner-action-filters'),
    actionToggleCamera: () => document.getElementById('scanner-action-toggle-camera')
  };

  function init() {
    setupListeners();
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

    // Botão Disparo Circular (Shutter)
    el.btnCaptureWebRTC()?.addEventListener('click', captureFromWebRtc);

    // Botão Ação: Alternar Câmera / Obturador
    el.actionToggleCamera()?.addEventListener('click', function() {
      currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
      startWebRtcCamera();
    });

    // Botão Ação: Alternar Filtro (Cor, P&B, Grayscale)
    el.actionFilters()?.addEventListener('click', cycleFilter);

    // Botão Ação: Flash / Lanterna
    el.actionFlash()?.addEventListener('click', toggleFlash);

    // Entrada por Câmera Nativa do Celular (Fallback)
    el.fileInputNative()?.addEventListener('change', handleNativeFileSelect);
    el.btnAddPageNative()?.addEventListener('click', function() {
      const input = el.fileInputNative();
      if (input) input.click();
    });

    // Rotação de Página
    el.btnRotate()?.addEventListener('click', rotateActivePage);

    // Deletar Página
    el.btnDeletePage()?.addEventListener('click', deleteActivePage);

    // Finalizar PDF
    el.btnFinishPdf()?.addEventListener('click', generatePdfAndAttach);
  }

  function openScanner(targetInputId, targetBadgeId) {
    currentTargetInputId = targetInputId;
    currentTargetBadgeId = targetBadgeId;
    pages = [];
    activePageIndex = 0;
    currentFilter = 'bw';
    isFlashOn = false;

    updateFilterUI();
    updateFooterStripUI();

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
  }

  function showWebRtcContainer() {
    stopWebRtcCamera();
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    const previewCanvas = el.activePreviewCanvas();

    if (webRtc) webRtc.style.display = 'block';
    if (native) native.style.display = 'none';
    if (previewCanvas) previewCanvas.style.display = 'none';
  }

  function showPreviewContainer() {
    stopWebRtcCamera();
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    const previewCanvas = el.activePreviewCanvas();

    if (webRtc) webRtc.style.display = 'none';
    if (native) native.style.display = 'none';
    if (previewCanvas) previewCanvas.style.display = 'block';
  }

  async function startWebRtcCamera() {
    stopWebRtcCamera();
    const video = el.videoFeed();
    if (!video) return;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 }
        }
      };
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = activeStream;
      await video.play();
    } catch (err) {
      console.warn('Câmera WebRTC indisponível no navegador. Abrindo câmera nativa:', err);
      showNativeCaptureFallback();
    }
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
      alert('A iluminação por flash não é suportada por esta câmera ou navegador.');
      return;
    }

    isFlashOn = !isFlashOn;
    track.applyConstraints({ advanced: [{ torch: isFlashOn }] })
      .then(() => {
        const flashIcon = document.getElementById('scanner-flash-icon');
        if (flashIcon) {
          flashIcon.parentElement.classList.toggle('active', isFlashOn);
        }
      })
      .catch(err => console.warn('Erro ao alternar flash:', err));
  }

  function cycleFilter() {
    const filters = ['bw', 'original', 'gray'];
    const currentIndex = filters.indexOf(currentFilter);
    currentFilter = filters[(currentIndex + 1) % filters.length];

    if (pages.length > 0 && pages[activePageIndex]) {
      pages[activePageIndex].filter = currentFilter;
      renderActivePagePreview();
    }
    updateFilterUI();
  }

  function updateFilterUI() {
    const pill = el.filterPill();
    if (pill) {
      if (currentFilter === 'bw') pill.textContent = 'Documento P&B';
      else if (currentFilter === 'original') pill.textContent = 'Cor (Original)';
      else if (currentFilter === 'gray') pill.textContent = 'Tons de Cinza';
    }

    const filterIcon = document.getElementById('scanner-filter-icon');
    if (filterIcon) {
      filterIcon.parentElement.classList.toggle('active', currentFilter !== 'original');
    }
  }

  function showNativeCaptureFallback() {
    stopWebRtcCamera();
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    const previewCanvas = el.activePreviewCanvas();

    if (webRtc) webRtc.style.display = 'none';
    if (native) native.style.display = 'block';
    if (previewCanvas) previewCanvas.style.display = 'none';
  }

  function captureFromWebRtc() {
    const video = el.videoFeed();
    if (!video || !video.videoWidth) {
      // Se não houver video ao vivo, abrir seletor nativo
      const nativeInput = el.fileInputNative();
      if (nativeInput) nativeInput.click();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    addCapturedImage(canvas);
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
          addCapturedImage(canvas);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  function addCapturedImage(sourceCanvas) {
    const pageObj = {
      originalCanvas: sourceCanvas,
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
        const v = gray > 135 ? 255 : (gray < 75 ? 0 : (gray - 75) * 4.25);
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
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
      alert('Tire ao menos uma foto do documento antes de concluir.');
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

        tempCanvas.width = isRot ? srcCanvas.height : srcCanvas.width;
        tempCanvas.height = isRot ? srcCanvas.width : srcCanvas.height;

        const ctx = tempCanvas.getContext('2d');
        ctx.save();
        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((page.rotation * Math.PI) / 180);
        ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
        ctx.restore();

        applyFilterToCanvas(tempCanvas, page.filter || 'bw');

        const imgData = tempCanvas.toDataURL('image/jpeg', 0.85);
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
