/**
 * Módulo de Integração com a API Backend — AniTrack
 * Gerencia tokens de autenticação, sessões e requisições HTTP para a API de Animes e Microsserviços.
 */

const API_BASE = '/api';

export const api = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },

  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
      this.clearSession();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Erro ${response.status}: Falha na requisição`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.code = data.code;
      err.data = data;
      throw err;
    }

    return data;
  },

  // ===== AUTH & MICROSSERVIÇO DE AUTENTICAÇÃO =====
  async register(nome, email, senha, role = 'usuario') {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha, role })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async login(email, senha) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async me() {
    const data = await this.request('/auth/me');
    if (data && data.user) {
      this.setUser(data.user);
    }
    return data;
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Erro ao notificar logout no backend:', e);
    } finally {
      this.clearSession();
    }
  },

  async getUserRole(userId) {
    return this.request(`/auth/role/${userId}`);
  },

  // ===== ESQUECI MINHA SENHA & REDEFINIÇÃO =====
  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async verifyResetToken(token) {
    return this.request(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      method: 'GET'
    });
  },

  async resetPassword(token, nova_senha) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, nova_senha })
    });
  },

  // ===== ANIMES & CATÁLOGO =====
  async getAnimes(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.perPage) searchParams.set('perPage', params.perPage);
    if (params.search) searchParams.set('search', params.search);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.season) searchParams.set('season', params.season);
    if (params.seasonYear) searchParams.set('seasonYear', params.seasonYear);
    if (params.genre) searchParams.set('genre', params.genre);

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/animes${queryStr}`);
  },

  async getAnime(id) {
    return this.request(`/animes/${id}`);
  },

  // Retrocompatibilidade para chamadas antigas
  async getMovies(forceRefresh = false) {
    return this.getAnimes();
  },
  async getMovie(id) {
    return this.getAnime(id);
  },

  // ===== R4: SIMULCAST =====
  async getSimulcastWeekly() {
    return this.request('/animes/simulcast');
  },

  async getSimulcastToday() {
    return this.request('/animes/simulcast/hoje');
  },

  // ===== R1: ANIMES ASSISTIDOS =====
  async getWatched() {
    return this.request('/animes/assistidos');
  },

  async addWatched({ anime_id, titulo, poster_url, episodios_vistos = 0, total_episodios = 12, nota = null, status = 'concluido' }) {
    return this.request('/animes/assistidos', {
      method: 'POST',
      body: JSON.stringify({
        anime_id,
        titulo,
        poster_url,
        episodios_vistos,
        total_episodios,
        nota,
        status
      })
    });
  },

  async updateWatched(id, data) {
    return this.request(`/animes/assistidos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async removeWatched(id) {
    return this.request(`/animes/assistidos/${id}`, {
      method: 'DELETE'
    });
  },

  // ===== R2: ANIMES QUE IRÁ VER (PLAN TO WATCH) =====
  async getPlanToWatch() {
    return this.request('/animes/ira-ver');
  },

  async addPlanToWatch({ anime_id, titulo, poster_url, previsao_estreia = null }) {
    return this.request('/animes/ira-ver', {
      method: 'POST',
      body: JSON.stringify({
        anime_id,
        titulo,
        poster_url,
        previsao_estreia
      })
    });
  },

  async removePlanToWatch(id) {
    return this.request(`/animes/ira-ver/${id}`, {
      method: 'DELETE'
    });
  },

  // ===== R3: ANIMES FAVORITOS =====
  async getFavorites() {
    return this.request('/animes/favoritos');
  },

  async addFavorite(anime) {
    return this.request('/animes/favoritos', {
      method: 'POST',
      body: JSON.stringify({
        anime_id: anime.id || anime.anime_id,
        titulo: anime.titulo || anime.title,
        poster_url: anime.poster_url || anime.poster_path
      })
    });
  },

  async removeFavorite(animeId) {
    return this.request(`/animes/favoritos/${animeId}`, {
      method: 'DELETE'
    });
  },

  async togglePinFavorite(animeId, payload = {}) {
    const bodyObj = typeof payload === 'boolean'
      ? { fixado: payload }
      : (typeof payload === 'object' && payload !== null ? payload : {});

    return this.request(`/animes/favoritos/${animeId}/pin`, {
      method: 'PATCH',
      body: JSON.stringify(bodyObj)
    });
  },

  // ===== COMENTÁRIOS =====
  async getAnimeComments(animeId) {
    return this.request(`/animes/${animeId}/comments`);
  },

  async getMovieComments(id) {
    return this.getAnimeComments(id);
  },

  async addComment(animeId, texto) {
    return this.request(`/animes/${animeId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ texto })
    });
  },

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  // ===== PERFIL DO USUÁRIO =====
  async getProfile(userId = 'me') {
    return this.request(`/profile/${userId}`);
  },

  async updateProfile(data, userId = 'me') {
    return this.request(`/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async uploadProfilePhoto(formData, userId = 'me') {
    return this.request(`/profile/${userId}/photo`, {
      method: 'POST',
      body: formData
    });
  },

  async uploadProfileBanner(formData, userId = 'me') {
    return this.request(`/profile/${userId}/banner`, {
      method: 'POST',
      body: formData
    });
  },

  async deleteProfileBanner() {
    return this.request('/profile/banner', {
      method: 'DELETE'
    });
  },

  async exportUserData() {
    return this.request('/profile/export');
  },

  // ===== PLANO OTAKU PRO & ASSINATURA =====
  async toggleProStatus() {
    return this.request('/profile/toggle-pro', {
      method: 'POST'
    });
  },

  async createStripeCheckout() {
    return this.request('/stripe/create-checkout-session', {
      method: 'POST'
    });
  },

  async getStripeStatus() {
    return this.request('/stripe/status');
  },

  async verifyStripeSession(sessionId) {
    return this.request('/stripe/verify-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }
};
