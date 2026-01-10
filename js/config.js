/**
 * Living Letter - Configuration
 */

const CONFIG = {
  // Railway backend URL
  RAILWAY_URL: 'https://living-letter-production.up.railway.app',
  
  // Local development
  LOCAL_URL: 'http://localhost:3001',
  
  // Auto-detect environment
  get API_BASE() {
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? this.LOCAL_URL : this.RAILWAY_URL;
  },
  
  get API_SUBMIT() { return `${this.API_BASE}/api/submit`; },
  get API_NOTES() { return `${this.API_BASE}/api/notes`; },
  get API_HEALTH() { return `${this.API_BASE}/api/health`; }
};

window.CONFIG = CONFIG;
