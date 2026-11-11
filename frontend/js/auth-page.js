/**
 * Módulo de Controle da Página Autônoma de Autenticação — AniTrack
 * Gerencia login, cadastro, temas (claro/noturno), recuperação de senha e redirecionamentos.
 */

import { api } from './api.js';

// ============================================================================
// 1. VERIFICAÇÃO DE SESSÃO ATIVA
// ============================================================================
// Se o usuário já estiver logado, não precisa acessar a tela de login.
if (api.getToken() && api.getUser()) {
  window.location.replace('index.html');
}

// ============================================================================
// 2. ELEMENTOS DO DOM
// ============================================================================
const authMainTitle = document.getElementById('auth-main-title');
const authMainDesc = document.getElementById('auth-main-desc');
const authNavTabs = document.getElementById('auth-nav-tabs');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authAlert = document.getElementById('auth-alert');

// Formulários
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formForgot = document.getElementById('form-forgot');
const formReset = document.getElementById('form-reset');

// Inputs de Login
const loginEmail = document.getElementById('login-email');
const loginSenha = document.getElementById('login-senha');
const btnSubmitLogin = document.getElementById('btn-submit-login');
const btnForgotPassword = document.getElementById('btn-forgot-password');

// Inputs de Registro
const registerNome = document.getElementById('register-nome');
const registerEmail = document.getElementById('register-email');
const registerSenha = document.getElementById('register-senha');
const btnSubmitRegister = document.getElementById('btn-submit-register');

// Inputs de Esqueci Senha
const forgotEmail = document.getElementById('forgot-email');
const btnSubmitForgot = document.getElementById('btn-submit-forgot');
const btnForgotBack = document.getElementById('btn-forgot-back');

// Inputs de Redefinir Senha
const resetNovaSenha = document.getElementById('reset-nova-senha');
const resetConfirmaSenha = document.getElementById('reset-confirma-senha');
const resetTokenInfo = document.getElementById('reset-token-info');
const btnSubmitReset = document.getElementById('btn-submit-reset');
const btnResetBack = document.getElementById('btn-reset-back');

// Tema
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');

let activeResetToken = null;

// ============================================================================
// 3. GERENCIAMENTO DE TEMA (CLARO / NOTURNO)
// ============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('anitrack_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('anitrack_theme', theme);

  if (themeToggleLabel) {
    themeToggleLabel.textContent = theme === 'dark' ? 'Claro' : 'Noturno';
  }
}

// ============================================================================
// 4. MENSAGENS DE ALERTA & FEEDBACK
// ============================================================================
function showAlert(message, type = 'danger') {
  if (!authAlert) return;
  authAlert.textContent = message;
  authAlert.className = `alert alert-${type}`;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  if (!authAlert) return;
  authAlert.classList.add('hidden');
  authAlert.textContent = '';
}

// ============================================================================
// 5. TROCA DE ABAS E TELAS
// ============================================================================
export function switchTab(tab) {
  hideAlert();

  formLogin?.classList.add('hidden');
  formRegister?.classList.add('hidden');
  formForgot?.classList.add('hidden');
  formReset?.classList.add('hidden');

  if (tab === 'login') {
    authNavTabs?.classList.remove('hidden');
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');

    if (authMainTitle) authMainTitle.textContent = 'Acesse sua Conta';
    if (authMainDesc) authMainDesc.textContent = 'Entre para gerenciar seus animes e acompanhar as transmissões da temporada.';
    setTimeout(() => loginEmail?.focus(), 50);

  } else if (tab === 'register') {
    authNavTabs?.classList.remove('hidden');
    tabRegister?.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.remove('hidden');

    if (authMainTitle) authMainTitle.textContent = 'Crie sua Conta';
    if (authMainDesc) authMainDesc.textContent = 'Comece gratuitamente a organizar sua rotina de animes e simulcast.';
    setTimeout(() => registerNome?.focus(), 50);

  } else if (tab === 'forgot') {
    authNavTabs?.classList.add('hidden');
    formForgot?.classList.remove('hidden');

    if (authMainTitle) authMainTitle.textContent = 'Recuperar Acesso';
    if (authMainDesc) authMainDesc.textContent = 'Informe seu e-mail para receber as instruções de recuperação.';
    setTimeout(() => forgotEmail?.focus(), 50);

  } else if (tab === 'reset') {
    authNavTabs?.classList.add('hidden');
    formReset?.classList.remove('hidden');

    if (authMainTitle) authMainTitle.textContent = 'Nova Senha';
    if (authMainDesc) authMainDesc.textContent = 'Defina sua nova senha de acesso ao AniTrack.';
    setTimeout(() => resetNovaSenha?.focus(), 50);
  }
}

// ============================================================================
// 6. PROCESSAMENTO DE FORMULÁRIOS
// ============================================================================
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();

  const email = loginEmail.value.trim();
  const senha = loginSenha.value;

  btnSubmitLogin.disabled = true;
  btnSubmitLogin.innerHTML = '<span class="spinner-sm"></span> Acessando...';

  try {
    await api.login(email, senha);
    showAlert('Acesso autorizado! Redirecionando...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 350);
  } catch (err) {
    showAlert(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.', 'danger');
    btnSubmitLogin.disabled = false;
    btnSubmitLogin.innerHTML = '<span>Entrar na Plataforma</span>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const nome = registerNome.value.trim();
  const email = registerEmail.value.trim();
  const senha = registerSenha.value;

  if (senha.length < 4) {
    showAlert('A senha deve ter no mínimo 4 caracteres.', 'danger');
    return;
  }

  btnSubmitRegister.disabled = true;
  btnSubmitRegister.innerHTML = '<span class="spinner-sm"></span> Criando conta...';

  try {
    await api.register(nome, email, senha);
    showAlert('Conta criada com sucesso! Redirecionando...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 350);
  } catch (err) {
    showAlert(err.message || 'Erro ao realizar cadastro.', 'danger');
    btnSubmitRegister.disabled = false;
    btnSubmitRegister.innerHTML = '<span>Criar Minha Conta</span>';
  }
}

async function handleForgot(e) {
  e.preventDefault();
  hideAlert();

  const email = forgotEmail.value.trim();
  btnSubmitForgot.disabled = true;
  btnSubmitForgot.innerHTML = '<span class="spinner-sm"></span> Enviando...';

  try {
    await api.forgotPassword(email);
    showAlert('Link enviado! Se o e-mail estiver cadastrado, você receberá as instruções em instantes.', 'info');
    formForgot.reset();
  } catch (err) {
    showAlert(err.message || 'Erro ao solicitar recuperação de senha.', 'danger');
  } finally {
    btnSubmitForgot.disabled = false;
    btnSubmitForgot.innerHTML = '<span>Enviar Link de Recuperação</span>';
  }
}

async function handleReset(e) {
  e.preventDefault();
  hideAlert();

  const novaSenha = resetNovaSenha.value;
  const confirmaSenha = resetConfirmaSenha.value;

  if (novaSenha.length < 4) {
    showAlert('A nova senha deve ter no mínimo 4 caracteres.', 'danger');
    return;
  }

  if (novaSenha !== confirmaSenha) {
    showAlert('As senhas não coincidem. Digite-as novamente.', 'danger');
    return;
  }

  if (!activeResetToken) {
    showAlert('Token de recuperação ausente ou inválido.', 'danger');
    return;
  }

  btnSubmitReset.disabled = true;
  btnSubmitReset.innerHTML = '<span class="spinner-sm"></span> Salvando...';

  try {
    await api.resetPassword(activeResetToken, novaSenha);
    formReset.reset();
    activeResetToken = null;
    switchTab('login');
    showAlert('Senha redefinida com sucesso! Você já pode entrar com sua nova senha.', 'success');
  } catch (err) {
    showAlert(err.message || 'Erro ao redefinir senha.', 'danger');
  } finally {
    btnSubmitReset.disabled = false;
    btnSubmitReset.innerHTML = '<span>Salvar Nova Senha</span>';
  }
}

// ============================================================================
// 7. EVENT LISTENERS
// ============================================================================
tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));
btnForgotPassword?.addEventListener('click', () => switchTab('forgot'));
btnForgotBack?.addEventListener('click', () => switchTab('login'));
btnResetBack?.addEventListener('click', () => switchTab('login'));

// Botão de preenchimento rápido das chaves de administrador
const btnFillAdmin = document.getElementById('btn-fill-admin');
btnFillAdmin?.addEventListener('click', () => {
  if (loginEmail) loginEmail.value = 'admin@anitrack.com';
  if (loginSenha) loginSenha.value = 'Senha123!';
  showAlert('Credenciais de Administrador preenchidas. Clique em "Entrar na Plataforma" para autenticar.', 'info');
  loginSenha?.focus();
});

formLogin?.addEventListener('submit', handleLogin);
formRegister?.addEventListener('submit', handleRegister);
formForgot?.addEventListener('submit', handleForgot);
formReset?.addEventListener('submit', handleReset);

// ============================================================================
// 8. INICIALIZAÇÃO
// ============================================================================
async function initAuthPage() {
  initTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab') || urlParams.get('mode');
  const resetToken = urlParams.get('reset_token');

  // Redefinição de senha
  if (resetToken) {
    switchTab('reset');
    showAlert('Verificando link de recuperação...', 'info');

    try {
      const check = await api.verifyResetToken(resetToken);
      activeResetToken = resetToken;
      if (resetTokenInfo) {
        resetTokenInfo.textContent = `Redefinindo senha da conta: ${check.email || ''}`;
      }
      hideAlert();
    } catch (err) {
      switchTab('login');
      showAlert(err.message || 'Link de recuperação inválido ou expirado (limite de 30 minutos).', 'danger');
    }
    return;
  }

  // Seleção de aba inicial
  if (tabParam === 'register' || window.location.hash === '#register') {
    switchTab('register');
  } else {
    switchTab('login');
  }
}

initAuthPage();
