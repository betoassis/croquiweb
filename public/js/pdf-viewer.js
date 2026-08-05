/**
 * CROQUI WEB - PDF VIEWER MODAL CONTROLLER
 */

window.PdfViewer = (function() {
  const modal = document.getElementById('modal-pdf-viewer');
  const iframe = document.getElementById('pdf-iframe');
  const titleEl = document.getElementById('pdf-viewer-title');
  const sizeEl = document.getElementById('pdf-viewer-size');
  const downloadBtn = document.getElementById('btn-pdf-modal-download');
  const qrBtn = document.getElementById('btn-pdf-modal-qr');
  const closeBtn = document.getElementById('btn-close-pdf');

  let currentCroqui = null;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function open(croqui) {
    currentCroqui = croqui;
    titleEl.textContent = `Croqui: ${croqui.bairro} - ${croqui.quarteirao} (${croqui.regiao})`;
    sizeEl.textContent = formatBytes(croqui.file_size);

    // Set iframe source to server file endpoint for reliable streaming
    iframe.src = `/api/croquis/${croqui.id}/file`;

    // Configure modal download button link
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      window.PublicApp.downloadCroqui(croqui.id);
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
  }

  function close() {
    modal.classList.remove('active');
    iframe.src = 'about:blank';
    currentCroqui = null;
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

  // Setup close handlers
  if (closeBtn) closeBtn.addEventListener('click', close);
  
  document.getElementById('btn-close-qr')?.addEventListener('click', () => {
    document.getElementById('modal-qrcode').classList.remove('active');
  });

  return {
    open,
    close
  };
})();
