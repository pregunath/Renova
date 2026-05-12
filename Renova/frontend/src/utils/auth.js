// utils/auth.js
// Dynamic API URL detection: works for IPv4, IPv6, and domain names
const getApiBaseUrl = () => {
  // Always prefer environment variable if set
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // Server-side rendering: cannot detect browser location
  if (typeof window === 'undefined') {
    return 'http://localhost:8080';
  }

  // Client-side: use the same origin as the frontend (Nginx proxies /api to the backend)
  return window.location.origin;

  // // Client-side: use the same host as the frontend, but port 8080
  // const protocol = window.location.protocol; // http: or https:
  // const hostname = window.location.hostname; // Could be IPv4, IPv6, or domain

  // // Handle IPv6 addresses (need brackets in URL)
  // // Note: window.location.hostname already strips brackets, so we need to add them back
  // // But only if it's an IPv6 address (contains colons) and doesn't already have brackets
  // let host;
  // if (hostname.includes(':')) {
  //   // IPv6 address - add brackets if not present
  //   host = hostname.startsWith('[') ? hostname : `[${hostname}]`;
  // } else {
  //   // IPv4 or domain name
  //   host = hostname;
  // }

  // return `${protocol}//${host}:8080`;
};

let refreshPromise = null;
let accessRefreshTimeoutId = null;

const authAPI = {
  // Decode a JWT without verifying signature (client-side utility)
  _decode(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  },

  _isExpired(token) {
    const decoded = this._decode(token);
    if (!decoded || !decoded.exp) return true; // treat invalid as expired
    // exp is in seconds
    const nowSeconds = Date.now() / 1000;
    return decoded.exp <= nowSeconds;
  },

  //Logging tokens
  _expInfo(token) {
    const d = this._decode(token);
    if (!d || !d.exp) return { exp: null, expired: true, human: 'invalid token' };
    const expMs = d.exp * 1000;
    const expired = Date.now() >= expMs;
    return { exp: d.exp, expired, human: new Date(expMs).toISOString(), secondsRemaining: expired ? 0 : Math.round((expMs - Date.now())/1000) };
  },

  //Log token details for debugging
  _logToken(label, token) {
    if (!token) {
      console.log(`[tokens] ${label}: <missing>`);
      return;
    }
    const info = this._expInfo(token);
    console.log(`[tokens] ${label}:`, token);
    console.log(`[tokens] ${label} decoded:`, this._decode(token));
    console.log(`[tokens] ${label} expiry ISO: ${info.human} | secondsRemaining=${info.secondsRemaining} | expired=${info.expired}`);
  },

  // Schedule automatic access token refresh based on its expiry
  _scheduleAccessRefresh() {
    if (typeof window === 'undefined') return;
    if (accessRefreshTimeoutId) {
      clearTimeout(accessRefreshTimeoutId);
      accessRefreshTimeoutId = null;
    }
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;
    const info = this._expInfo(accessToken);
    if (!info || info.expired) {
      // If already expired, trigger a refresh asynchronously
      setTimeout(() => {
        this.refreshToken().catch(() => {});
      }, 0);
      return;
    }
    const msUntilExpiry = Math.max(0, (info.secondsRemaining || 0) * 1000);
    // Small safety skew to refresh right at/just after expiry
    const skewMs = 250;
    accessRefreshTimeoutId = setTimeout(() => {
      console.debug('[auth] Scheduled access token refresh firing');
      // Silent refresh to avoid redirect loops
      this.refreshToken({ silent: true }).catch(() => {});
    }, msUntilExpiry + skewMs);
  },

  ensureValidForNavigation() {
    if (typeof window === 'undefined') return { status: 'noop' };
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!accessToken || !refreshToken) {
      return { status: 'missing' };
    }
    const refreshExpired = this._isExpired(refreshToken);
    if (refreshExpired) {
      return { status: 'refresh-expired' };
    }
    return { status: 'ok', accessExpired: this._isExpired(accessToken) };
  },
  async request(url, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    let ValidAccessToken = token;

    // Proactive refresh: if access token is expired but refresh token valid, refresh before making the request
      if (ValidAccessToken && this._isExpired(ValidAccessToken)) {
        console.group('[tokens] Proactive access token refresh (expired before request)');
        this._logToken('expiredAccessToken', ValidAccessToken);
        if (refreshToken) this._logToken('storedRefreshToken', refreshToken);
        console.groupEnd();
        try {
          await this.refreshToken();
          ValidAccessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        } catch (e) {
          // refreshToken() already handled clearing & redirect; just propagate
          throw e;
        }
    }

    if (ValidAccessToken) {
      config.headers.Authorization = `Bearer ${ValidAccessToken}`;
    }

    const apiUrl = getApiBaseUrl();
    let response = await fetch(`${apiUrl}${url}`, config);

    // If token is expired, try to refresh it
    if (response.status === 401 && ValidAccessToken) {
      try {
        //Attempt to refresh token
        const oldAccess = ValidAccessToken;
        await this.refreshToken();
        // Retry the original request with new token
        const newToken = localStorage.getItem('accessToken');
        // Log token refresh details
        console.group('[tokens] Access token refresh');
        this._logToken('oldAccessToken', oldAccess);
        this._logToken('newAccessToken', newToken);
        console.groupEnd();
        config.headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${url}`, config);
      } catch (error) {
        this.clearTokens();
        throw error;
      }
    }

    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`;
      try {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await response.json();
          if (data && data.message) message = data.message;
        } else {
          const text = await response.text();
          if (text) message = text;
        }
      } catch {}
      throw new Error(message);
    }

    // Robust JSON parsing: handle empty/204 and non-JSON bodies
    if (response.status === 204) return null;
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }
    // Fallback to text
    try {
      const text = await response.text();
      return text ? { raw: text } : {};
    } catch {
      return {};
    }
  },

async refreshToken(options = {}) {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = new Promise(async (resolve, reject) => {
      try {
        // Support both cookie-based and body-based refresh tokens
        const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        const payload = storedRefresh ? { refreshToken: storedRefresh } : undefined;
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : undefined,
        });

        console.debug('[auth] refresh response status=', response.status);

        if (!response.ok) {
          // Try to capture response body for debugging
          const text = await response.text().catch(() => '<<no-body>>');
          console.debug('[auth] refresh response body=', text);
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        console.debug('[auth] refresh payload=', Object.keys(data));
        
        // Store the new access token
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          // Logging refreshed access token
          console.group('[tokens] Stored refreshed access token');
          this._logToken('accessToken', data.accessToken);
          console.groupEnd();
          // Reschedule next refresh based on new token
          this._scheduleAccessRefresh();
        }
        
        // Refresh token rotation happens server-side via cookie; nothing to store.
        
        resolve(data);
      } catch (error) {
        console.error('[auth] refresh error:', error);
        // If called in silent mode (proactive, e.g., on navigation), don't clear or redirect
        if (!options.silent) {
          this.clearTokens();
          // Notify user that session expired and redirect to login
          if (typeof window !== 'undefined') {
            try {
              // Broadcast logout event so AuthContext reacts immediately
              localStorage.setItem('auth_event', `logout:expired:${Date.now()}`);
            } catch (e) {}
            // Immediate synchronous redirect with message in URL
            window.location.href = '/auth?mode=login&expired=true&message=' + encodeURIComponent('Access Expired. Please sign in again.');
          }
        }
        
        reject(error);
      } finally {
        refreshPromise = null;
      }
    });

    return refreshPromise;
},

  clearTokens() {
    //Logging Clear stored tokens
    const prevAccess = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const prevRefresh = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    //Displays cleared tokens
    console.group('[tokens] Cleared tokens');
    this._logToken('previousAccessToken', prevAccess);
    this._logToken('previousRefreshToken', prevRefresh);
    console.groupEnd();
  },

  async register(userData) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    //Logging Register response tokens
    if (response?.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      console.group('[tokens] Register stored access token');
      this._logToken('accessToken', response.accessToken);
      console.groupEnd();
      this._scheduleAccessRefresh();
    }
    if (response?.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
      console.group('[tokens] Register stored refresh token');
      this._logToken('refreshToken', response.refreshToken);
      console.groupEnd();
    }
    return response;
  },

  async login(credentials) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    //Logging Login response tokens
    if (response?.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      console.group('[tokens] Login stored access token');
      this._logToken('accessToken', response.accessToken);
      console.groupEnd();
      this._scheduleAccessRefresh();
    }
    if (response?.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
      console.group('[tokens] Login stored refresh token');
      this._logToken('refreshToken', response.refreshToken);
      console.groupEnd();
    }
    return response;
  },

async googleSignIn(idToken) {
    const response = await this.request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    //Logging Google sign-in response tokens
    if (response?.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      console.group('[tokens] Google sign-in stored access token');
      this._logToken('accessToken', response.accessToken);
      console.groupEnd();
      this._scheduleAccessRefresh();
    }
    if (response?.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
      console.group('[tokens] Google sign-in stored refresh token');
      this._logToken('refreshToken', response.refreshToken);
      console.groupEnd();
    }
    return response;
  },


  async getCurrentUser() {
    return this.request('/api/user/me');
  },

  async updateUser(userData) {
    return this.request('/api/user/me', {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  },
};

export { authAPI };