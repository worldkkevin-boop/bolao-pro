// ============================================================
// NAV V2 + MENU (SUPER UPDATE)
// - 5 abas: Ranking · Mata-mata · Palpites · Grupos · Menu
// - Barra de troca de grupo (dropdown pra cima) acima das abas
// - view-menu: perfil + atalhos pra tudo que saiu do nav antigo
// ============================================================

const NAV_EMOJI_ICONE = { trofeu: '🏆', bola: '⚽', estrela: '⭐', coroa: '👑', medalha: '🥇', bandeira: '🚩' };

// Abas que precisam de grupo ativo pra fazer sentido
const NAV_PRECISA_GRUPO = ['view-jogos', 'view-ranking', 'view-matamata'];

function navIrPara(viewId) {
  navFecharGrupoBar();
  if (NAV_PRECISA_GRUPO.includes(viewId) && !grupoAtual) {
    showToast('Escolha um grupo primeiro 👇', 'info');
    switchView('view-inicio');
    return;
  }
  switchView(viewId);
}

// ---------- barra de grupo ----------
let _navGruposCache = null;

function navAtualizarGrupoBar() {
  const nome = document.getElementById('nav-grupo-nome');
  const cod = document.getElementById('nav-grupo-cod');
  const icone = document.getElementById('nav-grupo-icone');
  if (!nome) return;
  if (grupoAtual) {
    nome.textContent = grupoAtual.name || grupoAtual.nome || 'Grupo';
    cod.textContent = '#' + (grupoAtual.invite_code || '—');
    icone.textContent = NAV_EMOJI_ICONE[grupoAtual.icone] || '⚽';
  } else {
    nome.textContent = 'Escolher grupo';
    cod.textContent = 'toque para ver seus bolões';
    icone.textContent = '⚽';
  }
}

function navFecharGrupoBar() {
  const lista = document.getElementById('nav-grupo-lista');
  const seta = document.getElementById('nav-grupo-seta');
  if (lista) lista.classList.add('hidden');
  if (seta) seta.style.transform = '';
}

async function navToggleGrupoBar() {
  const lista = document.getElementById('nav-grupo-lista');
  const seta = document.getElementById('nav-grupo-seta');
  if (!lista) return;
  if (!lista.classList.contains('hidden')) { navFecharGrupoBar(); return; }

  lista.classList.remove('hidden');
  if (seta) seta.style.transform = 'rotate(180deg)';
  lista.innerHTML = '<p class="text-text-muted text-[12px] text-center py-4 animate-pulse">Carregando seus bolões...</p>';

  try {
    if (!_navGruposCache) {
      const { data: { user } } = await sbClient.auth.getUser();
      const { data: memberships } = await sbClient.from('group_members').select('group_id').eq('user_id', user.id).neq('role', 'pending');
      const ids = (memberships || []).map(m => m.group_id);
      if (!ids.length) { lista.innerHTML = '<p class="text-text-muted text-[12px] text-center py-4">Você ainda não tem bolões.</p>'; return; }
      const { data: grupos } = await sbClient.from('groups').select('*').in('id', ids).order('created_at', { ascending: false });
      _navGruposCache = grupos || [];
    }
    navRenderListaGrupos();
  } catch (e) {
    console.error('navToggleGrupoBar:', e);
    lista.innerHTML = '<p class="text-red-400 text-[12px] text-center py-4">Erro ao carregar os grupos.</p>';
  }
}

function navRenderListaGrupos() {
  const lista = document.getElementById('nav-grupo-lista');
  if (!lista || !_navGruposCache) return;
  lista.innerHTML = _navGruposCache.map(g => {
    const ativo = grupoAtual && grupoAtual.id === g.id;
    return `
    <button onclick="navTrocarGrupo('${g.id}')"
      class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 last:mb-0 text-left transition-colors
      ${ativo ? 'bg-brand-green/10 border border-brand-green/30' : 'hover:bg-white/5 border border-transparent'}">
      <div class="w-8 h-8 rounded-lg bg-app-bg border border-white/10 flex items-center justify-center text-base shrink-0">${NAV_EMOJI_ICONE[g.icone] || '⚽'}</div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-[13px] truncate ${ativo ? 'text-brand-green' : ''}">${g.name}</p>
        <p class="text-[10px] text-text-muted">#${g.invite_code}</p>
      </div>
      ${ativo ? '<span class="text-brand-green text-sm font-black">✓</span>' : ''}
    </button>`;
  }).join('') + `
    <button onclick="navFecharGrupoBar();abrirCriarBolao()" class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1 border border-dashed border-brand-green/40 text-brand-green font-bold text-[13px]">
      <span class="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center">+</span> Criar novo bolão
    </button>`;
}

function navTrocarGrupo(id) {
  const g = (_navGruposCache || []).find(x => x.id === id);
  navFecharGrupoBar();
  if (!g) return;
  if (grupoAtual && grupoAtual.id === id) return; // já é o ativo
  // mantém o usuário na MESMA aba (se fizer sentido), senão vai pra home do grupo
  const abas = ['view-jogos', 'view-ranking', 'view-copa', 'view-menu'];
  const atual = document.querySelector('#view-jogos:not(.hidden), #view-ranking:not(.hidden), #view-copa:not(.hidden), #view-menu:not(.hidden)');
  const alvo = atual && abas.includes(atual.id) ? atual.id : 'view-grupo-home';
  entrarNoGrupo(g.id, g.name, g.invite_code, g.owner_id, g.league_id || 1, alvo);
}

// invalida o cache quando a lista muda (criar/entrar em grupo)
function navInvalidarGrupos() { _navGruposCache = null; }

// ---------- view MENU ----------
function carregarViewMenu() {
  // perfil
  const av = document.getElementById('menu-avatar');
  if (usuarioAtual) {
    document.getElementById('menu-nome').textContent = usuarioAtual.nome || '—';
    document.getElementById('menu-email').textContent = usuarioAtual.email || '';
    if (av) av.src = usuarioAtual.foto || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(usuarioAtual.nome || 'M') + '&background=10b981&color=fff');
  }

  const item = (emoji, titulo, sub, onclick, precisaGrupo) => {
    const off = precisaGrupo && !grupoAtual;
    return `
    <button onclick="${off ? `showToast('Escolha um grupo primeiro 👇','info')` : onclick}"
      class="w-full bg-card-bg border border-white/5 rounded-2xl p-4 mb-2 flex items-center gap-3.5 active:scale-[0.98] transition-transform ${off ? 'opacity-45' : ''}">
      <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg shrink-0">${emoji}</div>
      <div class="flex-1 text-left min-w-0">
        <p class="font-black text-[14px]">${titulo}</p>
        <p class="text-[11px] text-text-muted truncate">${sub}</p>
      </div>
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-text-muted shrink-0"><path d="M9 5l7 7-7 7"/></svg>
    </button>`;
  };

  document.getElementById('menu-lista-principal').innerHTML =
    item('🏠', 'Home do grupo', 'Destaques, banners e pote do bolão', "navIrPara('view-grupo-home')", true) +
    item('🏆', 'Copa 2026', 'Classificação dos grupos + chaveamento real', "navIrPara('view-copa')", false) +
    item('⚙️', 'Painel do Bolão', 'Regras, participantes e configurações', "navIrPara('view-painel')", true) +
    item('📖', 'Regras e dúvidas', 'Tudo sobre a pontuação do grupo', "navIrPara('view-regras')", true) +
    item('🔴', 'Ao Vivo (Modo TV)', 'Placar, zebras e ranking em tempo real', "navIrPara('view-ao-vivo')", true);

  document.getElementById('menu-lista-extras').innerHTML =
    item('📺', 'Assistir o jogo', 'CazéTV — assista e palpite junto', "navIrPara('view-assistir')", true) +
    item('🎯', 'Desafios', 'Fichas e desafios do GM', "navIrPara('view-desafios')", true) +
    item('🛍️', 'Loja', 'Fichas, pacotes e vantagens', "navIrPara('view-loja')", false) +
    item('🏅', 'Mural de Apoiadores', 'Quem ajuda a manter o app no ar', 'abrirMural()', false) +
    item('💬', 'Contato e Suporte', 'Fale com a gente no WhatsApp', `window.open('https://wa.me/${typeof SUPORTE_WHATSAPP !== 'undefined' ? SUPORTE_WHATSAPP : ''}','_blank')`, false);

  const ver = document.getElementById('menu-versao');
  if (ver) ver.textContent = (typeof _BOLAO_DEV !== 'undefined' && _BOLAO_DEV) ? 'build super-update · ambiente DEV 🛠️' : '';
}
