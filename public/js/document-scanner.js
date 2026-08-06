/**
 * CROQUI WEB - DOCUMENT SCANNER MODULE
 * Digitalizador de Documentos em PDF para Celulares, Tablets e Desktops
 */

window.DocumentScannerApp = (function() {
  let pages = []; // Elementos de imagem ou canvas de cada página
  let currentTargetInputId = null; // ID do input que receberá o PDF gerado ('upload-pdf' ou 'replace-pdf')
  let currentTargetBadgeId = null; // ID do container de badge de arquivo digitalizado
  let activeStream = null; // Stream da câmera WebRTC
  let currentFilter = 'bw'; // 'bw' (Documento P&B), 'gray' (Tons de cinza), 'original' (Colorido)
  let currentFacingMode = 'environment'; // 'environment' (traseira) ou 'user' (frontal)

  // Elementos do DOM do Modal do Digitalizador
  const el = {
    modal: () => document.getElementById('modal-scanner'),
    videoFeed: () => document.getElementById('scanner-video-feed'),
    videoCanvas: () => document.getElementById('scanner-video-canvas'),
    fileInputNative: () => document.getElementById('scanner-native-input'),
    pagesCarousel: () => document.getElementById('scanner-pages-carousel'),
    pageCounter: () => document.getElementById('scanner-page-counter'),
    activePreviewCanvas: () => document.getElementById('scanner-active-preview-canvas'),
    btnFilterBw: () => document.getElementById('scanner-filter-bw'),
    btnFilterGray: () => document.getElementById('scanner-filter-gray'),
    btnFilterOriginal: () => document.getElementById('scanner-filter-original'),
    btnRotate: () => document.getElementById('scanner-btn-rotate'),
    btnDeletePage: () => document.getElementById('scanner-btn-delete-page'),
    btnAddPageCamera: () => document.getElementById('scanner-btn-add-camera'),
    btnAddPageNative: () => document.getElementById('scanner-btn-add-native'),
    btnCaptureWebRTC: () => document.getElementById('scanner-btn-capture'),
    btnToggleCamera: () => document.getElementById('scanner-btn-toggle-camera'),
    btnFinishPdf: () => document.getElementById('scanner-btn-finish-pdf'),
    btnClose: () => document.getElementById('scanner-btn-close'),
    webRtcContainer: () => document.getElementById('scanner-webrtc-container'),
    nativeContainer: () => document.getElementById('scanner-native-container')
  };

  let activePageIndex = 0;

  function init() {
    setupListeners();
  }

  function setupListeners() {
    document.addEventListener('click', function(e) {
      // Abrir scanner a partir de formulários
      if (e.target.matches('.btn-open-scanner') || e.target.closest('.btn-open-scanner')) {
        const btn = e.target.matches('.btn-open-scanner') ? e.target : e.target.closest('.btn-open-scanner');
        const inputId = btn.getAttribute('data-target-input');
        const badgeId = btn.getAttribute('data-target-badge');
        openScanner(inputId, badgeId);
      }
    });

    // Eventos dentro do modal de scanner
    const modal = el.modal();
    if (!modal) return;

    el.btnClose()?.addEventListener('click', closeScanner);
    
    // Troca de câmera WebRTC (Frontal / Traseira)
    el.btnToggleCamera()?.addEventListener('click', function() {
      currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
      startWebRtcCamera();
    });

    // Captura WebRTC (Tirar Foto da Câmera)
    el.btnCaptureWebRTC()?.addEventListener('click', captureFromWebRtc);

    // Entrada por arquivo nativo / Câmera do sistema
    el.fileInputNative()?.addEventListener('change', handleNativeFileSelect);
    el.btnAddPageNative()?.addEventListener('click', function() {
      const input = el.fileInputNative();
      if (input) input.click();
    });

    // Botões de Filtros
    el.btnFilterBw()?.addEventListener('click', () => setFilter('bw'));
    el.btnFilterGray()?.addEventListener('click', () => setFilter('gray'));
    el.btnFilterOriginal()?.addEventListener('click', () => setFilter('original'));

    // Rotação de Página
    el.btnRotate()?.addEventListener('click', rotateActivePage);

    // Deletar Página
    el.btnDeletePage()?.addEventListener('click', deleteActivePage);

    // Adicionar mais páginas via câmera
    el.btnAddPageCamera()?.addEventListener('click', function() {
      showWebRtcContainer();
      startWebRtcCamera();
    });

    // Finalizar PDF
    el.btnFinishPdf()?.addEventListener('click', generatePdfAndAttach);
  }

  function openScanner(targetInputId, targetBadgeId) {
    currentTargetInputId = targetInputId;
    currentTargetBadgeId = targetBadgeId;
    pages = [];
    activePageIndex = 0;
    currentFilter = 'bw';

    updatePagesCarousel();
    const modal = el.modal();
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    // Tentar iniciar câmera WebRTC por padrão, ou oferecer modo nativo em caso de falha
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
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    if (webRtc) webRtc.style.display = 'block';
    if (native) native.style.display = 'none';
  }

  function showPreviewContainer() {
    stopWebRtcCamera();
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    if (webRtc) webRtc.style.display = 'none';
    if (native) native.style.display = 'none';
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
    } catch (err) {
      console.warn('Câmera WebRTC não disponível ou negada. Usando seletor nativo:', err);
      // Caso o navegador bloqueie a câmera direta ou não suporte, usar o seletor nativo
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

  function showNativeCaptureFallback() {
    stopWebRtcCamera();
    const webRtc = el.webRtcContainer();
    const native = el.nativeContainer();
    if (webRtc) webRtc.style.display = 'none';
    if (native) native.style.display = 'block';
  }

  function captureFromWebRtc() {
    const video = el.videoFeed();
    if (!video || !video.videoWidth) return;

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

    e.target.value = ''; // Limpar input para reutilização
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
    updatePagesCarousel();
  }

  function setFilter(filterType) {
    currentFilter = filterType;
    if (pages.length > 0 && pages[activePageIndex]) {
      pages[activePageIndex].filter = filterType;
      renderActivePagePreview();
    }
    updateFilterButtonsUI();
  }

  function updateFilterButtonsUI() {
    [el.btnFilterBw(), el.btnFilterGray(), el.btnFilterOriginal()].forEach(btn => btn?.classList.remove('active'));
    if (currentFilter === 'bw') el.btnFilterBw()?.classList.add('active');
    if (currentFilter === 'gray') el.btnFilterGray()?.classList.add('active');
    if (currentFilter === 'original') el.btnFilterOriginal()?.classList.add('active');
  }

  function rotateActivePage() {
    if (pages.length === 0 || !pages[activePageIndex]) return;
    pages[activePageIndex].rotation = (pages[activePageIndex].rotation + 90) % 360;
    renderActivePagePreview();
    updatePagesCarousel();
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
    updatePagesCarousel();
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

    // Aplicar Rotação
    ctx.translate(destWidth / 2, destHeight / 2);
    ctx.rotate((page.rotation * Math.PI) / 180);
    ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    ctx.restore();

    // Aplicar Filtro no Canvas de Destino
    applyFilterToCanvas(previewCanvas, page.filter);
    updateFilterButtonsUI();
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

      // Luminosidade Grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (filterType === 'gray') {
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      } else if (filterType === 'bw') {
        // Documento P&B Alto Contraste (Threshold adaptativo para papel e croqui)
        const v = gray > 140 ? 255 : (gray < 80 ? 0 : (gray - 80) * 4.25);
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function updatePagesCarousel() {
    const carousel = el.pagesCarousel();
    const counter = el.pageCounter();
    const finishBtn = el.btnFinishPdf();

    if (counter) counter.textContent = `Página ${pages.length > 0 ? activePageIndex + 1 : 0} de ${pages.length}`;
    if (finishBtn) finishBtn.disabled = pages.length === 0;

    if (!carousel) return;
    carousel.innerHTML = '';

    pages.forEach((page, idx) => {
      const item = document.createElement('div');
      item.className = `scanner-page-thumb ${idx === activePageIndex ? 'active' : ''}`;
      
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 60;
      thumbCanvas.height = 80;
      const tCtx = thumbCanvas.getContext('2d');

      // Desenhar versão reduzida
      const isRot = page.rotation === 90 || page.rotation === 270;
      const sw = isRot ? page.originalCanvas.height : page.originalCanvas.width;
      const sh = isRot ? page.originalCanvas.width : page.originalCanvas.height;

      tCtx.save();
      tCtx.scale(60 / sw, 80 / sh);
      if (isRot) {
        tCtx.translate(sw / 2, sh / 2);
        tCtx.rotate((page.rotation * Math.PI) / 180);
        tCtx.drawImage(page.originalCanvas, -page.originalCanvas.width / 2, -page.originalCanvas.height / 2);
      } else {
        tCtx.drawImage(page.originalCanvas, 0, 0);
      }
      tCtx.restore();

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = `Pág ${idx + 1}`;

      item.appendChild(thumbCanvas);
      item.appendChild(label);

      item.addEventListener('click', function() {
        activePageIndex = idx;
        currentFilter = pages[idx].filter || 'bw';
        showPreviewContainer();
        renderActivePagePreview();
        updatePagesCarousel();
      });

      carousel.appendChild(item);
    });
  }

  async function generatePdfAndAttach() {
    if (pages.length === 0) {
      alert('Tire ou selecione ao menos uma foto do croqui/documento.');
      return;
    }

    const finishBtn = el.btnFinishPdf();
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = '⚡ Gerando PDF...';
    }

    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        throw new Error('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
      }

      // Criar documento PDF A4 em milímetros
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = doc.internal.pageSize.getHeight(); // 297mm

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();

        // Renderizar página completa em canvas temporário para exportação JPEG
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

        // Manter proporção no A4
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

      // Obter arquivo PDF em Blob
      const pdfBlob = doc.output('blob');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Croqui_Digitalizado_${timestamp}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Anexar ao formulário de destino via DataTransfer
      if (currentTargetInputId) {
        const inputEl = document.getElementById(currentTargetInputId);
        if (inputEl) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(pdfFile);
          inputEl.files = dataTransfer.files;

          // Disparar evento de alteração
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Exibir badge visual de sucesso no formulário
      if (currentTargetBadgeId) {
        const badgeEl = document.getElementById(currentTargetBadgeId);
        if (badgeEl) {
          const sizeKb = (pdfFile.size / 1024).toFixed(0);
          badgeEl.innerHTML = `
            <div class="scanned-pdf-badge">
              <span>📄 <strong>${fileName}</strong> (${pages.length} ${pages.length === 1 ? 'págs' : 'págs'} - ${sizeKb} KB)</span>
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
        finishBtn.textContent = '✅ Finalizar e Usar PDF';
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
