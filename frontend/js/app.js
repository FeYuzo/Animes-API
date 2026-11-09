/**
 * Módulo Principal da Aplicação — AniTrack
 * Gerencia catálogo de animes, simulcast sazonal, listas (assistidos, irá ver, favoritos), comentários e perfil.
 */

import { api } from './api.js';
import { initAuth, updateNavUserAvatar, updateNavPremiumUI, openPremiumModal } from './auth.js';

// ============================================================================
// ELEMENTOS DO DOM
// ============================================================================
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const brandLogo = document.getElementById('brand-logo');

// Navegação de Views
const navBtnExplore = document.getElementById('nav-btn-explore');
const navBtnSimulcast = document.getElementById('nav-btn-simulcast');
const navBtnWatched = document.getElementById('nav-btn-watched');
const navBtnPlantowatch = document.getElementById('nav-btn-plantowatch');
const navBtnFavorites = document.getElementById('nav-btn-favorites');

const navCountWatched = document.getElementById('nav-count-watched');
const navCountPlantowatch = document.getElementById('nav-count-plantowatch');
const navCountFavorites = document.getElementById('nav-count-favorites');
const navBadgeSimulcastToday = document.getElementById('nav-badge-simulcast-today');

// Cabeçalho do Catálogo & Controles
const currentViewBadge = document.getElementById('current-view-badge');
const capacityBadge = document.getElementById('capacity-badge');
const catalogHeading = document.getElementById('catalog-heading');
const catalogSubheading = document.getElementById('catalog-subheading');
const inputSearch = document.getElementById('input-search');
const btnClearSearch = document.getElementById('btn-clear-search');
const selectSort = document.getElementById('select-sort');
const simulcastDaysBar = document.getElementById('simulcast-days-bar');
const dayCountHoje = document.getElementById('day-count-hoje');

// Estados
const loadingState = document.getElementById('loading-state');
const loadingText = document.getElementById('loading-text');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptyDesc = document.getElementById('empty-desc');
const btnEmptyReset = document.getElementById('btn-empty-reset');
const catalogAlert = document.getElementById('catalog-alert');
const animesGrid = document.getElementById('animes-grid');

// Paginação do Catálogo Geral
const catalogPagination = document.getElementById('catalog-pagination');
const paginationInfoText = document.getElementById('pagination-info-text');
const btnFirstPage = document.getElementById('btn-first-page');
const btnPrevPage = document.getElementById('btn-prev-page');
const paginationPagesList = document.getElementById('pagination-pages');
const btnNextPage = document.getElementById('btn-next-page');
const btnLastPage = document.getElementById('btn-last-page');

// Paginação Superior (Top)
const catalogTopPagination = document.getElementById('catalog-top-pagination');
const btnTopPrevPage = document.getElementById('btn-top-prev-page');
const btnTopNextPage = document.getElementById('btn-top-next-page');
const topPaginationText = document.getElementById('top-pagination-text');

// Modal de Detalhes do Anime
const animeModal = document.getElementById('anime-modal');
const btnCloseAnimeModal = document.getElementById('btn-close-anime-modal');
const modalBannerImg = document.getElementById('modal-banner-img');
const modalPosterImg = document.getElementById('modal-poster-img');
const modalFormatBadge = document.getElementById('modal-format-badge');
const modalStatusBadge = document.getElementById('modal-status-badge');
const modalScoreBadge = document.getElementById('modal-score-badge');
const modalAnimeTitle = document.getElementById('modal-anime-title');
const modalAnimeSubtitle = document.getElementById('modal-anime-subtitle');
const modalAnimeSynopsis = document.getElementById('modal-anime-synopsis');
const modalMetaEpisodes = document.getElementById('modal-meta-episodes');
const modalMetaSeason = document.getElementById('modal-meta-season');
const modalMetaStudio = document.getElementById('modal-meta-studio');
const modalMetaGenres = document.getElementById('modal-meta-genres');
const modalAiringBox = document.getElementById('modal-airing-box');
const modalAiringDesc = document.getElementById('modal-airing-desc');
const btnActionWatched = document.getElementById('btn-action-watched');
const lblActionWatched = document.getElementById('lbl-action-watched');
const btnActionPlantowatch = document.getElementById('btn-action-plantowatch');
const lblActionPlantowatch = document.getElementById('lbl-action-plantowatch');
const btnActionFavorite = document.getElementById('btn-action-favorite');
const lblActionFavorite = document.getElementById('lbl-action-favorite');
const btnActionPin = document.getElementById('btn-action-pin');
const lblActionPin = document.getElementById('lbl-action-pin');
const btnActionTrailer = document.getElementById('btn-action-trailer');
const formAddComment = document.getElementById('form-add-comment');
const commentText = document.getElementById('comment-text');
const btnSaveComment = document.getElementById('btn-save-comment');
const commentsList = document.getElementById('comments-list');
const modalCommentsCount = document.getElementById('modal-comments-count');

// Modal de Assistidos (Progresso)
const watchedModal = document.getElementById('watched-modal');
const btnCloseWatchedModal = document.getElementById('btn-close-watched-modal');
const formEditWatched = document.getElementById('form-edit-watched');
const watchedModalAnimeTitle = document.getElementById('watched-modal-anime-title');
const inputWatchedEps = document.getElementById('input-watched-eps');
const inputWatchedTotal = document.getElementById('input-watched-total');
const inputWatchedScore = document.getElementById('input-watched-score');
const inputWatchedStatus = document.getElementById('input-watched-status');
const btnRemoveWatchedRecord = document.getElementById('btn-remove-watched-record');

// Modal de Perfil
const profileModal = document.getElementById('profile-modal');
const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
const btnOpenMyProfile = document.getElementById('btn-open-my-profile');
const profileBannerImg = document.getElementById('profile-banner-img');
const profileBannerFallback = document.getElementById('profile-banner-fallback');
const profileBannerControls = document.getElementById('profile-banner-controls');
const inputProfileBanner = document.getElementById('input-profile-banner');
const btnUploadBanner = document.getElementById('btn-upload-banner');
const btnRemoveBanner = document.getElementById('btn-remove-banner');
const uploadBannerSpinner = document.getElementById('upload-banner-spinner');
const lblBannerBtnText = document.getElementById('lbl-banner-btn-text');
const profileAvatarCircle = document.getElementById('profile-avatar-circle');
const profileAvatarImg = document.getElementById('profile-avatar-img');
const profileAvatarFallback = document.getElementById('profile-avatar-fallback');
const profilePhotoControls = document.getElementById('profile-photo-controls');
const inputProfilePhoto = document.getElementById('input-profile-photo');
const uploadPhotoSpinner = document.getElementById('upload-photo-spinner');
const profileDisplayName = document.getElementById('profile-display-name');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profilePremiumBadge = document.getElementById('profile-premium-badge');
const profileEmail = document.getElementById('profile-email');
const profileCreatedAt = document.getElementById('profile-created-at');
const profileBioContainer = document.getElementById('profile-bio-container');
const profileBioText = document.getElementById('profile-bio-text');
const profileOwnerActions = document.getElementById('profile-owner-actions');
const btnToggleEditProfile = document.getElementById('btn-toggle-edit-profile');
const formEditProfile = document.getElementById('form-edit-profile');
const editProfileName = document.getElementById('edit-profile-name');
const editProfileBio = document.getElementById('edit-profile-bio');
const editBioCounter = document.getElementById('edit-bio-counter');
const statCountWatched = document.getElementById('stat-count-watched');
const statLimitWatched = document.getElementById('stat-limit-watched');
const statCountPlantowatch = document.getElementById('stat-count-plantowatch');
const statLimitPlantowatch = document.getElementById('stat-limit-plantowatch');
const statCountFavorites = document.getElementById('stat-count-favorites');
const statLimitFavorites = document.getElementById('stat-limit-favorites');
const statCountPinned = document.getElementById('stat-count-pinned');
const statLimitPinned = document.getElementById('stat-limit-pinned');
const statCountTime = document.getElementById('stat-count-time');
const statDescTime = document.getElementById('stat-desc-time');
const profilePinnedBadge = document.getElementById('profile-pinned-badge');
const profilePinnedList = document.getElementById('profile-pinned-list');
const btnExportLibrary = document.getElementById('btn-export-library');
const btnProfileSubscribe = document.getElementById('btn-profile-subscribe');
const profileAlert = document.getElementById('profile-alert');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// ============================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================================================
let currentView = 'explore'; // 'explore' | 'simulcast' | 'watched' | 'plantowatch' | 'favorites'
let currentSearch = '';
let currentSort = 'popularity-desc';
let activeSimulcastDay = 'hoje';

let catalogAnimes = [];
let catalogCurrentPage = 1;
let catalogTotalPages = 1;
let catalogTotalItems = 0;
const CATALOG_PER_PAGE = 30;
let searchDebounceTimer = null;
let simulcastWeeklyData = null;
let simulcastTodayData = null;
let watchedState = [];
let planToWatchState = [];
let favoritesState = [];

let activeAnimeForModal = null;
let activeWatchedTarget = null;
let currentUser = null;

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
export function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// 1. CARREGAMENTO E ATUALIZAÇÃO DE DADOS
// ============================================================================

async function refreshUserData() {
  currentUser = api.getUser();
  if (!currentUser) return;

  try {
    const [watchedRes, planRes, favRes] = await Promise.all([
      api.getWatched().catch(() => ({ animes: [] })),
      api.getPlanToWatch().catch(() => ({ animes: [] })),
      api.getFavorites().catch(() => ({ favorites: [] }))
    ]);

    watchedState = watchedRes.animes || [];
    planToWatchState = planRes.animes || [];
    favoritesState = favRes.favorites || [];

    // Atualiza contadores dos pills na navbar
    if (navCountWatched) navCountWatched.textContent = watchedState.length;
    if (navCountPlantowatch) navCountPlantowatch.textContent = planToWatchState.length;
    if (navCountFavorites) navCountFavorites.textContent = favoritesState.length;

    updateCapacityBadge();
  } catch (err) {
    console.warn('[AniTrack] Falha ao sincronizar dados do usuário:', err.message);
  }
}

function updateCapacityBadge() {
  if (!capacityBadge) return;
  const isPro = Boolean(currentUser?.is_premium || currentUser?.role === 'admin');
  const pinnedCount = favoritesState.filter((f) => f.fixado).length;

  if (isPro) {
    capacityBadge.innerHTML = `<span style="color: var(--accent-gold); font-weight: 700;">⭐ Membro Otaku Pro • Listas Ilimitadas • Fixados: ${pinnedCount}/6</span>`;
    return;
  }

  if (currentView === 'favorites') {
    capacityBadge.textContent = `Plano Gratuito • Favoritos Ilimitados • Fixados no Perfil: ${pinnedCount}/2`;
  } else if (currentView === 'watched') {
    capacityBadge.textContent = `Plano Gratuito • ${watchedState.length} assistidos (Ilimitado)`;
  } else if (currentView === 'plantowatch') {
    capacityBadge.textContent = `Plano Gratuito • ${planToWatchState.length} na fila (Ilimitado)`;
  } else {
    capacityBadge.textContent = `Plano Gratuito • Listas Ilimitadas • Até 2 animes fixados no perfil`;
  }
}

// ============================================================================
// 2. RENDERIZAÇÃO DAS VIEWS
// ============================================================================

function switchView(viewName) {
  currentView = viewName;

  // Atualiza botões da navbar
  [navBtnExplore, navBtnSimulcast, navBtnWatched, navBtnPlantowatch, navBtnFavorites].forEach((btn) => {
    if (btn) btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Atualiza títulos e controles visíveis
  simulcastDaysBar?.classList.toggle('hidden', viewName !== 'simulcast');
  document.querySelector('.sort-box')?.classList.toggle('hidden', viewName === 'simulcast');
  catalogPagination?.classList.toggle('hidden', viewName !== 'explore');
  catalogTopPagination?.classList.toggle('hidden', viewName !== 'explore');

  if (viewName === 'explore') {
    currentViewBadge.textContent = 'Catálogo Geral';
    catalogHeading.textContent = 'Explorar Animes';
    catalogSubheading.textContent = 'Obras em alta, populares e lançamentos sincronizados via AniList';
    loadExploreCatalog(1);
  } else if (viewName === 'simulcast') {
    currentViewBadge.textContent = 'Simulcast Sazonal';
    catalogHeading.textContent = 'Grade Semanal de Simulcast';
    catalogSubheading.textContent = 'Episódios transmitidos simultaneamente com o Japão nesta temporada';
    loadSimulcast();
  } else if (viewName === 'watched') {
    currentViewBadge.textContent = 'Histórico Pessoal';
    catalogHeading.textContent = 'Animes Assistidos';
    catalogSubheading.textContent = 'Registro de obras concluídas, episódios vistos e notas pessoais';
    renderWatchedList();
  } else if (viewName === 'plantowatch') {
    currentViewBadge.textContent = 'Fila de Espera';
    catalogHeading.textContent = 'Animes que Irá Ver';
    catalogSubheading.textContent = 'Sua lista de planejamento (Watchlist) para as próximas férias';
    renderPlanToWatchList();
  } else if (viewName === 'favorites') {
    currentViewBadge.textContent = 'Galeria Pessoal';
    catalogHeading.textContent = 'Meus Animes Favoritos';
    catalogSubheading.textContent = 'Obras de maior destaque no seu perfil comunitário';
    renderFavoritesList();
  }

  updateCapacityBadge();
}

/**
 * Carrega e renderiza o catálogo geral com paginação
 */
async function loadExploreCatalog(page = 1) {
  catalogCurrentPage = Math.max(1, parseInt(page, 10) || 1);
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';
  catalogAlert.classList.add('hidden');
  catalogPagination?.classList.add('hidden');
  catalogTopPagination?.classList.add('hidden');

  let sortParam = 'POPULARITY_DESC';
  if (currentSort === 'score-desc') sortParam = 'SCORE_DESC';
  if (currentSort === 'trending-desc') sortParam = 'TRENDING_DESC';
  if (currentSort === 'title-asc') sortParam = 'TITLE_ROMAJI';

  try {
    const data = await api.getAnimes({
      page: catalogCurrentPage,
      perPage: CATALOG_PER_PAGE,
      search: currentSearch || undefined,
      sort: sortParam
    });

    catalogAnimes = data.animes || [];

    if (catalogAnimes.length === 0) {
      showEmptyState('Nenhum anime encontrado', 'Tente pesquisar por outros termos.');
      catalogPagination?.classList.add('hidden');
      catalogTopPagination?.classList.add('hidden');
    } else {
      renderAnimeCards(catalogAnimes);
      updatePaginationControls(data.pageInfo, data.total);
    }
  } catch (err) {
    catalogAlert.textContent = `Aviso: ${err.message || 'Erro ao carregar catálogo na AniList.'}`;
    catalogAlert.className = 'alert alert-danger';
    catalogAlert.classList.remove('hidden');
    catalogPagination?.classList.add('hidden');
    catalogTopPagination?.classList.add('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

/**
 * Atualiza os controles de paginação (anterior, próxima, páginas numeradas)
 */
function updatePaginationControls(pageInfo, totalCount) {
  if (!catalogPagination || currentView !== 'explore') return;

  const total = pageInfo?.total || totalCount || 5000;
  const lastPage = pageInfo?.lastPage || Math.ceil(total / CATALOG_PER_PAGE) || 1;
  const currentPage = pageInfo?.currentPage || catalogCurrentPage || 1;

  catalogTotalPages = Math.max(1, lastPage);
  catalogCurrentPage = Math.min(currentPage, catalogTotalPages);
  catalogTotalItems = total;

  if (catalogTotalPages <= 1 && catalogAnimes.length === 0) {
    catalogPagination.classList.add('hidden');
    catalogTopPagination?.classList.add('hidden');
    return;
  }

  catalogPagination.classList.remove('hidden');
  catalogTopPagination?.classList.remove('hidden');

  const totalFormatted = catalogTotalItems.toLocaleString('pt-BR');
  const startItem = (catalogCurrentPage - 1) * CATALOG_PER_PAGE + 1;
  const endItem = Math.min(catalogCurrentPage * CATALOG_PER_PAGE, catalogTotalItems);

  if (paginationInfoText) {
    paginationInfoText.innerHTML = `Mostrando animes <strong>${startItem}–${endItem}</strong> de <strong>${totalFormatted}</strong> &bull; Página <strong>${catalogCurrentPage}</strong> de <strong>${catalogTotalPages}</strong>`;
  }

  if (topPaginationText) {
    topPaginationText.textContent = `Pág. ${catalogCurrentPage} / ${catalogTotalPages}`;
  }

  const isFirst = catalogCurrentPage <= 1;
  const isLast = catalogCurrentPage >= catalogTotalPages || (pageInfo && pageInfo.hasNextPage === false);

  if (btnFirstPage) btnFirstPage.disabled = isFirst;
  if (btnPrevPage) btnPrevPage.disabled = isFirst;
  if (btnTopPrevPage) btnTopPrevPage.disabled = isFirst;

  if (btnNextPage) btnNextPage.disabled = isLast;
  if (btnTopNextPage) btnTopNextPage.disabled = isLast;
  if (btnLastPage) btnLastPage.disabled = isLast;

  if (paginationPagesList) {
    paginationPagesList.innerHTML = '';

    const delta = 2;
    const range = [];
    for (let i = 1; i <= catalogTotalPages; i++) {
      if (i === 1 || i === catalogTotalPages || (i >= catalogCurrentPage - delta && i <= catalogCurrentPage + delta)) {
        range.push(i);
      }
    }

    let prevPageNum = null;
    for (const pageNum of range) {
      if (prevPageNum) {
        if (pageNum - prevPageNum === 2) {
          paginationPagesList.appendChild(createPageButton(prevPageNum + 1));
        } else if (pageNum - prevPageNum > 2) {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'page-number-btn ellipsis';
          ellipsis.textContent = '...';
          paginationPagesList.appendChild(ellipsis);
        }
      }
      paginationPagesList.appendChild(createPageButton(pageNum));
      prevPageNum = pageNum;
    }
  }
}

function createPageButton(pageNum) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `page-number-btn ${pageNum === catalogCurrentPage ? 'active' : ''}`;
  btn.textContent = String(pageNum);
  btn.title = `Ir para página ${pageNum}`;
  if (pageNum === catalogCurrentPage) {
    btn.setAttribute('aria-current', 'page');
  } else {
    btn.addEventListener('click', () => {
      goToCatalogPage(pageNum);
    });
  }
  return btn;
}

function goToCatalogPage(pageNum) {
  if (pageNum < 1 || pageNum > catalogTotalPages || pageNum === catalogCurrentPage) return;
  loadExploreCatalog(pageNum);
  const anchor = document.getElementById('catalog-heading') || document.getElementById('animes-grid');
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Carrega e renderiza a grade de simulcast
 */
async function loadSimulcast() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';
  catalogAlert.classList.add('hidden');

  try {
    if (!simulcastWeeklyData || !simulcastTodayData) {
      const [weekly, today] = await Promise.all([
        api.getSimulcastWeekly(),
        api.getSimulcastToday()
      ]);
      simulcastWeeklyData = weekly;
      simulcastTodayData = today;

      if (dayCountHoje) {
        dayCountHoje.textContent = today.episodes?.length || 0;
      }
      if (navBadgeSimulcastToday && today.episodes?.length > 0) {
        navBadgeSimulcastToday.classList.remove('hidden');
      }
    }

    renderActiveSimulcastDay();
  } catch (err) {
    catalogAlert.textContent = `Erro ao consultar grade de Simulcast: ${err.message}`;
    catalogAlert.className = 'alert alert-danger';
    catalogAlert.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

function renderActiveSimulcastDay() {
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';

  let list = [];
  if (activeSimulcastDay === 'hoje') {
    list = simulcastTodayData?.episodes || [];
  } else {
    list = simulcastWeeklyData?.days?.[activeSimulcastDay] || [];
  }

  // Aplica busca textual se houver
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) => (item.titulo || '').toLowerCase().includes(q) || (item.titulo_romaji || '').toLowerCase().includes(q));
  }

  if (list.length === 0) {
    showEmptyState(`Nenhum episódio agendado para ${activeSimulcastDay === 'hoje' ? 'hoje' : activeSimulcastDay}`, 'Selecione outro dia da semana acima.');
  } else {
    renderAnimeCards(list, true);
  }
}

/**
 * Renderiza animes assistidos
 */
function renderWatchedList() {
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';

  let list = [...watchedState];
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) => (item.titulo || '').toLowerCase().includes(q));
  }

  if (list.length === 0) {
    showEmptyState('Nenhum anime assistido registrado ainda', 'Explore o catálogo e clique no ícone de olho para marcar seu progresso.');
  } else {
    renderAnimeCards(list, false, 'watched');
  }
}

/**
 * Renderiza animes que irá ver (Watchlist)
 */
function renderPlanToWatchList() {
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';

  let list = [...planToWatchState];
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) => (item.titulo || '').toLowerCase().includes(q));
  }

  if (list.length === 0) {
    showEmptyState('Sua fila de espera está vazia', 'Adicione obras que estreiam na próxima temporada para planejar o que assistir.');
  } else {
    renderAnimeCards(list, false, 'plantowatch');
  }
}

/**
 * Renderiza animes favoritos
 */
function renderFavoritesList() {
  emptyState.classList.add('hidden');
  animesGrid.innerHTML = '';

  let list = [...favoritesState];
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) => (item.titulo || '').toLowerCase().includes(q));
  }

  if (list.length === 0) {
    showEmptyState('Nenhum anime favoritado', 'Clique no ícone de coração nos animes para destacá-los aqui.');
  } else {
    renderAnimeCards(list, false, 'favorites');
  }
}

function showEmptyState(title, desc) {
  emptyTitle.textContent = title;
  emptyDesc.textContent = desc;
  emptyState.classList.remove('hidden');
}

// ============================================================================
// 3. RENDERIZAÇÃO DE CARDS DE ANIME
// ============================================================================

function renderAnimeCards(list, isSimulcast = false, contextType = null) {
  animesGrid.innerHTML = '';

  const watchedMap = new Map(watchedState.map((w) => [w.anime_id, w]));
  const planMap = new Map(planToWatchState.map((p) => [p.anime_id, p]));
  const favSet = new Set(favoritesState.map((f) => f.anime_id));

  list.forEach((item) => {
    const animeId = item.anime_id || item.id;
    const title = item.titulo || item.title || item.titulo_romaji || 'Anime sem título';
    const poster = item.poster_url || item.poster_path || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="%231a2336" width="200" height="300"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Sem Pôster</text></svg>';

    const isFav = favSet.has(animeId);
    const favItem = favoritesState.find((f) => f.anime_id === animeId);
    const isPinned = Boolean(favItem?.fixado);
    const watchedData = watchedMap.get(animeId);
    const isPlan = planMap.has(animeId);

    const card = document.createElement('div');
    card.className = 'anime-card';
    card.setAttribute('data-id', animeId);

    // Badges no topo do pôster
    let topBadgesHtml = '';
    if (isPinned) {
      topBadgesHtml += `<span class="pill-badge pill-badge-pinned" title="Fixado no seu perfil">📌 Fixado</span>`;
    }
    if (isSimulcast && item.episodio) {
      topBadgesHtml += `<span class="pill-badge pill-badge-accent">EP ${item.episodio}</span>`;
      if (item.horario_exibicao) {
        topBadgesHtml += `<span class="pill-badge pill-badge-neutral">${item.horario_exibicao}</span>`;
      }
    } else {
      const score = item.score_medio || (item.score ? item.score : null);
      if (score) {
        topBadgesHtml += `<span class="pill-badge pill-badge-gold">★ ${(score / 10).toFixed(1)}</span>`;
      }
      if (item.formato) {
        topBadgesHtml += `<span class="pill-badge pill-badge-neutral">${item.formato}</span>`;
      }
    }

    // Progresso para itens assistidos
    let progressHtml = '';
    if (watchedData) {
      const eps = watchedData.episodios_vistos || 0;
      const total = watchedData.total_episodios || 12;
      const pct = Math.min(Math.round((eps / total) * 100), 100);
      progressHtml = `
        <div class="card-progress-bar" title="${eps}/${total} episódios (${pct}%)">
          <div class="card-progress-fill" style="width: ${pct}%;"></div>
        </div>
      `;
    }

    // Botão de Fixar no Perfil (SEMPRE visível em todos os cards)
    const pinBtnHtml = `
      <button class="quick-action-btn btn-quick-pin ${isPinned ? 'active-pin' : ''}" title="${isPinned ? 'Desfixar do perfil (📌)' : 'Fixar no topo do perfil (📌)'}" data-id="${animeId}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
      </button>
    `;

    card.innerHTML = `
      <div class="anime-card-poster-wrapper">
        <img class="anime-card-poster" src="${poster}" alt="${title}" loading="lazy">
        <div class="anime-card-badges-top">${topBadgesHtml}</div>
        
        <div class="anime-card-actions-quick" onclick="event.stopPropagation();">
          <button class="quick-action-btn btn-quick-watched ${watchedData ? 'active-watched' : ''}" title="${watchedData ? 'Editar progresso' : 'Marcar como Assistido'}" data-id="${animeId}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          
          <button class="quick-action-btn btn-quick-plantowatch ${isPlan ? 'active-plantowatch' : ''}" title="${isPlan ? 'Remover da fila' : 'Adicionar à fila (Irá Ver)'}" data-id="${animeId}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </button>

          <button class="quick-action-btn btn-quick-favorite ${isFav ? 'active-favorite' : ''}" title="${isFav ? 'Remover dos favoritos' : 'Favoritar'}" data-id="${animeId}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>

          ${pinBtnHtml}
        </div>
      </div>

      <div class="anime-card-info">
        <h4 class="anime-card-title">${title}</h4>
        <div class="anime-card-meta">
          <span>${item.total_episodios || item.episodes ? `${item.total_episodios || item.episodes} eps` : 'Em exibição'}</span>
          ${item.generos && item.generos[0] ? `<span>• ${item.generos[0]}</span>` : ''}
        </div>
        ${progressHtml}
      </div>
    `;

    // Eventos nos botões rápidos
    const btnWatched = card.querySelector('.btn-quick-watched');
    const btnPlan = card.querySelector('.btn-quick-plantowatch');
    const btnFav = card.querySelector('.btn-quick-favorite');
    const btnPin = card.querySelector('.btn-quick-pin');

    btnWatched.addEventListener('click', (e) => {
      e.stopPropagation();
      openWatchedModal(item);
    });

    btnPlan.addEventListener('click', async (e) => {
      e.stopPropagation();
      await togglePlanToWatch(item);
    });

    btnFav.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(item);
    });

    if (btnPin) {
      btnPin.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleTogglePinFavorite(animeId, item);
      });
    }

    // Abrir Modal de Detalhes
    card.addEventListener('click', () => {
      openAnimeDetailModal(animeId);
    });

    animesGrid.appendChild(card);
  });
}

// ============================================================================
// 4. AÇÕES RÁPIDAS (FAVORITAR, FILA, ASSISTIDOS)
// ============================================================================

async function toggleFavorite(anime) {
  const animeId = anime.anime_id || anime.id;
  const isFav = favoritesState.some((f) => f.anime_id === animeId);

  try {
    if (isFav) {
      await api.removeFavorite(animeId);
      showToast('Anime removido dos favoritos.', 'info');
    } else {
      await api.addFavorite(anime);
      showToast('Anime adicionado aos favoritos!', 'success');
    }
    await refreshUserData();
    reRenderCurrentView();
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
    } else {
      showToast(err.message, 'error');
    }
  }
}

async function togglePlanToWatch(anime) {
  const animeId = anime.anime_id || anime.id;
  const isPlan = planToWatchState.some((p) => p.anime_id === animeId);

  try {
    if (isPlan) {
      await api.removePlanToWatch(animeId);
      showToast('Anime removido da fila de espera.', 'info');
    } else {
      await api.addPlanToWatch({
        anime_id: animeId,
        titulo: anime.titulo || anime.title || anime.titulo_romaji,
        poster_url: anime.poster_url || anime.poster_path,
        previsao_estreia: anime.temporada ? `${anime.temporada} ${anime.ano_temporada || ''}` : null
      });
      showToast('Anime adicionado à sua fila (Irá Ver)!', 'success');
    }
    await refreshUserData();
    reRenderCurrentView();
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
    } else {
      showToast(err.message, 'error');
    }
  }
}

function reRenderCurrentView() {
  if (currentView === 'explore') renderAnimeCards(catalogAnimes);
  else if (currentView === 'simulcast') renderActiveSimulcastDay();
  else if (currentView === 'watched') renderWatchedList();
  else if (currentView === 'plantowatch') renderPlanToWatchList();
  else if (currentView === 'favorites') renderFavoritesList();
}

// ============================================================================
// 5. MODAL DE DETALHES DO ANIME & COMENTÁRIOS
// ============================================================================

async function openAnimeDetailModal(animeId) {
  animeModal?.classList.remove('hidden');
  modalAnimeTitle.textContent = 'Carregando detalhes...';
  modalAnimeSubtitle.textContent = '';
  modalAnimeSynopsis.textContent = '';
  commentsList.innerHTML = '<div class="text-muted text-xs text-center py-3">Carregando comentários comunitários...</div>';

  try {
    const anime = await api.getAnime(animeId);
    activeAnimeForModal = anime;

    modalBannerImg.src = anime.banner_url || anime.poster_url || '';
    modalPosterImg.src = anime.poster_url || '';
    modalAnimeTitle.textContent = anime.titulo || anime.titulo_romaji || 'Anime';
    modalAnimeSubtitle.textContent = anime.titulo_original ? `${anime.titulo_original} • ${anime.titulo_romaji || ''}` : (anime.titulo_romaji || '');
    modalAnimeSynopsis.textContent = anime.sinopse || anime.overview || 'Sinopse não informada.';

    modalFormatBadge.textContent = anime.formato || 'TV';
    modalStatusBadge.textContent = anime.status || 'STATUS';
    modalScoreBadge.textContent = anime.score_medio ? `★ ${(anime.score_medio / 10).toFixed(1)}` : '★ -';

    modalMetaEpisodes.textContent = anime.total_episodios ? `${anime.total_episodios} episódios` : 'Em exibição';
    modalMetaSeason.textContent = anime.temporada ? `${anime.temporada} ${anime.ano_temporada || ''}` : '-';
    modalMetaStudio.textContent = anime.estudio || 'Desconhecido';
    modalMetaGenres.textContent = anime.generos?.join(', ') || '-';

    // Próximo episódio
    if (anime.proximo_episodio) {
      modalAiringBox.classList.remove('hidden');
      const airDate = new Date(anime.proximo_episodio.airing_at * 1000);
      modalAiringDesc.textContent = `Episódio ${anime.proximo_episodio.episodio} estreia em ${airDate.toLocaleDateString('pt-BR')} às ${airDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      modalAiringBox.classList.add('hidden');
    }

    // Trailer
    if (anime.trailer && anime.trailer.url) {
      btnActionTrailer.href = anime.trailer.url;
      btnActionTrailer.classList.remove('hidden');
    } else {
      btnActionTrailer.classList.add('hidden');
    }

    updateModalActionButtons(anime);
    renderComments(anime.comments || []);
  } catch (err) {
    showToast(`Erro ao abrir detalhes: ${err.message}`, 'error');
    closeAnimeDetailModal();
  }
}

function updateModalActionButtons(anime) {
  const animeId = anime.id || anime.anime_id;
  const favItem = favoritesState.find((f) => f.anime_id === animeId);
  const isFav = Boolean(favItem);
  const isPinned = Boolean(favItem?.fixado);
  const watchedData = watchedState.find((w) => w.anime_id === animeId);
  const isPlan = planToWatchState.some((p) => p.anime_id === animeId);

  lblActionFavorite.textContent = isFav ? 'Favoritado ❤️' : 'Favoritar';
  lblActionPlantowatch.textContent = isPlan ? 'Na Fila 📋' : 'Adicionar à Fila (Irá Ver)';
  lblActionWatched.textContent = watchedData ? `Assistido (${watchedData.episodios_vistos || 0} eps)` : 'Marcar como Assistido';

  if (lblActionPin) {
    lblActionPin.textContent = isPinned ? 'Fixado no Perfil 📌' : 'Fixar no Perfil 📌';
    btnActionPin?.classList.toggle('btn-primary', isPinned);
    btnActionPin?.classList.toggle('btn-outline', !isPinned);
  }
}

function closeAnimeDetailModal() {
  animeModal?.classList.add('hidden');
  activeAnimeForModal = null;
}

// Submissão de Comentário Comunitário
formAddComment?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeAnimeForModal) return;

  const texto = commentText.value.trim();
  if (!texto) return;

  btnSaveComment.disabled = true;
  btnSaveComment.innerHTML = '<span class="spinner-sm"></span>';

  try {
    await api.addComment(activeAnimeForModal.id, texto);
    commentText.value = '';
    showToast('Comentário publicado!', 'success');

    // Recarrega comentários
    const updated = await api.getAnime(activeAnimeForModal.id);
    renderComments(updated.comments || []);
  } catch (err) {
    showToast(`Erro ao comentar: ${err.message}`, 'error');
  } finally {
    btnSaveComment.disabled = false;
    btnSaveComment.innerHTML = '<span>Publicar Comentário</span>';
  }
});

function renderComments(comments) {
  commentsList.innerHTML = '';
  modalCommentsCount.textContent = comments.length;

  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="text-muted text-xs text-center py-3">Nenhum comentário ainda. Seja o primeiro a comentar!</p>';
    return;
  }

  const currentUserId = currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';

  comments.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const avatarUrl = c.autor_foto ? `/api/profile/photo/${c.autor_foto}` : null;
    const authorInitial = (c.autor_nome || 'O')[0].toUpperCase();
    const canDelete = isAdmin || c.usuario_id === currentUserId;

    item.innerHTML = `
      <div class="comment-avatar">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar">` : authorInitial}
      </div>
      <div class="comment-body">
        <div class="comment-header">
          <div class="comment-author-group">
            <span class="comment-author-name">${c.autor_nome || 'Otaku'}</span>
            ${c.autor_is_premium ? '<span class="user-premium-badge">⭐ OTAKU PRO</span>' : ''}
            <span class="comment-date">• ${new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
          </div>
          ${canDelete ? `<button class="btn-delete-comment" data-id="${c.id}" title="Excluir comentário">&times;</button>` : ''}
        </div>
        <p class="comment-text">${c.texto}</p>
      </div>
    `;

    const btnDel = item.querySelector('.btn-delete-comment');
    btnDel?.addEventListener('click', async () => {
      if (!confirm('Deseja realmente excluir este comentário?')) return;
      try {
        await api.deleteComment(c.id);
        showToast('Comentário excluído.', 'info');
        const updated = await api.getAnime(activeAnimeForModal.id);
        renderComments(updated.comments || []);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    commentsList.appendChild(item);
  });
}

// Botões de Ação no Modal de Detalhes
btnActionFavorite?.addEventListener('click', async () => {
  if (!activeAnimeForModal) return;
  await toggleFavorite(activeAnimeForModal);
  updateModalActionButtons(activeAnimeForModal);
});

btnActionPin?.addEventListener('click', async () => {
  if (!activeAnimeForModal) return;
  const animeId = activeAnimeForModal.id || activeAnimeForModal.anime_id;
  await handleTogglePinFavorite(animeId, activeAnimeForModal);
  updateModalActionButtons(activeAnimeForModal);
});

btnActionPlantowatch?.addEventListener('click', async () => {
  if (!activeAnimeForModal) return;
  await togglePlanToWatch(activeAnimeForModal);
  updateModalActionButtons(activeAnimeForModal);
});

btnActionWatched?.addEventListener('click', () => {
  if (!activeAnimeForModal) return;
  openWatchedModal(activeAnimeForModal);
});

// ============================================================================
// 6. MODAL DE ASSISTIDOS (EDITAR PROGRESSO / NOTA)
// ============================================================================

function openWatchedModal(anime) {
  activeWatchedTarget = anime;
  watchedModal?.classList.remove('hidden');

  const animeId = anime.anime_id || anime.id;
  const existing = watchedState.find((w) => w.anime_id === animeId);

  watchedModalAnimeTitle.textContent = anime.titulo || anime.title || anime.titulo_romaji || 'Anime';
  inputWatchedEps.value = existing ? existing.episodios_vistos : (anime.total_episodios || 12);
  inputWatchedTotal.value = existing ? existing.total_episodios : (anime.total_episodios || 12);
  inputWatchedScore.value = existing && existing.nota ? String(existing.nota) : '';
  inputWatchedStatus.value = existing ? existing.status : 'concluido';

  btnRemoveWatchedRecord.classList.toggle('hidden', !existing);
}

function closeWatchedModal() {
  watchedModal?.classList.add('hidden');
  activeWatchedTarget = null;
}

formEditWatched?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeWatchedTarget) return;

  const animeId = activeWatchedTarget.anime_id || activeWatchedTarget.id;
  const existing = watchedState.find((w) => w.anime_id === animeId);

  const payload = {
    anime_id: animeId,
    titulo: activeWatchedTarget.titulo || activeWatchedTarget.title || activeWatchedTarget.titulo_romaji,
    poster_url: activeWatchedTarget.poster_url || activeWatchedTarget.poster_path,
    episodios_vistos: parseInt(inputWatchedEps.value, 10) || 0,
    total_episodios: parseInt(inputWatchedTotal.value, 10) || 12,
    nota: inputWatchedScore.value ? parseInt(inputWatchedScore.value, 10) : null,
    status: inputWatchedStatus.value
  };

  try {
    if (existing) {
      await api.updateWatched(existing.id, payload);
      showToast('Registro de assistido atualizado!', 'success');
    } else {
      await api.addWatched(payload);
      showToast('Anime adicionado aos assistidos!', 'success');
    }
    closeWatchedModal();
    await refreshUserData();
    reRenderCurrentView();
    if (activeAnimeForModal && (activeAnimeForModal.id === animeId || activeAnimeForModal.anime_id === animeId)) {
      updateModalActionButtons(activeAnimeForModal);
    }
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      closeWatchedModal();
      openPremiumModal();
    } else {
      showToast(err.message, 'error');
    }
  }
});

btnRemoveWatchedRecord?.addEventListener('click', async () => {
  if (!activeWatchedTarget) return;
  const animeId = activeWatchedTarget.anime_id || activeWatchedTarget.id;
  const existing = watchedState.find((w) => w.anime_id === animeId);
  if (!existing) return;

  try {
    await api.removeWatched(existing.id);
    showToast('Anime removido dos assistidos.', 'info');
    closeWatchedModal();
    await refreshUserData();
    reRenderCurrentView();
    if (activeAnimeForModal) updateModalActionButtons(activeAnimeForModal);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ============================================================================
// 7. MODAL DE PERFIL DO USUÁRIO
// ============================================================================

async function openProfileModal() {
  profileModal?.classList.remove('hidden');
  profileAlert.classList.add('hidden');
  formEditProfile.classList.add('hidden');
  profileBioContainer.classList.remove('hidden');

  try {
    const res = await api.getProfile('me');
    const profile = res.profile;

    profileDisplayName.textContent = profile.nome || 'Usuário';
    profileEmail.textContent = profile.email || '';
    profileRoleBadge.textContent = profile.role || 'usuario';
    profileCreatedAt.textContent = profile.criado_em ? `Membro desde ${new Date(profile.criado_em).toLocaleDateString('pt-BR')}` : '';
    profileBioText.textContent = profile.bio || 'Sem biografia cadastrada ainda.';

    editProfileName.value = profile.nome || '';
    editProfileBio.value = profile.bio || '';
    editBioCounter.textContent = `${(profile.bio || '').length}/500`;

    const isPro = Boolean(profile.is_premium || profile.role === 'admin' || currentUser?.role === 'admin');
    profilePremiumBadge.classList.toggle('hidden', !isPro);

    // Sincroniza cache local do usuário com dados atualizados do perfil
    if (currentUser) {
      currentUser.is_premium = isPro;
      currentUser.role = profile.role || currentUser.role;
      currentUser.foto_perfil = profile.foto_perfil;
      currentUser.banner_perfil = profile.banner_perfil;
      api.setUser(currentUser);
      updateNavPremiumUI(currentUser);
      updateCapacityBadge();
    }

    // 1. Atualização do Banner do Perfil
    if (profile.banner_url) {
      const cleanBanner = profile.banner_url.split('?')[0];
      profileBannerImg.src = `${cleanBanner}?t=${Date.now()}`;
      profileBannerImg.classList.remove('hidden');
      profileBannerFallback.classList.add('hidden');
      btnRemoveBanner?.classList.remove('hidden');
    } else {
      profileBannerImg.classList.add('hidden');
      profileBannerFallback.classList.remove('hidden');
      btnRemoveBanner?.classList.add('hidden');
    }

    if (lblBannerBtnText) {
      if (isPro) {
        lblBannerBtnText.textContent = profile.banner_url ? 'Trocar Banner' : 'Personalizar Banner ⭐';
      } else {
        lblBannerBtnText.textContent = 'Personalizar Banner (⭐ Otaku Pro)';
      }
    }
    profileBannerControls?.classList.remove('hidden');

    // 2. Avatar do usuário & Moldura VIP Glow
    if (profileAvatarCircle) {
      profileAvatarCircle.classList.toggle('pro-avatar-glow', isPro);
    }

    if (profile.foto_url) {
      const clean = profile.foto_url.split('?')[0];
      profileAvatarImg.src = `${clean}?t=${Date.now()}`;
      profileAvatarImg.classList.remove('hidden');
      profileAvatarFallback.classList.add('hidden');
    } else {
      profileAvatarImg.classList.add('hidden');
      profileAvatarFallback.classList.remove('hidden');
    }

    profileOwnerActions.classList.remove('hidden');
    profilePhotoControls.classList.remove('hidden');

    // 3. Estatísticas do Perfil (Listas ilimitadas para todos!)
    statCountWatched.textContent = watchedState.length;
    statCountPlantowatch.textContent = planToWatchState.length;
    statCountFavorites.textContent = favoritesState.length;

    statLimitWatched.textContent = 'Ilimitado';
    statLimitPlantowatch.textContent = 'Ilimitado';
    statLimitFavorites.textContent = 'Ilimitado';

    // 4. Animes Fixados no Perfil (2 no Free, 6 no Otaku Pro)
    const maxPinned = isPro ? 6 : 2;
    const pinnedItems = profile.animes_fixados || [];
    const pinnedCount = pinnedItems.length;

    if (statCountPinned) statCountPinned.textContent = `${pinnedCount}/${maxPinned}`;
    if (statLimitPinned) statLimitPinned.textContent = isPro ? '⭐ Máx 6 (Otaku Pro)' : 'Máx 2 (Plano Free)';
    if (profilePinnedBadge) profilePinnedBadge.textContent = `${pinnedCount}/${maxPinned} fixados`;

    // Tempo assistido
    if (statCountTime && profile.tempo_assistido) {
      statCountTime.textContent = `${profile.tempo_assistido.horas}h`;
    }
    if (statDescTime && profile.tempo_assistido) {
      statDescTime.textContent = `${profile.tempo_assistido.total_episodios} episódios (${profile.tempo_assistido.dias} dias)`;
    }

    // 5. Renderização dos cards de animes fixados
    if (profilePinnedList) {
      if (pinnedItems.length === 0) {
        profilePinnedList.innerHTML = `
          <div class="pinned-empty-msg">
            Nenhum anime fixado ainda. Na sua galeria de <strong>Favoritos</strong>, clique no botão <strong>📌</strong> em até ${maxPinned} animes para fixá-los aqui no topo do seu perfil!
          </div>
        `;
      } else {
        profilePinnedList.innerHTML = pinnedItems.map((anime) => `
          <div class="pinned-card-item" data-id="${anime.anime_id}">
            <img class="pinned-card-poster" src="${anime.poster_url || 'https://via.placeholder.com/120x180'}" alt="${anime.titulo}">
            <span class="pinned-card-title" title="${anime.titulo}">${anime.titulo}</span>
            <button type="button" class="pinned-card-unpin-btn" title="Desfixar do perfil" data-id="${anime.anime_id}">
              &times;
            </button>
          </div>
        `).join('');

        profilePinnedList.querySelectorAll('.pinned-card-unpin-btn').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const animeId = parseInt(btn.dataset.id, 10);
            await handleTogglePinFavorite(animeId);
            await openProfileModal();
          });
        });
      }
    }

    // Seletor rápido de favoritos para fixar no perfil
    const unpinnedFavorites = (profile.favoritos || []).filter((f) => !f.fixado);
    const selectPinFav = document.getElementById('select-favorite-to-pin');
    const pinSelectorRow = document.getElementById('profile-pin-selector-row');
    if (selectPinFav && pinSelectorRow) {
      if (unpinnedFavorites.length > 0 && pinnedCount < maxPinned) {
        pinSelectorRow.classList.remove('hidden');
        selectPinFav.innerHTML = `
          <option value="">Selecione um anime favorito para fixar (${pinnedCount}/${maxPinned})...</option>
          ${unpinnedFavorites.map((f) => `<option value="${f.anime_id}">${f.titulo}</option>`).join('')}
        `;
      } else {
        pinSelectorRow.classList.add('hidden');
      }
    }

    // Promo box do Otaku Pro (esconde se já for Pro) e Active Box (mostra se já for Pro)
    document.getElementById('profile-pro-promo')?.classList.toggle('hidden', isPro);
    document.getElementById('profile-pro-active-box')?.classList.toggle('hidden', !isPro);

  } catch (err) {
    showToast(`Erro ao carregar perfil: ${err.message}`, 'error');
  }
}

function closeProfileModal() {
  profileModal?.classList.add('hidden');
}

// Alternar fixação de anime favorito (📌)
async function handleTogglePinFavorite(animeId, animeData = null) {
  try {
    const payload = {};
    if (animeData) {
      payload.titulo = animeData.titulo || animeData.title || animeData.titulo_romaji;
      payload.poster_url = animeData.poster_url || animeData.poster_path;
    }
    const res = await api.togglePinFavorite(animeId, payload);
    showToast(res.message || 'Destaque de anime atualizado no perfil!', 'success');
    await refreshUserData();
    reRenderCurrentView();
    if (activeAnimeForModal && (activeAnimeForModal.id === animeId || activeAnimeForModal.anime_id === animeId)) {
      updateModalActionButtons(activeAnimeForModal);
    }
    if (profileModal && !profileModal.classList.contains('hidden')) {
      await openProfileModal();
    }
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
      showToast(err.message || 'Usuários do Plano Gratuito podem fixar até 2 animes. Assine o Otaku Pro para fixar até 6!', 'info');
    } else {
      showToast(err.message, 'error');
    }
  }
}

// Upload de Foto de Perfil (Suporta GIF apenas para Otaku Pro)
inputProfilePhoto?.addEventListener('change', async () => {
  const file = inputProfilePhoto.files[0];
  if (!file) return;

  const isPro = Boolean(currentUser?.is_premium || currentUser?.role === 'admin');

  // Verificação no Frontend: GIFs animados requerem Otaku Pro
  if (file.type === 'image/gif' && !isPro) {
    inputProfilePhoto.value = '';
    showToast('O uso de GIFs animados como foto de perfil é exclusivo do Plano Otaku Pro!', 'info');
    openPremiumModal();
    return;
  }

  const formData = new FormData();
  formData.append('foto', file);

  uploadPhotoSpinner.classList.remove('hidden');

  try {
    const res = await api.uploadProfilePhoto(formData, 'me');
    showToast('Foto de perfil atualizada com sucesso!', 'success');

    // Atualiza avatar imediatamente na interface
    if (res.foto_url) {
      updateNavUserAvatar(res.foto_url);
      profileAvatarImg.src = `${res.foto_url}?t=${Date.now()}`;
      profileAvatarImg.classList.remove('hidden');
      profileAvatarFallback.classList.add('hidden');
    }
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
    } else {
      showToast(`Erro no upload: ${err.message}`, 'error');
    }
  } finally {
    uploadPhotoSpinner.classList.add('hidden');
    inputProfilePhoto.value = '';
  }
});

// Abertura e Upload do Banner de Perfil (Exclusivo Otaku Pro)
btnUploadBanner?.addEventListener('click', (e) => {
  const isPro = Boolean(currentUser?.is_premium || currentUser?.role === 'admin');
  if (!isPro) {
    e.preventDefault();
    showToast('A customização do banner com imagens e GIFs é exclusiva do Plano Otaku Pro!', 'info');
    openPremiumModal();
    return;
  }
  if (btnUploadBanner.tagName !== 'LABEL') {
    inputProfileBanner?.click();
  }
});

inputProfileBanner?.addEventListener('change', async () => {
  const file = inputProfileBanner.files[0];
  if (!file) return;

  const isPro = Boolean(currentUser?.is_premium || currentUser?.role === 'admin');
  if (!isPro) {
    inputProfileBanner.value = '';
    showToast('A customização do banner com imagens e GIFs é exclusiva do Plano Otaku Pro!', 'info');
    openPremiumModal();
    return;
  }

  const formData = new FormData();
  formData.append('banner', file);

  uploadBannerSpinner?.classList.remove('hidden');

  try {
    const res = await api.uploadProfileBanner(formData, 'me');
    showToast('Banner do perfil atualizado com sucesso!', 'success');

    if (res.banner_url) {
      const clean = res.banner_url.split('?')[0];
      profileBannerImg.src = `${clean}?t=${Date.now()}`;
      profileBannerImg.classList.remove('hidden');
      profileBannerFallback.classList.add('hidden');
      btnRemoveBanner?.classList.remove('hidden');
      if (lblBannerBtnText) lblBannerBtnText.textContent = 'Trocar Banner';
    }
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
      showToast(err.message, 'info');
    } else {
      showToast(`Erro no upload do banner: ${err.message}`, 'error');
    }
  } finally {
    uploadBannerSpinner?.classList.add('hidden');
    inputProfileBanner.value = '';
  }
});

// Remoção do Banner de Perfil
btnRemoveBanner?.addEventListener('click', async () => {
  try {
    await api.deleteProfileBanner();
    showToast('Banner personalizado removido.', 'info');
    profileBannerImg.classList.add('hidden');
    profileBannerFallback.classList.remove('hidden');
    btnRemoveBanner.classList.add('hidden');
    if (lblBannerBtnText) lblBannerBtnText.textContent = 'Personalizar Banner ⭐';
  } catch (err) {
    showToast(`Erro ao remover banner: ${err.message}`, 'error');
  }
});

// Exportação da Biblioteca em JSON (Diferencial Otaku Pro)
btnExportLibrary?.addEventListener('click', async () => {
  const isPro = Boolean(currentUser?.is_premium || currentUser?.role === 'admin');
  if (!isPro) {
    showToast('A exportação completa da biblioteca em JSON é exclusiva para assinantes Otaku Pro!', 'info');
    openPremiumModal();
    return;
  }

  try {
    showToast('Gerando backup da biblioteca...', 'info');
    const data = await api.exportUserData();
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anitrack-backup-${(currentUser.nome || 'otaku').replace(/\s+/g, '_')}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Backup da biblioteca baixado com sucesso!', 'success');
  } catch (err) {
    if (err.code === 'PREMIUM_REQUIRED') {
      openPremiumModal();
    } else {
      showToast(`Erro ao exportar: ${err.message}`, 'error');
    }
  }
});

// Fixar anime a partir do seletor rápido no perfil
document.getElementById('btn-pin-from-select')?.addEventListener('click', async () => {
  const selectPinFav = document.getElementById('select-favorite-to-pin');
  const animeId = parseInt(selectPinFav?.value, 10);
  if (!animeId) {
    showToast('Selecione um anime para fixar no perfil.', 'info');
    return;
  }
  const favObj = favoritesState.find((f) => f.anime_id === animeId);
  await handleTogglePinFavorite(animeId, favObj);
});

// Alternar status Otaku Pro para testes e demonstração
async function handleToggleProPlan() {
  try {
    const res = await api.toggleProStatus();
    showToast(res.message, 'success');
    if (currentUser) {
      currentUser.is_premium = res.is_premium;
      api.setUser(currentUser);
      updateNavPremiumUI(currentUser);
    }
    await refreshUserData();
    reRenderCurrentView();
    if (profileModal && !profileModal.classList.contains('hidden')) {
      await openProfileModal();
    }
    closePremiumModal();
  } catch (err) {
    showToast(`Erro ao alternar plano: ${err.message}`, 'error');
  }
}

document.getElementById('btn-toggle-pro-mode')?.addEventListener('click', handleToggleProPlan);
document.getElementById('btn-instant-pro-activate')?.addEventListener('click', handleToggleProPlan);

btnToggleEditProfile?.addEventListener('click', () => {
  formEditProfile.classList.toggle('hidden');
  profileBioContainer.classList.toggle('hidden');
});

formEditProfile?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = editProfileName.value.trim();
  const bio = editProfileBio.value.trim();

  try {
    const res = await api.updateProfile({ nome, bio }, 'me');
    showToast('Perfil atualizado!', 'success');
    profileDisplayName.textContent = res.user.nome;
    profileBioText.textContent = res.user.bio || 'Sem biografia cadastrada.';
    formEditProfile.classList.add('hidden');
    profileBioContainer.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

editProfileBio?.addEventListener('input', () => {
  editBioCounter.textContent = `${editProfileBio.value.length}/500`;
});

document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', () => {
  formEditProfile.classList.add('hidden');
  profileBioContainer.classList.remove('hidden');
});

// ============================================================================
// 8. EVENTOS GLOBAIS & INICIALIZAÇÃO
// ============================================================================

// Navegação de Views
navBtnExplore?.addEventListener('click', () => switchView('explore'));
navBtnSimulcast?.addEventListener('click', () => switchView('simulcast'));
navBtnWatched?.addEventListener('click', () => switchView('watched'));
navBtnPlantowatch?.addEventListener('click', () => switchView('plantowatch'));
navBtnFavorites?.addEventListener('click', () => switchView('favorites'));
brandLogo?.addEventListener('click', () => {
  if (authView && !authView.classList.contains('hidden')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    switchView('explore');
  }
});

// Busca e Filtros
inputSearch?.addEventListener('input', (e) => {
  currentSearch = e.target.value.trim();
  btnClearSearch.classList.toggle('hidden', !currentSearch);

  if (currentView === 'explore') {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadExploreCatalog(1);
    }, 400);
  } else {
    reRenderCurrentView();
  }
});

btnClearSearch?.addEventListener('click', () => {
  inputSearch.value = '';
  currentSearch = '';
  btnClearSearch.classList.add('hidden');
  if (currentView === 'explore') {
    loadExploreCatalog(1);
  } else {
    reRenderCurrentView();
  }
});

selectSort?.addEventListener('change', (e) => {
  currentSort = e.target.value;
  if (currentView === 'explore') loadExploreCatalog(1);
});

// Controles de Navegação da Paginação (Inferior e Superior)
btnFirstPage?.addEventListener('click', () => goToCatalogPage(1));
btnPrevPage?.addEventListener('click', () => goToCatalogPage(catalogCurrentPage - 1));
btnNextPage?.addEventListener('click', () => goToCatalogPage(catalogCurrentPage + 1));
btnLastPage?.addEventListener('click', () => goToCatalogPage(catalogTotalPages));

btnTopPrevPage?.addEventListener('click', () => goToCatalogPage(catalogCurrentPage - 1));
btnTopNextPage?.addEventListener('click', () => goToCatalogPage(catalogCurrentPage + 1));

// Seleção de dia no Simulcast
simulcastDaysBar?.querySelectorAll('.day-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    simulcastDaysBar.querySelectorAll('.day-tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeSimulcastDay = btn.dataset.day;
    renderActiveSimulcastDay();
  });
});

// Botões de Fechar Modais
btnCloseAnimeModal?.addEventListener('click', closeAnimeDetailModal);
btnCloseWatchedModal?.addEventListener('click', closeWatchedModal);
btnCloseProfileModal?.addEventListener('click', closeProfileModal);
btnOpenMyProfile?.addEventListener('click', openProfileModal);
btnProfileSubscribe?.addEventListener('click', () => {
  closeProfileModal();
  openPremiumModal();
});

// Fechamento no backdrop
[animeModal, watchedModal, profileModal].forEach((modal) => {
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAnimeDetailModal();
    closeWatchedModal();
    closeProfileModal();
  }
});

// Sincronização após login/logout
window.addEventListener('auth:login', async (e) => {
  currentUser = e.detail;
  await refreshUserData();
  switchView('explore');
});

window.addEventListener('auth:logout', () => {
  currentUser = null;
  watchedState = [];
  planToWatchState = [];
  favoritesState = [];
});

// Boot da Aplicação
async function initApp() {
  await initAuth();
  if (api.getToken()) {
    await refreshUserData();
    switchView('explore');
  }
}

initApp();
