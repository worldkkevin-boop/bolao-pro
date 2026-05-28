// ============ ELEMENTOS DOM (LOGIN) ============
const elLoginOptions  = document.getElementById('login-options');
const elCodeSection   = document.getElementById('code-input-section');
const elLogo          = document.getElementById('logo-header');
const elTitle         = document.getElementById('title-header');

// ============ AUTENTICAÇÃO E SESSÃO ============

async function entrarComGoogle() {
  if (!sbClient) {
    console.error('Supabase não está disponível');
    return;
  }
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) {
    console.error('Erro no login:', error.message);
  }
}

async function deslogar() {
  if (sbClient) await sbClient.auth.signOut();
  usuarioAtual = null;
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('lista-jogos').innerHTML = '';
  document.getElementById('lista-grupos').innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Carregando...</p>';
  todosOsJogos = [];
  palpitesUsuario = [];
  switchView_login();
}

function switchView_login() {
  elLoginOptions.style.opacity = '1';
  elLoginOptions.classList.remove('hidden');
  elCodeSection.classList.add('hidden');
  elLogo.className = elLogo.className.replace('w-16', 'w-24').replace('h-16', 'h-24').replace('mb-4', 'mb-6');
  elTitle.classList.remove('hidden');
}

function entrarNoApp(usuario) {
  usuarioAtual = usuario;
  const fotoUrl = usuario.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(usuario.nome) + '&background=10b981&color=fff';

  document.getElementById('avatar-google').src              = fotoUrl;
  document.getElementById('nome-usuario').innerText          = usuario.nome;
  document.getElementById('email-usuario').innerText         = usuario.email;
  document.getElementById('painel-nome-usuario').innerText   = usuario.nome;
  document.getElementById('painel-email-usuario').innerText  = usuario.email;
  document.getElementById('painel-foto-usuario').src         = fotoUrl;

  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  processarConvitePendente();
  if (typeof verificarBannerPWA === 'function') verificarBannerPWA();
}

function mostrarInputCodigo() {
  elLoginOptions.style.opacity = '0';
  setTimeout(() => {
    elLoginOptions.classList.add('hidden');
    elLogo.classList.replace('w-24', 'w-16');
    elLogo.classList.replace('h-24', 'h-16');
    elLogo.classList.replace('mb-6', 'mb-4');
    elTitle.classList.add('hidden');
    elCodeSection.classList.remove('hidden');
    setTimeout(() => {
      elCodeSection.style.opacity = '1';
      elCodeSection.style.transform = 'translateY(0)';
      document.getElementById('group-code').focus();
    }, 50);
  }, 300);
}

function voltarParaLogin() {
  elCodeSection.style.opacity = '0';
  elCodeSection.style.transform = 'translateY(1rem)';
  setTimeout(() => {
    elCodeSection.classList.add('hidden');
    elLogo.classList.replace('w-16', 'w-24');
    elLogo.classList.replace('h-16', 'h-24');
    elLogo.classList.replace('mb-4', 'mb-6');
    elTitle.classList.remove('hidden');
    elLoginOptions.classList.remove('hidden');
    setTimeout(() => { elLoginOptions.style.opacity = '1'; }, 50);
  }, 300);

  document.getElementById('validation-success').classList.add('hidden');
  document.getElementById('validation-error').classList.add('hidden');
  document.getElementById('group-code').value = '';
  document.getElementById('group-code').classList.remove('border-red-500', 'border-brand-green');
}

async function simularValidacao() {
  const btn   = document.getElementById('btn-validar');
  const input = document.getElementById('group-code');
  const codeVal = input.value.trim().toUpperCase();

  if (codeVal.length < 3) return;

  document.getElementById('validation-success').classList.add('hidden');
  document.getElementById('validation-error').classList.add('hidden');
  input.classList.remove('border-red-500', 'border-brand-green');

  const textoOriginal = btn.innerHTML;
  btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-black inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Procurando...';
  btn.disabled = true;
  btn.style.opacity = '0.8';

  if (sbClient) {
    try {
      const { data: grupo, error } = await sbClient
        .from('groups')
        .select('*')
        .eq('invite_code', codeVal)
        .single();

      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = textoOriginal;

      if (grupo && !error) {
        input.classList.add('border-brand-green');
        document.getElementById('validation-success-group-name').innerText = grupo.name;
        document.getElementById('validation-success').classList.remove('hidden');
        localStorage.setItem('pending_invite_code', codeVal);
      } else {
        input.classList.add('border-red-500');
        document.getElementById('validation-error').classList.remove('hidden');
      }
    } catch (e) {
      console.error("Erro na validação do código:", e);
      mockValidacao(codeVal, input, btn, textoOriginal);
    }
  } else {
    mockValidacao(codeVal, input, btn, textoOriginal);
  }
}

function mockValidacao(codeVal, input, btn, textoOriginal) {
  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = textoOriginal;

    if (codeVal === '8187964') {
      input.classList.add('border-brand-green');
      document.getElementById('validation-success-group-name').innerText = 'Bolão Ladaya';
      document.getElementById('validation-success').classList.remove('hidden');
      localStorage.setItem('pending_invite_code', codeVal);
    } else {
      input.classList.add('border-red-500');
      document.getElementById('validation-error').classList.remove('hidden');
    }
  }, 1500);
}

async function processarConvitePendente() {
  const pendingCode = localStorage.getItem('pending_invite_code');
  if (!pendingCode) {
    if (typeof carregarGrupos === 'function') carregarGrupos();
    return;
  }

  try {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) {
      if (typeof carregarGrupos === 'function') carregarGrupos();
      return;
    }

    const { data: grupo, error } = await sbClient
      .from('groups')
      .select('*')
      .eq('invite_code', pendingCode)
      .single();

    if (error || !grupo) {
      console.error("Erro ao buscar grupo do convite pendente:", error);
      localStorage.removeItem('pending_invite_code');
      if (typeof carregarGrupos === 'function') carregarGrupos();
      return;
    }

    await sbClient
      .from('group_members')
      .upsert([{ group_id: grupo.id, user_id: user.id }]);

    localStorage.removeItem('pending_invite_code');
    if (typeof entrarNoGrupo === 'function') entrarNoGrupo(grupo.id, grupo.name, grupo.invite_code, grupo.owner_id, grupo.league_id || 1);
    if (typeof carregarGrupos === 'function') carregarGrupos();

  } catch (err) {
    console.error("Erro no processamento de convite pendente:", err);
    localStorage.removeItem('pending_invite_code');
    if (typeof carregarGrupos === 'function') carregarGrupos();
  }
}

// Lê o parâmetro de convite da URL de forma imediata (os scripts estão no rodapé do body)
function inicializarConvitePorUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    localStorage.setItem('pending_invite_code', code.toUpperCase());
    
    const input = document.getElementById('group-code');
    if (input) {
      input.value = code.toUpperCase();
      mostrarInputCodigo();
      setTimeout(() => {
        simularValidacao();
      }, 400);
    } else {
      // Caso ocorra delay na renderização do DOM
      setTimeout(() => {
        mostrarInputCodigo();
        const inputRetry = document.getElementById('group-code');
        if (inputRetry) {
          inputRetry.value = code.toUpperCase();
          setTimeout(() => {
            simularValidacao();
          }, 400);
        }
      }, 100);
    }
  }
}
inicializarConvitePorUrl();
