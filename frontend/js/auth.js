/**
 * Módulo de Autenticação & Sessão do Usuário — AniTrack
 * Gerencia temas Claro/Noturno, sessão ativa, logout e modal de upgrade Otaku Pro.
 * O login e o cadastro completos ocorrem na página dedicada auth.html.
 */

import { api } from './api.js';

// ============================================================================
// 1. ELEMENTOS DA INTERFACE (INDEX.HTML)
// ============================================================================
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const navViews = document.getElementById('nav-views');
const userNav = document.getElementById('user-nav');
const guestNav = document.getElementById('guest-nav');
const navUserName = document.getElementById('nav-user-name');
const navUserRole = document.getElementById('nav-user-role');
const navUserPremium = document.getElementById('nav-user-premium');
const btnNavPremium = document.getElementById('btn-nav-premium');
const navUserAvatar = document.getElementById('nav-user-avatar');
const navAvatarIcon = document.getElementById('nav-avatar-icon');
const btnLogout = document.getElementById('btn-logout');

// Botões de Acesso para Redirecionamento
const btnHeaderLogin = document.getElementById('btn-header-login');
const btnHeaderRegister = document.getElementById('btn-header-register');
const btnHeroCta = document.getElementById('btn-hero-cta');
const btnHeroLogin = document.getElementById('btn-hero-login');

// Tema
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Modal Otaku Pro (Upgrade para usuários logados)
const premiumModal = document.getElementById('premium-modal');
const btnClosePremiumModal = document.getElementById('btn-close-premium-modal');
const btnCancelPremiumModal = document.getElementById('btn-cancel-premium-modal');
const btnConfirmCheckout = document.getElementById('btn-confirm-checkout');

// ============================================================================
// 2. GERENCIAMENTO DE TEMA (CLARO / NOTURNO)
// ============================================================================
export function initTheme() {
  const savedTheme = localStorage.getItem('anitrack_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('anitrack_theme', theme);

  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.textContent = theme === 'dark' ? 'Claro' : 'Noturno';
  }
}

// ============================================================================
// 3. ATUALIZAÇÃO DA INTERFACE & SESSÃO
// ============================================================================
export function redirectToAuth(tab = 'login') {
  window.location.href = `auth.html?tab=${tab}`;
}

export function showAuthView() {
  authView?.classList.remove('hidden');
  appView?.classList.add('hidden');
  navViews?.classList.add('hidden');
  userNav?.classList.add('hidden');
  guestNav?.classList.remove('hidden');
}

export function showAppView(user) {
  authView?.classList.add('hidden');
  guestNav?.classList.add('hidden');
  appView?.classList.remove('hidden');
  navViews?.classList.remove('hidden');
  userNav?.classList.remove('hidden');

  if (navUserName) navUserName.textContent = user.nome || 'Otaku';
  if (navUserRole) {
    navUserRole.textContent = user.role || 'usuario';
    navUserRole.className = `user-role-badge role-${user.role || 'usuario'}`;
  }

  // Badge Otaku Pro
  const isPremium = Boolean(user.is_premium);
  if (navUserPremium) {
    navUserPremium.classList.toggle('hidden', !isPremium);
  }
  if (btnNavPremium) {
    btnNavPremium.classList.toggle('hidden', isPremium);
  }

  updateNavUserAvatar(user.foto_url);
}

export function updateNavUserAvatar(fotoUrl) {
  if (!navUserAvatar || !navAvatarIcon) return;
  if (fotoUrl) {
    const cleanUrl = fotoUrl.split('?')[0];
    navUserAvatar.src = `${cleanUrl}?t=${Date.now()}`;
    navUserAvatar.classList.remove('hidden');
    navAvatarIcon.classList.add('hidden');
  } else {
    navUserAvatar.classList.add('hidden');
    navAvatarIcon.classList.remove('hidden');
  }
}

async function handleLogout() {
  await api.logout();
  showAuthView();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

// ============================================================================
// 4. MODAL OTAKU PRO & CHECKOUT
// ============================================================================
export function openPremiumModal() {
  premiumModal?.classList.remove('hidden');
}

export function closePremiumModal() {
  premiumModal?.classList.add('hidden');
}

async function startStripeCheckout() {
  if (!btnConfirmCheckout) return;
  btnConfirmCheckout.disabled = true;
  btnConfirmCheckout.innerHTML = '<span class="spinner-sm"></span> Conectando ao checkout seguro...';

  try {
    const res = await api.createStripeCheckout();
    if (res.url) {
      window.location.href = res.url;
    } else {
      throw new Error('URL de checkout não retornada pelo servidor.');
    }
  } catch (err) {
    alert(`Erro ao iniciar checkout: ${err.message}`);
    btnConfirmCheckout.disabled = false;
    btnConfirmCheckout.innerHTML = '<span>⭐ Assinar Otaku Pro por R$ 12,90/mês</span>';
  }
}

// ============================================================================
// 5. EVENT LISTENERS
// ============================================================================
// Redirecionamento para a página dedicada auth.html
btnHeaderLogin?.addEventListener('click', (e) => {
  e.preventDefault();
  redirectToAuth('login');
});

btnHeaderRegister?.addEventListener('click', (e) => {
  e.preventDefault();
  redirectToAuth('register');
});

btnHeroCta?.addEventListener('click', (e) => {
  e.preventDefault();
  redirectToAuth('register');
});

btnHeroLogin?.addEventListener('click', (e) => {
  e.preventDefault();
  redirectToAuth('login');
});

document.querySelectorAll('.btn-open-login').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToAuth('login');
  });
});

document.querySelectorAll('.btn-open-register').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToAuth('register');
  });
});

// Logout & Modal Otaku Pro
btnLogout?.addEventListener('click', handleLogout);
btnNavPremium?.addEventListener('click', openPremiumModal);
btnConfirmCheckout?.addEventListener('click', startStripeCheckout);
btnClosePremiumModal?.addEventListener('click', closePremiumModal);
btnCancelPremiumModal?.addEventListener('click', closePremiumModal);

premiumModal?.addEventListener('click', (e) => {
  if (e.target === premiumModal) closePremiumModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (premiumModal && !premiumModal.classList.contains('hidden')) closePremiumModal();
  }
});

window.addEventListener('auth:unauthorized', () => {
  showAuthView();
});

// ============================================================================
// 6. INICIALIZAÇÃO
// ============================================================================
export async function initAuth() {
  initTheme();

  const urlParams = new URLSearchParams(window.location.search);

  // 1. Checa retorno de pagamento
  const paymentStatus = urlParams.get('payment');
  if (paymentStatus) {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (paymentStatus === 'success') {
      setTimeout(() => {
        alert('🎉 Bem-vindo ao Otaku Pro! Sua assinatura foi aprovada com sucesso. Você agora pode personalizar seu banner com imagens e GIFs, usar avatar animado com GIF, fixar até 6 animes favoritos no perfil e exportar seu catálogo!');
      }, 500);
    } else if (paymentStatus === 'cancel') {
      setTimeout(() => {
        alert('O processo de pagamento foi cancelado. Você pode assinar o Otaku Pro a qualquer momento.');
      }, 500);
    }
  }

  // 2. Se o usuário acessou a landing page com um link de redefinição de senha,
  // encaminha diretamente para a página de autenticação com o token.
  const resetToken = urlParams.get('reset_token');
  if (resetToken) {
    window.location.href = `auth.html?reset_token=${encodeURIComponent(resetToken)}`;
    return;
  }

  // 3. Checa sessão ativa
  const token = api.getToken();
  const user = api.getUser();

  if (token && user) {
    showAppView(user);

    try {
      const res = await api.me();
      if (res && res.user) {
        showAppView(res.user);
        window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
      }
    } catch {
      api.clearSession();
      showAuthView();
    }
  } else {
    showAuthView();
  }
}
