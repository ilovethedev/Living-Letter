/**
 * Configuration for the Living Letter site
 * 
 * ⚡ UPDATE RAILWAY_URL AFTER DEPLOYING YOUR BACKEND ⚡
 */

const CONFIG = {
  // ============================================
  // 🔧 EDIT THIS AFTER DEPLOYING TO RAILWAY
  // ============================================
  RAILWAY_URL: 'https://YOUR-APP-NAME.up.railway.app',
  
  // Local development URL (no need to change)
  LOCAL_URL: 'http://localhost:3001',
  
  // ============================================
  // API URL Selection (automatic)
  // ============================================
  get API_BASE() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    return isLocal ? this.LOCAL_URL : this.RAILWAY_URL;
  },
  
  get API_SUBMIT() {
    return `${this.API_BASE}/api/submit`;
  },
  
  get API_NOTES() {
    return `${this.API_BASE}/api/notes`;
  },
  
  get API_HEALTH() {
    return `${this.API_BASE}/api/health`;
  }
};

window.CONFIG = CONFIG;
