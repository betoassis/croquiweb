/**
 * CROQUI WEB - EXTENSIBLE MODULES REGISTRY
 * Clean modular hooks for future capabilities: Favorites, QR Code, History, Versioning, Offline PWA.
 */

window.CroquiModules = (function() {
  
  // 1. FAVORITES MODULE (LocalStorage based)
  const Favorites = {
    STORAGE_KEY: 'croqui_web_favorites',
    
    getFavorites() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    isFavorite(id) {
      return this.getFavorites().includes(id);
    },

    toggleFavorite(id) {
      const current = this.getFavorites();
      const index = current.indexOf(id);
      if (index === -1) {
        current.push(id);
      } else {
        current.splice(index, 1);
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
      return index === -1; // true if added, false if removed
    }
  };

  // 2. SEARCH & CONSULTATION HISTORY MODULE
  const History = {
    STORAGE_KEY: 'croqui_web_history',
    
    getHistory() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    logConsultation(croqui) {
      const list = this.getHistory();
      const item = {
        id: croqui.id,
        quarteirao: croqui.quarteirao,
        bairro: croqui.bairro,
        timestamp: new Date().toISOString()
      };
      // Keep last 20 consultations
      list.unshift(item);
      const trimmed = list.slice(0, 20);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    }
  };

  // 3. QR CODE GENERATOR MODULE (Pure JS SVG Generator fallback)
  const QRCode = {
    generateSVG(text) {
      // Light placeholder SVG representing a QR Code pattern for demo display
      const encodedText = encodeURIComponent(text);
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#ffffff" />
          <rect x="5" y="5" width="30" height="30" fill="#0f172a" />
          <rect x="10" y="10" width="20" height="20" fill="#ffffff" />
          <rect x="15" y="15" width="10" height="10" fill="#0d9488" />
          
          <rect x="65" y="5" width="30" height="30" fill="#0f172a" />
          <rect x="70" y="10" width="20" height="20" fill="#ffffff" />
          <rect x="75" y="15" width="10" height="10" fill="#0d9488" />

          <rect x="5" y="65" width="30" height="30" fill="#0f172a" />
          <rect x="10" y="70" width="20" height="20" fill="#ffffff" />
          <rect x="15" y="75" width="10" height="10" fill="#0d9488" />

          <rect x="40" y="10" width="10" height="10" fill="#0f172a" />
          <rect x="45" y="25" width="15" height="10" fill="#0d9488" />
          <rect x="40" y="40" width="20" height="20" fill="#0f172a" />
          <rect x="65" y="45" width="25" height="10" fill="#0f172a" />
          <rect x="45" y="70" width="15" height="20" fill="#0d9488" />
          <rect x="70" y="75" width="15" height="15" fill="#0f172a" />
        </svg>
      `;
    }
  };

  // 4. OFFLINE SERVICE WORKER CACHE MODULE
  const Offline = {
    init() {
      if ('serviceWorker' in navigator) {
        console.log('[OfflineModule] Service Worker pronto para registro futuro.');
      }
    }
  };

  // 5. VERSION CONTROL HOOK
  const Versioning = {
    formatVersion(croqui) {
      const date = new Date(croqui.updated_at || croqui.created_at);
      return `v1.${date.getMonth() + 1}.${date.getDate()}`;
    }
  };

  return {
    Favorites,
    History,
    QRCode,
    Offline,
    Versioning
  };
})();
