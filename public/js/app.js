/**
 * CROQUI WEB - PUBLIC CONTROLLER
 */

window.PublicApp = (function() {
  let croquisList = [];
  let isFavoritesOnly = false;

  const searchInput = document.getElementById('public-search-input');
  const selectBairro = document.getElementById('filter-bairro');
  const selectRegiao = document.getElementById('filter-regiao');
  const btnClearFilters = document.getElementById('btn-clear-filters');
  const btnFilterFavs = document.getElementById('btn-filter-favorites');
  const croquisGrid = document.getElementById('croquis-grid');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('croquis-count');

  function init() {
    setupEventListeners();
    loadCroquis();
  }

  function loadCroquis() {
    fetch('/api/croquis')
      .then(res => res.json())
      .then(data => {
        croquisList = data;
        populateFilterDropdowns(data);
        applyFiltersAndRender();
      })
      .catch(err => console.error('Erro ao carregar croquis:', err));
  }

  function refreshDataSilently() {
    fetch('/api/croquis')
      .then(res => res.json())
      .then(data => {
        croquisList = data;
        applyFiltersAndRender();
      })
      .catch(err => console.error(err));
  }

  function populateFilterDropdowns(data) {
    const currentBairro = selectBairro.value;
    const currentRegiao = selectRegiao.value;

    const bairros = Array.from(new Set(data.map(c => c.bairro))).sort();
    const regioes = Array.from(new Set(data.map(c => c.regiao))).sort();

    selectBairro.innerHTML = `<option value="">Todos os Bairros (${bairros.length})</option>` +
      bairros.map(b => `<option value="${b}">${b}</option>`).join('');

    selectRegiao.innerHTML = `<option value="">Todas as Regiões (${regioes.length})</option>` +
      regioes.map(r => `<option value="${r}">${r}</option>`).join('');

    selectBairro.value = currentBairro;
    selectRegiao.value = currentRegiao;
  }

  function normalizeText(text) {
    if (!text) return '';
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function applyFiltersAndRender() {
    const searchTerm = normalizeText(searchInput.value);
    const selectedBairro = normalizeText(selectBairro.value);
    const selectedRegiao = normalizeText(selectRegiao.value);

    let filtered = croquisList.filter(c => {
      const matchSearch = !searchTerm ||
        normalizeText(c.bairro).includes(searchTerm) ||
        normalizeText(c.sisloc).includes(searchTerm) ||
        normalizeText(c.regiao).includes(searchTerm) ||
        normalizeText(c.quarteirao).includes(searchTerm) ||
        normalizeText(c.observacoes).includes(searchTerm);

      const matchBairro = !selectedBairro || normalizeText(c.bairro) === selectedBairro;
      const matchRegiao = !selectedRegiao || normalizeText(c.regiao) === selectedRegiao;
      const matchFav = !isFavoritesOnly || (window.CroquiModules && window.CroquiModules.Favorites.isFavorite(c.id));

      return matchSearch && matchBairro && matchRegiao && matchFav;
    });

    renderCroquisGrid(filtered);
  }

  function formatQuarteirao(val) {
    if (!val && val !== 0) return '0 Quarteirões';
    const str = val.toString().trim();
    const digitsOnly = str.replace(/\D+/g, '');
    if (digitsOnly.length > 0) {
      const num = parseInt(digitsOnly, 10);
      return num === 1 ? `${num} Quarteirão` : `${num} Quarteirões`;
    }
    return str;
  }

  function renderCroquisGrid(items) {
    countBadge.textContent = items.length;

    if (!items || items.length === 0) {
      croquisGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    croquisGrid.style.display = 'grid';

    croquisGrid.innerHTML = items.map(c => {
      const isFav = window.CroquiModules && window.CroquiModules.Favorites.isFavorite(c.id);
      const formattedDate = new Date(c.updated_at).toLocaleDateString('pt-BR');
      const qtnStr = formatQuarteirao(c.quarteirao);

      return `
        <article class="croqui-card">
          <div class="croqui-card-header">
            <div class="croqui-badges">
              ${c.sisloc ? `<span class="badge badge-sisloc">SISLOC ${c.sisloc}</span>` : ''}
              <span class="badge badge-quarteirao">${qtnStr}</span>
              <span class="badge badge-bairro">${c.bairro}</span>
              <span class="badge badge-regiao">${c.regiao}</span>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" 
                    title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" 
                    onclick="PublicApp.toggleFav('${c.id}')">
              ${isFav ? '★' : '☆'}
            </button>
          </div>

          <h3 class="croqui-title">${c.bairro} - ${qtnStr}</h3>
          
          <p class="croqui-obs" title="${c.observacoes || ''}">
            ${c.observacoes ? c.observacoes : '<em>Sem observações registradas.</em>'}
          </p>

          <div class="croqui-meta">
            <span class="meta-item">👁️ ${c.views || 0} views</span>
            <span class="meta-item">📥 ${c.downloads || 0} downloads</span>
            <span class="meta-item">📅 ${formattedDate}</span>
          </div>

          <div class="croqui-actions">
            <button class="btn-card btn-view" onclick="PublicApp.openViewer('${c.id}')">
              👁️ Visualizar PDF
            </button>
            <button class="btn-card btn-download" onclick="PublicApp.downloadCroqui('${c.id}')">
              📥 Baixar PDF
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function openViewer(id) {
    const croqui = croquisList.find(c => c.id === id);
    if (croqui && window.PdfViewer) {
      window.PdfViewer.open(croqui);
    }
  }

  function downloadCroqui(id) {
    const croqui = croquisList.find(c => c.id === id);
    if (!croqui) return;

    // Trigger API call to increment count and download file
    fetch(`/api/croquis/${id}/download`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Arquivo não encontrado no servidor');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = croqui.filename || `${croqui.bairro}_${croqui.quarteirao}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        refreshDataSilently();
      })
      .catch(err => {
        alert('Não foi possível baixar o arquivo: ' + err.message);
      });
  }

  function toggleFav(id) {
    if (window.CroquiModules && window.CroquiModules.Favorites) {
      window.CroquiModules.Favorites.toggleFavorite(id);
      applyFiltersAndRender();
    }
  }

  function setupEventListeners() {
    let debounceTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFiltersAndRender, 200);
    });

    selectBairro?.addEventListener('change', applyFiltersAndRender);
    selectRegiao?.addEventListener('change', applyFiltersAndRender);

    btnClearFilters?.addEventListener('click', () => {
      searchInput.value = '';
      selectBairro.value = '';
      selectRegiao.value = '';
      isFavoritesOnly = false;
      btnFilterFavs.classList.remove('active');
      applyFiltersAndRender();
    });

    btnFilterFavs?.addEventListener('click', () => {
      isFavoritesOnly = !isFavoritesOnly;
      btnFilterFavs.classList.toggle('active', isFavoritesOnly);
      applyFiltersAndRender();
    });
  }

  return {
    init,
    loadCroquis,
    refreshDataSilently,
    openViewer,
    downloadCroqui,
    toggleFav
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.PublicApp.init();
});
