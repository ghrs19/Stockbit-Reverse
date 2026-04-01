const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const STOCKBIT_API = 'https://api.stockbit.com';
const EXODUS_API = 'https://exodus.stockbit.com';
const TOKEN_CACHE_FILE = path.join(process.cwd(), '.token_cache.json');

const DEFAULT_HEADERS = {
  'User-Agent': process.env.STOCKBIT_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6,ms;q=0.5',
  'Origin': 'https://stockbit.com',
  'Referer': 'https://stockbit.com/',
  'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'X-DeviceType': 'Google Chrome',
  'X-Platform': 'PC',
  'X-AppVersion': '3.21.0',
  'Content-Type': 'application/json',
};

class StockbitAuth {
  constructor() {
    this.accessToken = '';
    this.refreshToken = '';
    this.expiresAt = null;
    this.userId = 0;
    this.playerId = process.env.STOCKBIT_PLAYER_ID || 'pc_browser_custom';
  }

  isTokenValid() {
    if (process.env.STOCKBIT_TOKEN) return true;
    if (!this.accessToken || !this.expiresAt) return false;
    return new Date().getTime() < (this.expiresAt.getTime() - 5 * 60 * 1000);
  }

  async saveTokenToFile() {
    const data = {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_at: this.expiresAt,
      user_id: this.userId,
    };
    await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  async loadTokenFromFile() {
    try {
      const data = await fs.readFile(TOKEN_CACHE_FILE, 'utf8');
      const cache = JSON.parse(data);
      this.accessToken = cache.access_token;
      this.refreshToken = cache.refresh_token;
      this.expiresAt = cache.expires_at ? new Date(cache.expires_at) : null;
      this.userId = cache.user_id || 0;
      return !!this.accessToken;
    } catch (err) {
      return false;
    }
  }

  async login(username, password, playerId = '') {
    console.log('🔑 Mencoba login ke Stockbit...');
    this.playerId = playerId || this.playerId;

    const res = await fetch(`${EXODUS_API}/login/v6/username`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        player_id: this.playerId,
        user: username,
        password: password,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(`Login gagal (${res.status}): ${JSON.stringify(json)}`);
    if (json?.data?.new_device) {
      if (json.message) console.warn(`💬 Stockbit: ${json.message}`);
      console.error('⚠️  STOCKBIT SECURITY CHALLENGE: Perangkat Baru Terdeteksi.');
      throw new Error(`Login tertunda: ${json.message || 'Perangkat Baru'}`);
    }

    const tokenData = json?.data?.login?.token_data;
    if (!tokenData) throw new Error('Format response login tidak dikenali');

    this.accessToken = tokenData.access?.token;
    this.refreshToken = tokenData.refresh?.token;
    this.expiresAt = tokenData.access?.expired_at ? new Date(tokenData.access.expired_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    try { await this.getUserInfo(); } catch (err) {}
    await this.saveTokenToFile();
    console.log('✅ Login successful!');
    return this.accessToken;
  }

  async refresh() {
    if (process.env.STOCKBIT_TOKEN) return this.accessToken;
    if (!this.refreshToken) throw new Error('Tidak ada refresh token');
    const res = await fetch(`${EXODUS_API}/login/refresh`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, Authorization: `Bearer ${this.refreshToken}` },
    });
    if (!res.ok) throw new Error('Refresh token gagal');

    const json = await res.json();
    const refreshData = json?.data?.refresh;
    if (!refreshData?.access?.token) throw new Error('Refresh failed');

    this.accessToken = refreshData.access.token;
    this.refreshToken = refreshData.refresh?.token || this.refreshToken;
    if (refreshData.access.expired_at) this.expiresAt = new Date(refreshData.access.expired_at);
    await this.saveTokenToFile();
    return this.accessToken;
  }

  async getUserInfo() {
    if (!this.accessToken) return;
    const res = await fetch(`${EXODUS_API}/usergraph/socialinfo/user/me`, {
      headers: { ...DEFAULT_HEADERS, Authorization: `Bearer ${this.accessToken}` },
    });
    if (res.ok) {
      const json = await res.json();
      this.userId = json?.data?.user_id || 0;
    }
  }

  async ensureAuthenticated(username, password, playerId) {
    if (process.env.STOCKBIT_TOKEN) {
      console.log('✅ Menggunakan token manual dari STOCKBIT_TOKEN');
      this.accessToken = process.env.STOCKBIT_TOKEN;
      this.playerId = process.env.STOCKBIT_PLAYER_ID || this.playerId;
      return this.accessToken;
    }
    const loaded = await this.loadTokenFromFile();
    if (loaded && this.isTokenValid()) return this.accessToken;
    if (!username || !password) throw new Error('Kredensial diperlukan');
    return await this.login(username, password, playerId);
  }

  async getValidToken() {
    if (process.env.STOCKBIT_TOKEN) return process.env.STOCKBIT_TOKEN;
    if (!this.isTokenValid() && this.refreshToken) {
      try { return await this.refresh(); } catch (err) {}
    }
    return this.accessToken;
  }

  async getHeaders() {
    const token = await this.getValidToken();
    if (!token) throw new Error('Tidak terautentikasi');
    const headers = {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
    };
    // Include the playerId if we aren't using a manual token override (some APIs need it)
    if (this.playerId) headers['X-Player-Id'] = this.playerId;
    return headers;
  }

  get isAuthenticated() {
    return !!this.accessToken && (!!process.env.STOCKBIT_TOKEN || this.isTokenValid());
  }

  startTokenMonitor() {
    console.log('🔄 Token expiry monitoring started');
    this.monitorInterval = setInterval(async () => {
      if (process.env.STOCKBIT_TOKEN) return;
      if (this.expiresAt) {
        const timeUntilExpiry = this.expiresAt.getTime() - Date.now();
        const tenMinutes = 10 * 60 * 1000;
        if (timeUntilExpiry <= tenMinutes) {
          try { await this.refresh(); } catch (err) {}
        }
      }
    }, 5 * 60 * 1000);
  }

  stopTokenMonitor() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
  }
}

module.exports = { StockbitAuth, STOCKBIT_API, EXODUS_API, DEFAULT_HEADERS };
