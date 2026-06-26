// ============ INTERFACE DO USUÁRIO (UI) ============

let intervaloAoVivo = null;

// Função para renderizar Telas Vazias (Empty States) com padrão Premium
function renderEmptyState(icone, titulo, descricao) {
  const isSvg = icone.trim().startsWith('<svg');
  const iconeHtml = isSvg ? icone : `<span class="text-4xl opacity-80 drop-shadow-md">${icone}</span>`;
  return `
    <div class="flex flex-col items-center justify-center py-16 text-center px-4 animate-fade-in">
      <div class="w-20 h-20 bg-card-bg rounded-full flex items-center justify-center mb-5 border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
        ${iconeHtml}
      </div>
      <h3 class="text-white font-black text-[15px] mb-2 tracking-wide uppercase">${titulo}</h3>
      <p class="text-text-muted text-[12px] max-w-[260px] mx-auto leading-relaxed">${descricao}</p>
    </div>
  `;
}

// ============ SISTEMA DE NOTIFICAÇÕES (TOAST) ============
function showToast(mensagem, tipo = 'success') {
  // 1. Verifica se o container já existe. Se não, cria no topo da tela.
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm';
    document.body.appendChild(container);
  }

  // 2. Cria o elemento da notificação
  const toast = document.createElement('div');
  
  // 3. Define as cores e ícones baseados no 'tipo'
  let bgClass, icon;
  if (tipo === 'success') {
    bgClass = 'bg-brand-green/95 border-brand-green/50 text-white';
    icon = '✅';
  } else if (tipo === 'error') {
    bgClass = 'bg-red-500/95 border-red-500/50 text-white';
    icon = '❌';
  } else if (tipo === 'mago') {
    bgClass = 'bg-purple-650/95 border-purple-400/50 text-white'; // O Mago tem uma cor especial!
    icon = '🪄';
  } else {
    bgClass = 'bg-zinc-800/95 border-zinc-700/50 text-white';
    icon = 'ℹ️';
  }

  // 4. Monta a estrutura com Tailwind (Inicia invisível e um pouco mais alto)
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md text-[13px] font-bold transform transition-all duration-300 translate-y-[-20px] opacity-0 ${bgClass}`;
  
  toast.innerHTML = `<span class="text-[16px]">${icon}</span> <span>${mensagem}</span>`;
  
  container.appendChild(toast);

  // 5. Animação de entrada (desliza para baixo)
  setTimeout(() => {
    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  // 6. Remove automaticamente após 3 segundos
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-20px]', 'opacity-0'); // Animação de saída
    setTimeout(() => toast.remove(), 300); // Espera a transição terminar para remover do HTML
  }, 3000);
}



function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function fecharModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ===== Doação / Apoiador (PIX verificado via MercadoPago → selo 💛) =====
function abrirDoacao() {
  abrirModal('modal-doacao');
}

// Inicia o pagamento de apoio (produto apoio_5/10/20) pelo fluxo do MercadoPago.
function iniciarApoio(productId) {
  fecharModal('modal-doacao');
  if (typeof gerarPagamentoPix === 'function') gerarPagamentoPix(productId);
}

// Apoiador ATIVO = tem prazo no futuro (apoiador_ate). Legado (sem prazo) cai no boolean.
function _apoiadorAtivo(p) {
  if (!p) return false;
  if (p.apoiador_ate) return new Date(p.apoiador_ate) > new Date();
  return !!p.apoiador;
}
function _apoiadorDiasRestantes(ate) {
  if (!ate) return null;
  const ms = new Date(ate) - new Date();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// Barra fixa no topo do app com os dias de apoio (só pra apoiador ativo).
function atualizarBarraApoiador() {
  const bar = document.getElementById('apoiador-top-bar');
  if (!bar) return;
  const ativo = _apoiadorAtivo(usuarioAtual);
  bar.classList.toggle('hidden', !ativo);
  const el = document.getElementById('apoiador-bar-dias');
  if (el) {
    const dias = usuarioAtual ? _apoiadorDiasRestantes(usuarioAtual.apoiador_ate) : null;
    el.textContent = (dias === null) ? '' : (dias <= 0 ? '· expira hoje' : `· ${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  }
}

// Atualiza o destaque "Você é apoiador 💛" em Configurações (com dias restantes).
function atualizarSeloApoiadorConfig() {
  atualizarBarraApoiador();
  const el = document.getElementById('config-apoiador-selo');
  if (!el) return;
  const ativo = _apoiadorAtivo(usuarioAtual);
  el.classList.toggle('hidden', !ativo);
  const diasEl = document.getElementById('config-apoiador-dias');
  if (diasEl) {
    const dias = usuarioAtual ? _apoiadorDiasRestantes(usuarioAtual.apoiador_ate) : null;
    diasEl.textContent = (dias === null) ? '' : (dias <= 0 ? 'expira hoje' : `${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`);
  }
}

// Monta o acesso às estatísticas dentro do "Detalhes do Jogo".
function carregarEstatisticasDetalhe(jogo) {
  const el = document.getElementById('detalhe-estatisticas');
  if (!el || !jogo) return;

  if (!(usuarioAtual && usuarioAtual.apoiador)) {
    el.innerHTML = `
      <div onclick="abrirDoacao()" class="bg-gradient-to-r from-amber-400/10 to-transparent border border-amber-400/25 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400/50 transition-all active:scale-[0.98]">
        <div class="flex items-center gap-3">
          <span class="text-2xl">📊</span>
          <div><h4 class="font-black text-[13px] text-white">Estatísticas dos times</h4><p class="text-[11px] text-text-muted">Forma, posição, gols e odds — perk de Apoiador 💛</p></div>
        </div>
        <span class="text-amber-400 font-black text-lg">›</span>
      </div>`;
    return;
  }

  el.innerHTML = `
    <p class="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2 mt-1">📊 Estatísticas dos times</p>
    <div class="grid grid-cols-2 gap-2">
      <button onclick="abrirEstatisticasTime(${jogo.fixture.id}, ${jogo.teams.home.id})" class="bg-card-bg border border-white/5 rounded-xl p-3 flex items-center gap-2 hover:border-brand-green/40 transition-all active:scale-95">
        <img src="${getFlagUrl(jogo.teams.home.id) || jogo.teams.home.logo || ''}" onerror="this.style.display='none'" class="w-6 h-6 rounded object-cover flex-shrink-0">
        <span class="text-[12px] font-bold text-white truncate text-left">${jogo.teams.home.name}</span>
      </button>
      <button onclick="abrirEstatisticasTime(${jogo.fixture.id}, ${jogo.teams.away.id})" class="bg-card-bg border border-white/5 rounded-xl p-3 flex items-center gap-2 hover:border-brand-green/40 transition-all active:scale-95">
        <img src="${getFlagUrl(jogo.teams.away.id) || jogo.teams.away.logo || ''}" onerror="this.style.display='none'" class="w-6 h-6 rounded object-cover flex-shrink-0">
        <span class="text-[12px] font-bold text-white truncate text-left">${jogo.teams.away.name}</span>
      </button>
    </div>`;
}

// ===== Estatísticas do time (perk de Apoiador) — modal detalhado =====
function _estatFetch(path) {
  return fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5' }
  }).then(r => r.json());
}

function _estatForma(formaStr) {
  if (!formaStr) return '<span class="text-text-muted text-[11px]">—</span>';
  const ult = formaStr.slice(-5).split('');
  return ult.map(r => {
    const cor = r === 'W' ? 'bg-brand-green text-black' : (r === 'L' ? 'bg-red-500 text-white' : 'bg-zinc-600 text-white');
    const txt = r === 'W' ? 'V' : (r === 'L' ? 'D' : 'E');
    return `<span class="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${cor}">${txt}</span>`;
  }).join(' ');
}

async function abrirEstatisticasTime(fixtureId, teamId) {
  const jogo = (typeof todosOsJogos !== 'undefined') ? todosOsJogos.find(j => j.fixture.id === fixtureId) : null;
  if (!jogo) { if (typeof showToast === 'function') showToast('Jogo não encontrado.', 'error'); return; }

  abrirModal('modal-estat');
  const body = document.getElementById('estat-body');
  if (!body) return;

  // Gate: exclusivo de apoiador
  if (!(usuarioAtual && usuarioAtual.apoiador)) {
    body.innerHTML = `
      <div class="text-center py-4">
        <div class="text-4xl mb-3">📊💛</div>
        <h4 class="text-white font-black text-base mb-2">Estatísticas é um perk de Apoiador</h4>
        <p class="text-[13px] text-text-muted mb-5 leading-relaxed">Veja forma recente, posição no campeonato, saldo e média de gols e quem é favorito nas odds — direto da API oficial.</p>
        <button onclick="fecharModal('modal-estat'); abrirDoacao();" class="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black py-3 rounded-xl text-sm uppercase tracking-wider active:scale-95">💛 Virar Apoiador</button>
      </div>`;
    return;
  }

  const ehHome = teamId === jogo.teams.home.id;
  const time = ehHome ? jogo.teams.home : jogo.teams.away;
  const leagueId = jogo.league.id;
  const season = jogo.league.season || 2026;
  const logo = (typeof getFlagUrl === 'function' ? getFlagUrl(time.id) : null) || time.logo || '';

  body.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <img src="${logo}" onerror="this.style.display='none'" class="w-10 h-10 rounded-lg object-cover">
      <div><h4 class="text-white font-black text-base">${time.name}</h4><p class="text-[11px] text-text-muted">${jogo.teams.home.name} x ${jogo.teams.away.name}</p></div>
    </div>
    <p class="text-text-muted text-[13px] text-center py-6 animate-pulse">Buscando estatísticas...</p>`;

  try {
    const [fxJson, standJson, oddsJson] = await Promise.all([
      _estatFetch(`fixtures?team=${teamId}&last=10`),
      _estatFetch(`standings?league=${leagueId}&season=${season}`),
      _estatFetch(`odds?fixture=${fixtureId}`)
    ]);

    const FINAL = ['FT', 'AET', 'PEN'];
    const jogos = (fxJson.response || [])
      .filter(f => FINAL.includes(f.fixture.status.short))
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .map(f => {
        const casa = f.teams.home.id === teamId;
        const gf = casa ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
        const ga = casa ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
        const opp = casa ? f.teams.away : f.teams.home;
        return { data: f.fixture.date, casa, gf, ga, opp, res: gf > ga ? 'W' : (gf < ga ? 'L' : 'D') };
      });

    if (jogos.length === 0) {
      body.innerHTML = `
        <div class="flex items-center gap-3 mb-4"><img src="${logo}" onerror="this.style.display='none'" class="w-10 h-10 rounded-lg object-cover"><div><h4 class="text-white font-black text-base">${time.name}</h4></div></div>
        <p class="text-text-muted text-[13px] text-center py-8">Sem jogos recentes pra analisar.</p>`;
      return;
    }

    const n = jogos.length;
    const medGf = jogos.reduce((s, j) => s + j.gf, 0) / n;
    const medGa = jogos.reduce((s, j) => s + j.ga, 0) / n;
    // Projeção: média ponderada (jogos recentes pesam mais)
    let ws = 0, wt = 0; jogos.forEach((j, i) => { ws += j.gf * (i + 1); wt += (i + 1); });
    const projGf = ws / wt;
    // Confiança: aproveitamento (V=1, E=0.5) nos últimos jogos
    const conf = Math.round(jogos.reduce((s, j) => s + (j.res === 'W' ? 1 : (j.res === 'D' ? 0.5 : 0)), 0) / n * 100);
    const grade = conf >= 66 ? 'A' : (conf >= 45 ? 'B' : 'C');
    const confCor = conf >= 66 ? 'text-brand-green border-brand-green' : (conf >= 45 ? 'text-amber-400 border-amber-400' : 'text-red-400 border-red-400');
    const ult5 = jogos.slice(-5);

    // Posição / saldo nos standings
    let posBlock = '';
    const liga = standJson.response && standJson.response[0] && standJson.response[0].league;
    if (liga && Array.isArray(liga.standings)) {
      let reg = null;
      liga.standings.forEach(g => { const f = (g || []).find(r => r.team.id === teamId); if (f) reg = f; });
      if (reg) {
        const grupo = (reg.group || '').replace(/group/i, 'Grupo');
        posBlock = `
          <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-xl font-black text-white">${reg.rank}º</p><p class="text-[9px] text-text-muted uppercase tracking-wider">${grupo || 'Posição'}</p></div>
            <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-xl font-black text-white">${reg.points}</p><p class="text-[9px] text-text-muted uppercase tracking-wider">Pontos</p></div>
            <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-xl font-black ${reg.goalsDiff >= 0 ? 'text-brand-green' : 'text-red-400'}">${reg.goalsDiff > 0 ? '+' : ''}${reg.goalsDiff}</p><p class="text-[9px] text-text-muted uppercase tracking-wider">Saldo</p></div>
          </div>`;
      }
    }

    // Favorito nas odds (Match Winner)
    let oddsBlock = '';
    try {
      const resp = oddsJson.response && oddsJson.response[0];
      const bm = resp && resp.bookmakers && resp.bookmakers[0];
      const bet = bm && bm.bets && bm.bets.find(b => b.name === 'Match Winner');
      if (bet) {
        const get = v => bet.values.find(x => x.value === v);
        const oh = parseFloat(get('Home')?.odd), od = parseFloat(get('Draw')?.odd), oa = parseFloat(get('Away')?.odd);
        const minOdd = Math.min(oh, od, oa);
        const souFav = (ehHome && oh === minOdd) || (!ehHome && oa === minOdd);
        const flagHome = (typeof getFlagUrl === 'function' ? getFlagUrl(jogo.teams.home.id) : null) || jogo.teams.home.logo || '';
        const flagAway = (typeof getFlagUrl === 'function' ? getFlagUrl(jogo.teams.away.id) : null) || jogo.teams.away.logo || '';
        const favFlag = oh === minOdd ? flagHome : (oa === minOdd ? flagAway : '');
        const favLabel = oh === minOdd ? jogo.teams.home.name : (oa === minOdd ? jogo.teams.away.name : 'Empate');
        const flagImg = (src) => src ? `<img src="${src}" onerror="this.style.display='none'" class="w-4 h-4 rounded-sm object-cover">` : '';
        oddsBlock = `
          <p class="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Odds do jogo</p>
          <div class="bg-zinc-900/60 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div class="text-center flex-1"><div class="flex items-center justify-center gap-1 mb-0.5">${flagImg(flagHome)}<span class="text-[9px] text-text-muted uppercase">Casa</span></div><p class="font-black ${oh === minOdd ? 'text-brand-green' : 'text-white'}">${isNaN(oh) ? '—' : oh.toFixed(2)}</p></div>
            <div class="text-center flex-1"><p class="text-[9px] text-text-muted uppercase mb-0.5">Empate</p><p class="font-black ${od === minOdd ? 'text-brand-green' : 'text-white'}">${isNaN(od) ? '—' : od.toFixed(2)}</p></div>
            <div class="text-center flex-1"><div class="flex items-center justify-center gap-1 mb-0.5">${flagImg(flagAway)}<span class="text-[9px] text-text-muted uppercase">Fora</span></div><p class="font-black ${oa === minOdd ? 'text-brand-green' : 'text-white'}">${isNaN(oa) ? '—' : oa.toFixed(2)}</p></div>
            <div class="text-center flex-1 border-l border-white/10 pl-2"><p class="text-[9px] text-text-muted uppercase mb-0.5">Favorito</p><div class="flex items-center justify-center gap-1">${flagImg(favFlag)}<span class="font-black text-[11px] ${souFav ? 'text-brand-green' : 'text-amber-400'}">${favLabel.slice(0, 8)}</span></div></div>
          </div>`;
      }
    } catch (e) { /* odds podem não existir */ }

    // Gráfico de barras: gols marcados (verde) + sofridos (vermelho) por jogo
    const maxV = Math.max(1, ...jogos.map(j => Math.max(j.gf, j.ga)));
    const barras = jogos.map(j => {
      const flag = (typeof getFlagUrl === 'function' ? getFlagUrl(j.opp.id) : null) || j.opp.logo || '';
      const dataFmt = new Date(j.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const hGf = Math.round(j.gf / maxV * 70) + 3;
      const hGa = Math.round(j.ga / maxV * 70) + 3;
      return `
        <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:40px">
          <div class="flex items-end gap-0.5" style="height:80px">
            <div class="flex flex-col items-center justify-end h-full"><span class="text-[9px] font-black text-brand-green leading-none mb-0.5">${j.gf}</span><div class="w-2.5 rounded-t bg-brand-green" style="height:${hGf}px"></div></div>
            <div class="flex flex-col items-center justify-end h-full"><span class="text-[9px] font-black text-red-400 leading-none mb-0.5">${j.ga}</span><div class="w-2.5 rounded-t bg-red-500/80" style="height:${hGa}px"></div></div>
          </div>
          <span class="text-[11px] leading-none">${j.casa ? '🏠' : '✈️'}</span>
          <img src="${flag}" onerror="this.style.display='none'" class="w-4 h-4 rounded-sm object-cover">
          <span class="text-[8px] text-text-muted leading-none">${dataFmt}</span>
        </div>`;
    }).join('');

    body.innerHTML = `
      <!-- Header com confiança/grade -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${logo}" onerror="this.style.display='none'" class="w-11 h-11 rounded-full object-cover border border-white/10">
          <div class="min-w-0"><h4 class="text-white font-black text-base truncate">${time.name}</h4><p class="text-[11px] text-text-muted truncate">${jogo.teams.home.name} vs ${jogo.teams.away.name}</p></div>
        </div>
        <div class="text-center flex-shrink-0">
          <div class="w-12 h-12 rounded-full border-[3px] ${confCor} flex items-center justify-center font-black text-sm">${conf}%</div>
          <p class="text-[8px] text-text-muted uppercase tracking-widest mt-0.5">Grade ${grade}</p>
        </div>
      </div>

      <!-- Projeção / Médias -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-[9px] text-text-muted uppercase tracking-wider">Projeção</p><p class="text-xl font-black text-brand-green">${projGf.toFixed(1)}</p></div>
        <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-[9px] text-text-muted uppercase tracking-wider">Média feitos</p><p class="text-xl font-black text-white">${medGf.toFixed(1)}</p></div>
        <div class="bg-zinc-900/60 rounded-xl p-3 text-center"><p class="text-[9px] text-text-muted uppercase tracking-wider">Média levados</p><p class="text-xl font-black text-white">${medGa.toFixed(1)}</p></div>
      </div>

      <!-- Forma (últimos 5) -->
      <p class="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Forma (L5)</p>
      <div class="flex items-center gap-1.5 mb-4">${ult5.map(j => { const c = j.res === 'W' ? 'bg-brand-green text-black' : (j.res === 'L' ? 'bg-red-500 text-white' : 'bg-zinc-600 text-white'); const t = j.res === 'W' ? 'V' : (j.res === 'L' ? 'D' : 'E'); return `<span class="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black ${c}">${t}</span>`; }).join('')}</div>

      <!-- Gráfico últimos jogos -->
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-black uppercase tracking-widest text-text-muted">Últimos ${n} jogos</p>
        <div class="flex items-center gap-3 text-[9px] font-bold"><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-brand-green"></span>Feitos</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-500/80"></span>Levados</span></div>
      </div>
      <div class="bg-zinc-900/40 rounded-xl p-3 mb-4 overflow-x-auto"><div class="flex gap-1.5 items-end" style="min-width:max-content">${barras}</div></div>

      ${posBlock}
      ${oddsBlock}
      <p class="text-[10px] text-zinc-600 text-center">🏠 casa · ✈️ fora · dados da API-Football</p>`;
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    body.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro ao buscar estatísticas. Tente de novo.</p>';
  }
}

// Mural de Apoiadores (tela inicial) — lista quem tem profiles.apoiador = true.
async function abrirMural() {
  abrirModal('modal-mural');
  const lista = document.getElementById('mural-lista');
  if (!lista) return;
  lista.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6 animate-pulse">Carregando...</p>';
  try {
    const { data: raw, error } = await sbClient
      .from('profiles')
      .select('full_name, avatar_url, apoiador_desde, apoiador, apoiador_ate')
      .eq('apoiador', true)
      .order('apoiador_desde', { ascending: true });
    if (error) throw error;

    // Só apoiadores ativos (prazo no futuro, ou legado sem prazo)
    const data = (raw || []).filter(p => _apoiadorAtivo(p));

    if (!data || data.length === 0) {
      lista.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Seja o primeiro apoiador! 💛</p>';
      return;
    }

    lista.innerHTML = data.map((p, i) => {
      const nome = p.full_name || 'Apoiador';
      const foto = p.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nome) + '&background=f59e0b&color=000';
      const desde = p.apoiador_desde
        ? new Date(p.apoiador_desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        : '';
      return `
        <div class="flex items-center gap-3 bg-gradient-to-r from-amber-400/[0.06] to-transparent border border-amber-400/15 rounded-xl p-2.5">
          <img src="${foto}" class="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/60 flex-shrink-0">
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-bold text-white truncate">${nome} 💛</p>
            ${desde ? `<p class="text-[10px] text-text-muted">apoiador desde ${desde}</p>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar mural:', err);
    lista.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro ao carregar o mural.</p>';
  }
}

function switchView(targetViewId) {
  if (targetViewId === 'view-desafios' && typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.desafios_enabled === false) {
    if (typeof showToast === 'function') showToast("Os desafios estão desativados neste grupo pelo Administrador.", "info");
    targetViewId = 'view-grupo-home';
  }

  if (targetViewId === 'view-inicio') {
    localStorage.removeItem('last_active_group');
    localStorage.removeItem('last_active_view');
  } else {
    localStorage.setItem('last_active_view', targetViewId);
  }

  const views = ['view-inicio', 'view-grupo-home', 'view-jogos', 'view-palpite', 'view-ranking', 'view-painel', 'view-regras', 'view-gm-panel', 'view-ao-vivo', 'view-desafios', 'view-loja', 'view-copa'];
  const navBar = document.getElementById('bottom-nav');
  const gmNavBar = document.getElementById('gm-bottom-nav');

  if (targetViewId !== 'view-grupo-home' && countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (targetViewId !== 'view-palpite') {
    desativarTelaAoVivo();
  }

  if (targetViewId !== 'view-ao-vivo') {
    if (typeof desativarTVAoVivo === 'function') {
      desativarTVAoVivo();
    }
  }

  views.forEach(vId => {
    document.getElementById(vId).classList.add('hidden');
    if (document.getElementById('nav-' + vId)) {
      document.getElementById('nav-' + vId).classList.remove('text-brand-green', 'bg-brand-green/10', 'px-3', 'py-2', 'rounded-xl');
      document.getElementById('nav-' + vId).classList.add('text-text-muted');
    }
  });

  document.getElementById(targetViewId).classList.remove('hidden');

  // Controle de menus inferiores (Navegação)
  if (targetViewId === 'view-gm-panel') {
    if (navBar) navBar.classList.add('hidden');
    if (gmNavBar) gmNavBar.classList.remove('hidden');
  } else {
    if (gmNavBar) gmNavBar.classList.add('hidden');
    
    if (targetViewId === 'view-inicio' || targetViewId === 'view-palpite' || targetViewId === 'view-ao-vivo') {
      if (navBar) navBar.classList.add('hidden');
    } else {
      if (navBar) navBar.classList.remove('hidden');
    }
  }

  if (document.getElementById('nav-' + targetViewId)) {
    document.getElementById('nav-' + targetViewId).classList.add('text-brand-green', 'bg-brand-green/10', 'px-3', 'py-2', 'rounded-xl');
    document.getElementById('nav-' + targetViewId).classList.remove('text-text-muted');
  }

  if (targetViewId === 'view-grupo-home') {
    if (todosOsJogos.length === 0) {
      if (typeof carregarJogos === 'function') carregarJogos();
    } else {
      if (typeof atualizarDestaquesHomeGrupo === 'function') atualizarDestaquesHomeGrupo();
    }
  } else if ((targetViewId === 'view-jogos' || targetViewId === 'view-palpite' || targetViewId === 'view-ranking' || targetViewId === 'view-ao-vivo') && todosOsJogos.length === 0) {
    if (typeof carregarJogos === 'function') carregarJogos();
  } else if (targetViewId === 'view-jogos' && todosOsJogos.length > 0) {
    gerarFiltrosRodadas();
    filtrarPorRodada(rodadaSelecionada);
  } else if (targetViewId === 'view-ranking') {
    if (grupoAtual) {
      document.getElementById('nome-grupo-ranking').innerText = grupoAtual.name || grupoAtual.nome || 'Grupo';
      atualizarSeletorRanking();
      exibirRankingSelecionado();
    } else {
      document.getElementById('nome-grupo-ranking').innerText = '—';
      document.getElementById('lista-ranking').innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Selecione um grupo para ver o ranking...</p>';
    }
  } else if (targetViewId === 'view-copa') {
    if (typeof carregarViewCopa === 'function') carregarViewCopa();
  } else if (targetViewId === 'view-desafios') {
    if (typeof carregarDesafiosUsuarioView === 'function') carregarDesafiosUsuarioView();
  } else if (targetViewId === 'view-loja') {
    if (typeof carregarViewLoja === 'function') carregarViewLoja();
  } else if (targetViewId === 'view-regras') {
    if (typeof renderizarRegrasGrupo === 'function') renderizarRegrasGrupo();
  } else if (targetViewId === 'view-painel') {
    if (typeof atualizarSeloApoiadorConfig === 'function') atualizarSeloApoiadorConfig();
    const adminSettings = document.getElementById('admin-settings-section');
    const isOwner = grupoAtual && usuarioAtual && usuarioAtual.id === grupoAtual.owner_id;
    
    const badgeAdmin = document.getElementById('painel-badge-admin');
    if (badgeAdmin) {
      if (isOwner) {
        badgeAdmin.classList.remove('hidden');
      } else {
        badgeAdmin.classList.add('hidden');
      }
    }

    if (grupoAtual) {
      // Carrega lista de participantes para atualizar contagem e listagem
      if (typeof carregarParticipantesGrupo === 'function') {
        carregarParticipantesGrupo(grupoAtual.id);
      }
      
      // Atualiza limite e badge do plano
      const configLimite = document.getElementById('config-gm-limite');
      const badgeStatus = document.getElementById('badge-status-plano');
      if (configLimite && badgeStatus) {
        const maxP = grupoAtual.max_participants;
        if (maxP === null || maxP === undefined || maxP >= 999) {
          configLimite.innerText = 'Ilimitado';
          badgeStatus.className = 'w-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs font-bold py-2 rounded-lg text-center flex justify-center items-center gap-2 mt-4';
          badgeStatus.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Voucher ativo · limite ampliado`;
        } else if (maxP <= 3) {
          configLimite.innerText = maxP;
          badgeStatus.className = 'w-full bg-zinc-800/60 border border-zinc-700 text-gray-400 text-xs font-bold py-2 rounded-lg text-center flex justify-center items-center gap-2 mt-4';
          badgeStatus.innerHTML = `Plano Gratuito (Limite de ${maxP} pessoas)`;
        } else {
          configLimite.innerText = maxP;
          badgeStatus.className = 'w-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs font-bold py-2 rounded-lg text-center flex justify-center items-center gap-2 mt-4';
          badgeStatus.innerHTML = `Plano Premium (Limite de ${maxP} pessoas)`;
        }
      }
    }

    if (adminSettings) {
      if (isOwner) {
        adminSettings.classList.remove('hidden');
        const nameText = document.getElementById('txt-nome-grupo-atual');
        if (nameText) {
          nameText.innerText = grupoAtual.name || grupoAtual.nome || '';
        }
        const chkPrivado = document.getElementById('chk-grupo-privado');
        if (chkPrivado) {
          chkPrivado.checked = grupoAtual.privado === true;
        }
        
        // Carrega as regras de pontuação nos inputs e checkboxes
        const carregarRegraUI = (inputId, chkId, dbValue, defaultValue) => {
          const input = document.getElementById(inputId);
          const chk = document.getElementById(chkId);
          if (!input) return;
          
          const value = dbValue !== undefined && dbValue !== null ? Number(dbValue) : defaultValue;
          input.value = value > 0 ? value : defaultValue;
          
          if (chk) {
            chk.checked = value > 0;
            input.disabled = !chk.checked;
            if (input.disabled) {
              input.classList.add('opacity-30', 'cursor-not-allowed');
            } else {
              input.classList.remove('opacity-30', 'cursor-not-allowed');
            }
          }
        };

        carregarRegraUI('num-pt-placar-exato', 'chk-pt-placar-exato', grupoAtual.pt_placar_exato, 12);
        carregarRegraUI('num-pt-vencedor-gols-time', 'chk-pt-vencedor-gols-time', grupoAtual.pt_vencedor_gols_time, 0);
        carregarRegraUI('num-pt-empate-nao-exato', 'chk-pt-empate-nao-exato', grupoAtual.pt_empate_nao_exato, 6);
        carregarRegraUI('num-pt-vencedor-saldo', 'chk-pt-vencedor-saldo', grupoAtual.pt_vencedor_saldo, 7);
        carregarRegraUI('num-pt-vencedor-gols-perdedor', 'chk-pt-vencedor-gols-perdedor', grupoAtual.pt_vencedor_gols_perdedor, 0);
        carregarRegraUI('num-pt-apenas-vencedor', 'chk-pt-apenas-vencedor', grupoAtual.pt_apenas_vencedor, 3);
        carregarRegraUI('num-pt-gols-um-time', 'chk-pt-gols-um-time', grupoAtual.pt_gols_um_time, 0);
      } else {
        adminSettings.classList.add('hidden');
      }
    }

    if (typeof carregarParticipantesGrupo === 'function') {
      carregarParticipantesGrupo();
    }
  }
}

function formatarData(dateStr) {
  const data = new Date(dateStr);
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const dia  = data.getDate();
  const mes  = meses[data.getMonth()];
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return dia + ' de ' + mes + ' às ' + hora;
}

// Monta o rodapé de distribuição de palpites de um jogo: "Casa X% · Emp. Y% · Fora Z%"
// e, com a regra ligada, um selo "Zebra Ativa" (algum time < 15%) ou "Sem Zebra".
// Recebe as porcentagens já em 0-100. Retorna '' se ainda não houver palpites.
function renderDistribuicaoZebra(homePct, empatePct, awayPct, total, regraZebraOn) {
  if (!total || total <= 0) return '';
  const h = Math.round(homePct), e = Math.round(empatePct), a = Math.round(awayPct);
  const empateZebra = empatePct < 15;
  let statusPill = '';
  if (regraZebraOn) {
    const temZebra = (homePct < 15 || empateZebra || awayPct < 15);
    statusPill = temZebra
      ? `<span class="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white whitespace-nowrap">🦓 Zebra Ativa</span>`
      : `<span class="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5 whitespace-nowrap">Sem Zebra</span>`;
  }
  return `
    <div class="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
        <span>Casa <span class="text-white/80">${h}%</span></span>
        <span class="text-white/20">·</span>
        <span>Emp. <span class="text-white/80">${e}%</span></span>${regraZebraOn && empateZebra ? ' <span title="Empate é zebra">🦓</span>' : ''}
        <span class="text-white/20">·</span>
        <span>Fora <span class="text-white/80">${a}%</span></span>
      </div>
      ${statusPill}
    </div>`;
}

function desenharCardsNaTela(jogos, palpitesDoUsuario = palpitesUsuario) {
  const container = document.getElementById('lista-jogos');
  container.innerHTML = '';

  if (jogos.length === 0) {
    container.innerHTML = renderEmptyState(
      '⚽', 
      'Fim de Jogo', 
      'Não há partidas agendadas para esta rodada no momento.'
    );
    return;
  }


  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const terminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];

  function obterStatusAgrupado(statusShort) {
    if (aoVivo.includes(statusShort)) return 'LIVE';
    if (terminados.includes(statusShort)) return 'MATCH_FINISHED';
    return 'NOT_STARTED';
  }

  const ordemStatus = { 'LIVE': 1, 'NOT_STARTED': 2, 'MATCH_FINISHED': 3 };

  // Ordena: LIVE primeiro, depois NOT_STARTED, por fim MATCH_FINISHED. Subordenados por data.
  const jogosOrdenados = [...jogos].sort((a, b) => {
    const statusA = obterStatusAgrupado(a.fixture.status.short);
    const statusB = obterStatusAgrupado(b.fixture.status.short);

    const diffStatus = ordemStatus[statusA] - ordemStatus[statusB];
    if (diffStatus !== 0) return diffStatus;

    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  let html = '';
  jogosOrdenados.forEach(function(jogo) {
    const id          = jogo.fixture.id;
    const data        = formatarData(jogo.fixture.date);
    const homeNome    = jogo.teams.home.name;
    const awayNome    = jogo.teams.away.name;
    const homeLogo    = getFlagUrl(jogo.teams.home.id) || jogo.teams.home.logo || '';
    const awayLogo    = getFlagUrl(jogo.teams.away.id) || jogo.teams.away.logo || '';
    const homeFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(homeNome) + '&background=047857&color=fff';
    const awayFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(awayNome) + '&background=b45309&color=fff';

    const kickoff = new Date(jogo.fixture.date);
    const agora = new Date();
    const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
    const isLocked = agora > dezMinutosAntes;

    const statusShort = jogo.fixture.status.short;
    const isLive = aoVivo.includes(statusShort);
    const isFinished = terminados.includes(statusShort);

    // Verifica se o usuário já tem palpite para essa partida
    const meuPalpite = palpitesDoUsuario.find(p => p.match_id === id);

    // Marcação de Zebra Dinâmica: destaca o time "zebra" (menos de 15% dos
    // palpites de vitória) assim que os palpites fecham. Só vale com a regra ligada.
    let homeZebra = false, awayZebra = false;
    const regraZebraLigada = (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.regra_zebra_dinamica === true);
    if (regraZebraLigada && isLocked) {
      const distZebra = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[id] : null;
      if (distZebra && distZebra.total > 0) {
        if (distZebra.home < 15) homeZebra = true;
        if (distZebra.away < 15) awayZebra = true;
      }
    }
    const zebraBadge = `<span class="mt-1 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shadow shadow-fuchsia-600/30" title="Poucos palpitaram nesse time — se ele vencer, vale o dobro!">🦓 Zebra 2x</span>`;

    // Rodapé com a distribuição Casa/Empate/Fora + selo de zebra (só após o bloqueio dos palpites)
    const distFooter = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[id] : null;
    const footerZebra = (isLocked && distFooter && distFooter.total > 0)
      ? renderDistribuicaoZebra(distFooter.home, distFooter.empate, distFooter.away, distFooter.total, regraZebraLigada)
      : '';

    let centerHtml = '';
    let cardBorderClass = 'border-white/5';
    let cardBgClass = '';
    let cardOpacityClass = '';

    if (isFinished) {
      const realHome = jogo.goals.home ?? 0;
      const realAway = jogo.goals.away ?? 0;
      let guessText = '';
      let ptsHtml = '';

      if (meuPalpite) {
        const vencedorReal = realHome > realAway ? 'home' : (realHome < realAway ? 'away' : 'empate');
        const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[jogo.fixture.id] : null;
        const pctVencedor = dist ? dist[vencedorReal] : 100;
        
        const pts = calcularPontosPalpite(meuPalpite.score_home, meuPalpite.score_away, realHome, realAway, jogo.league.round, pctVencedor);
        guessText = `Seu palpite: ${meuPalpite.score_home}x${meuPalpite.score_away}`;
        if (pts > 0) {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-gold/20 text-gold mt-1 tracking-wide uppercase">+${pts} PTS</span>`;
        } else {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500 mt-1 tracking-wide uppercase">0 PTS</span>`;
        }
        cardBorderClass = 'border-white/10';
      } else {
        guessText = 'Sem palpite';
        ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-600 mt-1 tracking-wide uppercase">0 PTS</span>`;
        cardBorderClass = 'border-red-500/10';
      }

      centerHtml = `
        <div class="flex flex-col items-center justify-center">
          <span class="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider mb-1 border border-white/5">ENCERRADO</span>
          <div class="text-xl font-black tracking-widest text-white/80">${realHome} x ${realAway}</div>
          <div class="text-[11px] text-text-muted mt-1 font-semibold">${guessText}</div>
          ${ptsHtml}
        </div>
      `;
      cardOpacityClass = 'opacity-70';

    } else if (isLive) {
      const realHome = jogo.goals.home ?? 0;
      const realAway = jogo.goals.away ?? 0;
      const elapsed = jogo.fixture.status.elapsed ? `${jogo.fixture.status.elapsed}'` : '';
      let guessText = '';
      let ptsHtml = '';

      if (meuPalpite) {
        const vencedorReal = realHome > realAway ? 'home' : (realHome < realAway ? 'away' : 'empate');
        const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[jogo.fixture.id] : null;
        const pctVencedor = dist ? dist[vencedorReal] : 100;
        
        const pts = calcularPontosPalpite(meuPalpite.score_home, meuPalpite.score_away, realHome, realAway, jogo.league.round, pctVencedor);
        guessText = `Seu palpite: ${meuPalpite.score_home}x${meuPalpite.score_away}`;
        if (pts > 0) {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-green/20 text-brand-green mt-1 tracking-wide uppercase animate-pulse">Parcial: +${pts} pts</span>`;
        } else {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 mt-1 tracking-wide uppercase">Parcial: 0 pts</span>`;
        }
        cardBorderClass = 'border-brand-green/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
        cardBgClass = 'bg-brand-green/5';
      } else {
        guessText = 'Sem palpite';
        ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-500 mt-1 tracking-wide uppercase">0 PTS</span>`;
      }

      centerHtml = `
        <div class="flex flex-col items-center justify-center">
          <span class="inline-flex items-center gap-1 bg-red-500/15 text-red-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider mb-1 animate-pulse border border-red-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            AO VIVO ${elapsed}
          </span>
          <div class="text-xl font-black tracking-widest text-white">${realHome} x ${realAway}</div>
          <div class="text-[11px] text-text-muted mt-1 font-semibold">${guessText}</div>
          ${ptsHtml}
        </div>
      `;

    } else {
      // NÃO INICIADO
      if (meuPalpite) {
        centerHtml = `
          <div id="placar-salvo-${id}" class="flex flex-col items-center">
            <div class="text-xl font-black tracking-widest text-white" id="lbl-placar-${id}">${meuPalpite.score_home} x ${meuPalpite.score_away}</div>
            <span class="text-brand-green text-[11px] font-bold mt-1">Palpitado</span>
          </div>
        `;
        cardBorderClass = 'border-brand-green/40';
        cardBgClass = 'bg-brand-green/5';
        cardOpacityClass = 'opacity-90';
      } else if (isLocked) {
        centerHtml = `
          <button id="btn-palpite-${id}" disabled class="border border-zinc-700 text-zinc-500 px-4 py-1.5 rounded-xl text-[13px] font-bold cursor-not-allowed bg-zinc-800/10">
            Bloqueado
          </button>
        `;
      } else {
        centerHtml = `
          <button id="btn-palpite-${id}" class="border border-brand-green text-brand-green px-4 py-1.5 rounded-xl text-[13px] font-bold hover:bg-brand-green hover:text-black transition-all">
            Palpitar
          </button>
        `;
      }
    }

    html += `
      <div id="card-jogo-${id}" onclick="abrirTelaPalpite(${id})" class="app-card bg-card-bg w-full p-4 border ${cardBorderClass} ${cardBgClass} ${cardOpacityClass} mb-4 transition-all cursor-pointer hover:border-brand-green/30">
        <div class="text-text-muted text-xs font-semibold tracking-wide mb-4">${data}</div>
        <div class="flex items-center justify-between">
          <div class="flex flex-col items-center w-1/3">
            <div class="w-11 h-11 rounded-lg overflow-hidden mb-2">
              <img src="${homeLogo}" onerror="this.onerror=null; this.src='${homeFallback}'" class="w-full h-full object-cover">
            </div>
            <span class="text-[13px] font-bold text-center">${homeNome}</span>
            ${homeZebra ? zebraBadge : ''}
          </div>
          <div class="w-1/3 flex flex-col items-center justify-center min-h-[60px]">
            ${centerHtml}
          </div>
          <div class="flex flex-col items-center w-1/3">
            <div class="w-11 h-11 rounded-lg overflow-hidden mb-2">
              <img src="${awayLogo}" onerror="this.onerror=null; this.src='${awayFallback}'" class="w-full h-full object-cover">
            </div>
            <span class="text-[13px] font-bold text-center">${awayNome}</span>
            ${awayZebra ? zebraBadge : ''}
          </div>
        </div>
        ${footerZebra}
      </div>`;
  });
  container.innerHTML = html;
}

function mudarGols(time, valor) {
  if (!jogoAtual) return;
  const id = jogoAtual.fixture.id;
  
  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = agora > dezMinutosAntes;
  
  if (isLocked) {
    return; // Não permite alterar gols se o jogo estiver bloqueado por tempo
  }

  if (time === 'd-home') {
    golsHome += valor;
    if (golsHome < 0) golsHome = 0;
    document.getElementById('d-home-score').innerText = golsHome;
  } else if (time === 'd-away') {
    golsAway += valor;
    if (golsAway < 0) golsAway = 0;
    document.getElementById('d-away-score').innerText = golsAway;
  }

  // Reage dinamicamente habilitando ou desabilitando o botão
  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const meuPalpiteLocal = palpitesUsuario.find(p => p.match_id === id);

  if (meuPalpiteLocal) {
    // Se já existe palpite anterior no banco/cache local
    const houveMudanca = (golsHome !== palpiteOriginal.home || golsAway !== palpiteOriginal.away);
    if (confirmBtn) {
      confirmBtn.disabled = !houveMudanca;
      confirmBtn.innerText = "ATUALIZAR PALPITE";
      if (houveMudanca) {
        confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
        confirmBtn.style.opacity = '1';
        confirmBtn.style.pointerEvents = 'auto';
      } else {
        confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl uppercase tracking-wide border border-white/5";
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.pointerEvents = 'none';
      }
    }
  } else {
    // Novo palpite
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerText = "CONFIRMAR PALPITE";
      confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'auto';
    }
  }
}

function atualizarInterfacePalpiteExistente(scoreHome, scoreAway, isTimeLocked) {
  golsHome = scoreHome;
  golsAway = scoreAway;
  document.getElementById('d-home-score').innerText = golsHome;
  document.getElementById('d-away-score').innerText = golsAway;

  // Define palpite original para controle de mudanças
  palpiteOriginal.home = scoreHome;
  palpiteOriginal.away = scoreAway;

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const scoreControlButtons = document.querySelectorAll("#view-palpite .bg-black\\/30 button");

  if (isTimeLocked) {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerText = "BLOQUEADO (PRAZO ENCERRADO)";
      confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl cursor-not-allowed uppercase tracking-wide border border-white/5";
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'auto';
    }
    scoreControlButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('opacity-30', 'cursor-not-allowed');
    });
  } else {
    // HABILITADO para edição mas o botão de salvar começa desabilitado/apagado até haver mudança!
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerText = "ATUALIZAR PALPITE";
      confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl uppercase tracking-wide border border-white/5";
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.pointerEvents = 'none';
    }
    scoreControlButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('opacity-30', 'cursor-not-allowed');
    });
  }
}

function liberarInterfacePalpite() {
  // Como é novo palpite, o original é 0x0
  palpiteOriginal.home = 0;
  palpiteOriginal.away = 0;

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const scoreControlButtons = document.querySelectorAll("#view-palpite .bg-black\\/30 button");

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerText = "CONFIRMAR PALPITE";
    confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
    confirmBtn.style.opacity = '1';
    confirmBtn.style.pointerEvents = 'auto';
  }
  scoreControlButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('opacity-30', 'cursor-not-allowed');
  });
}

function calcularDistribuicaoPalpites(guesses) {
  const distribuicao = {};
  guesses.forEach(g => {
    if (!distribuicao[g.match_id]) {
      distribuicao[g.match_id] = { home: 0, away: 0, empate: 0, total: 0 };
    }
    distribuicao[g.match_id].total++;
    if (g.score_home > g.score_away) {
      distribuicao[g.match_id].home++;
    } else if (g.score_away > g.score_home) {
      distribuicao[g.match_id].away++;
    } else {
      distribuicao[g.match_id].empate++;
    }
  });
  
  const percentuais = {};
  for (const mId in distribuicao) {
    const d = distribuicao[mId];
    percentuais[mId] = {
      home: d.total > 0 ? (d.home / d.total) * 100 : 0,
      away: d.total > 0 ? (d.away / d.total) * 100 : 0,
      empate: d.total > 0 ? (d.empate / d.total) * 100 : 0,
      total: d.total
    };
  }
  return percentuais;
}

function ehFaseMataMata(roundName) {
  if (!roundName) return false;
  const r = roundName.toLowerCase();
  if (r.includes('group') || r.includes('grupo')) return false;
  return r.includes('round') || r.includes('oitavas') || r.includes('quartas') || r.includes('semi') || r.includes('final') || r.includes('3rd') || r.includes('terceiro');
}

function calcularPontosPalpite(palpiteHome, palpiteAway, realHome, realAway, roundName = '', percentualVencedor = 100) {
  const pHome = parseInt(palpiteHome);
  const pAway = parseInt(palpiteAway);
  const rHome = parseInt(realHome);
  const rAway = parseInt(realAway);

  if (isNaN(pHome) || isNaN(pAway) || isNaN(rHome) || isNaN(rAway)) {
    return 0;
  }

  // Configuração padrão de pontos com fallback para as regras customizadas do grupo atual (se houver)
  const regras = {
    pt_placar_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_placar_exato !== undefined && grupoAtual.pt_placar_exato !== null) ? Number(grupoAtual.pt_placar_exato) : 12,
    pt_vencedor_saldo: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_saldo !== undefined && grupoAtual.pt_vencedor_saldo !== null) ? Number(grupoAtual.pt_vencedor_saldo) : 7,
    pt_empate_nao_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_empate_nao_exato !== undefined && grupoAtual.pt_empate_nao_exato !== null) ? Number(grupoAtual.pt_empate_nao_exato) : 6,
    pt_apenas_vencedor: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_apenas_vencedor !== undefined && grupoAtual.pt_apenas_vencedor !== null) ? Number(grupoAtual.pt_apenas_vencedor) : 3,
    
    // Novas regras premium
    regra_zebra_dinamica: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.regra_zebra_dinamica !== undefined) ? grupoAtual.regra_zebra_dinamica : false,
    mult_fase_final: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.mult_fase_final !== undefined && grupoAtual.mult_fase_final !== null) ? Number(grupoAtual.mult_fase_final) : 2
  };

  let pontosBase = 0;

  // ================= A CASCATA DE PONTUAÇÃO (RISCO X RETORNO) =================

  // 1. Placar Exato (Na Mosca)
  if (pHome === rHome && pAway === rAway && regras.pt_placar_exato > 0) {
    pontosBase = regras.pt_placar_exato;
  } else {
    const vencedorPalpite = pHome > pAway ? 'home' : (pHome < pAway ? 'away' : 'empate');
    const vencedorReal = rHome > rAway ? 'home' : (rHome < rAway ? 'away' : 'empate');
    const acertouVencedor = vencedorPalpite === vencedorReal;

    if (acertouVencedor) {
      // 2. Empate Não-Exato
      if (vencedorReal === 'empate' && regras.pt_empate_nao_exato > 0) {
        pontosBase = regras.pt_empate_nao_exato;
      } else {
        const saldoPalpite = Math.abs(pHome - pAway);
        const saldoReal = Math.abs(rHome - rAway);

        // 3. Vencedor e Saldo
        if (saldoPalpite === saldoReal && regras.pt_vencedor_saldo > 0) {
          pontosBase = regras.pt_vencedor_saldo;
        }
        // 4. Apenas o Vencedor
        else if (regras.pt_apenas_vencedor > 0) {
          pontosBase = regras.pt_apenas_vencedor;
        }
      }
    }
  }

  if (pontosBase === 0) return 0;

  // ================= APLICANDO MULTIPLICADORES =================
  let multiplicador = 1;

  // A. Multiplicador de Mata-Mata
  if (regras.mult_fase_final > 1 && ehFaseMataMata(roundName)) {
    multiplicador *= regras.mult_fase_final;
  }

  // B. Zebra Dinâmica (menos de 15% de apostas no time vencedor)
  if (regras.regra_zebra_dinamica && percentualVencedor < 15) {
    multiplicador *= 2;
  }

  return pontosBase * multiplicador;
}

function gerarFiltrosRodadas() {
  const container = document.getElementById('filtros-rodada');
  if (!container || todosOsJogos.length === 0) return;
  container.innerHTML = '';

  // Pega rodadas únicas de todosOsJogos
  const rodadas = [...new Set(todosOsJogos.map(j => j.league.round))];
  rodadas.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  if (!rodadaSelecionada && rodadas.length > 0) {
    // Detecta a rodada atual pelo PRÓXIMO JOGO cronologicamente (ignora adiados de rodadas antigas)
    const agora = new Date();

    // 1. Pega todos os jogos futuros e ordena por data
    const jogosFuturos = todosOsJogos
      .filter(j => new Date(j.fixture.date) > agora)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    if (jogosFuturos.length > 0) {
      // A rodada do próximo jogo mais perto de agora
      rodadaSelecionada = jogosFuturos[0].league.round;
    } else {
      // Se não tem jogos futuros, pega a última rodada que teve jogos finalizados
      const jogosFinalizados = todosOsJogos
        .filter(j => ['FT', 'AET', 'PEN'].includes(j.fixture.status.short))
        .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

      rodadaSelecionada = jogosFinalizados.length > 0
        ? jogosFinalizados[0].league.round
        : rodadas[rodadas.length - 1];
    }
  }

  let rodadasHtml = '';
  rodadas.forEach(rodada => {
    let nomeExibido = rodada;
    
    // Mapeamento amigável para Copa do Mundo e ligas comuns
    if (rodada.includes('Group Stage - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Group Stage - ')[1];
    } else if (rodada.includes('Regular Season - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Regular Season - ')[1];
    } else if (rodada === 'Round of 32') {
      nomeExibido = '16 avos';
    } else if (rodada === 'Round of 16') {
      nomeExibido = 'Oitavas';
    } else if (rodada === 'Quarter-finals') {
      nomeExibido = 'Quartas';
    } else if (rodada === 'Semi-finals') {
      nomeExibido = 'Semifinal';
    } else if (rodada === 'Match for 3rd place') {
      nomeExibido = '3º Lugar';
    } else if (rodada === 'Final') {
      nomeExibido = 'Final';
    }

    const isActive = rodada === rodadaSelecionada;
    const btnClass = isActive 
      ? "px-4 py-2 bg-brand-green text-black font-bold rounded-lg text-sm whitespace-nowrap" 
      : "px-4 py-2 bg-card-bg text-white font-bold rounded-lg text-sm whitespace-nowrap border border-white/5";
    const activeId = isActive ? 'id="btn-rodada-ativa"' : '';

    rodadasHtml += `
      <button ${activeId} onclick="filtrarPorRodada('${rodada.replace(/'/g, "\\'")}')" class="${btnClass}">
        ${nomeExibido}
      </button>
    `;
  });
  container.innerHTML = rodadasHtml;

  // Scroll automático para a rodada ativa ficar visível
  setTimeout(() => {
    const btnAtivo = document.getElementById('btn-rodada-ativa');
    if (btnAtivo) {
      btnAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 50);
}

function filtrarPorRodada(rodadaName) {
  rodadaSelecionada = rodadaName;
  gerarFiltrosRodadas();
  
  const jogosFiltrados = todosOsJogos.filter(j => j.league.round === rodadaName);
  desenharCardsNaTela(jogosFiltrados);
}

function atualizarSeletorRanking() {
  const seletor = document.getElementById('seletor-ranking');
  if (!seletor || todosOsJogos.length === 0) return;
  
  const valorAtual = seletor.value; // Salva a rodada selecionada anteriormente para não resetar se trocar de tela
  
  seletor.innerHTML = '<option value="geral">Ranking Geral</option>';
  
  const rodadas = [...new Set(todosOsJogos.map(j => j.league.round))];
  rodadas.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  rodadas.forEach(rodada => {
    let nomeExibido = rodada;
    
    if (rodada.includes('Group Stage - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Group Stage - ')[1];
    } else if (rodada.includes('Regular Season - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Regular Season - ')[1];
    } else if (rodada === 'Round of 32') {
      nomeExibido = '16 avos';
    } else if (rodada === 'Round of 16') {
      nomeExibido = 'Oitavas';
    } else if (rodada === 'Quarter-finals') {
      nomeExibido = 'Quartas';
    } else if (rodada === 'Semi-finals') {
      nomeExibido = 'Semifinal';
    } else if (rodada === 'Match for 3rd place') {
      nomeExibido = '3º Lugar';
    } else if (rodada === 'Final') {
      nomeExibido = 'Final';
    }
    
    seletor.innerHTML += `<option value="${rodada.replace(/"/g, '&quot;')}">Campeão da ${nomeExibido}</option>`;
  });
  
  // Restaura a seleção anterior se ela ainda for válida
  if (valorAtual && [...seletor.options].some(opt => opt.value === valorAtual)) {
    seletor.value = valorAtual;
  }
}

async function exibirRankingSelecionado() {
  const container = document.getElementById('lista-ranking');
  if (!container) return;
  
  const seletor = document.getElementById('seletor-ranking');
  const tipo = seletor ? seletor.value : 'geral';

  container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Carregando ranking...</p>';

  if (!sbClient || !grupoAtual) {
    container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Selecione um grupo para visualizar o ranking.</p>';
    return;
  }

  try {
    // 1. Busca todos os palpites do grupo ativo (paginado — teto fixo cortava jogadores)
    const rawGuesses = await buscarTodosPalpitesGrupo(grupoAtual.id);

    // 2. Busca todos os membros do grupo
    const { data: members, error: errMembers } = await sbClient
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', grupoAtual.id);

    if (errMembers) {
      console.error("Erro ao carregar membros:", errMembers.message);
      container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao buscar participantes.</p>';
      return;
    }

    // 2b. Busca pontos extras de desafios (user_desafios)
    let userDesafiosData = [];
    const { data: udData, error: errUD } = await sbClient
      .from('user_desafios')
      .select('user_id, points_awarded')
      .eq('group_id', grupoAtual.id);

    if (!errUD && udData) {
      userDesafiosData = udData;
    } else if (errUD) {
      console.error("Erro ao buscar user_desafios para ranking:", errUD.message);
    }

    if (!members || members.length === 0) {
      container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Nenhum membro neste grupo.</p>';
      return;
    }

    const userIds = members.map(m => m.user_id);

    // 3. Busca perfis dos membros (nome, avatar)
    const { data: profiles, error: errProfiles } = await sbClient
      .from('profiles')
      .select('id, full_name, avatar_url, apoiador, apoiador_ate')
      .in('id', userIds);

    if (errProfiles) console.error("Erro ao carregar perfis:", errProfiles.message);

    // 4. Estrutura o objeto de pontuação
    const scores = {};
    userIds.forEach(uid => {
      const profile = profiles ? profiles.find(p => p.id === uid) : null;
      const memberMeta = members.find(m => m.user_id === uid);
      scores[uid] = {
        id: uid,
        nome: profile ? profile.full_name : 'Participante',
        foto: profile && profile.avatar_url ? profile.avatar_url : null,
        apoiador: _apoiadorAtivo(profile),
        pontos: 0,
        acertosExatos: 0,
        isAdmin: memberMeta && memberMeta.role === 'owner'
      };
    });

    // 5. Calcula os pontos
    if (rawGuesses && rawGuesses.length > 0) {
      // Pré-calcula a distribuição de palpites do grupo para a Zebra Dinâmica
      const distribuicao = (typeof calcularDistribuicaoPalpites === 'function') 
        ? calcularDistribuicaoPalpites(rawGuesses) 
        : {};

      rawGuesses.forEach(g => {
        // Ignora palpites de usuários que não estão no grupo
        if (!scores[g.user_id]) return;

        const jogo = todosOsJogos.find(j => j.fixture.id === g.match_id);
        if (!jogo) return;

        // Se for ranking de rodada específica, filtra pelo round correspondente
        if (tipo !== 'geral' && jogo.league.round !== tipo) {
          return;
        }

        // Apenas calcula jogos finalizados
        const statusTerminado = ['FT', 'AET', 'PEN'].includes(jogo.fixture.status.short);
        if (statusTerminado && jogo.goals.home !== null && jogo.goals.away !== null) {
          const vencedorReal = jogo.goals.home > jogo.goals.away ? 'home' : (jogo.goals.home < jogo.goals.away ? 'away' : 'empate');
          const dist = distribuicao[g.match_id];
          const pctVencedor = dist ? dist[vencedorReal] : 100;

          const pts = calcularPontosPalpite(g.score_home, g.score_away, jogo.goals.home, jogo.goals.away, jogo.league.round, pctVencedor);
          scores[g.user_id].pontos += pts;
          
          // Verifica acerto exato comparando diretamente os placares
          if (g.score_home === jogo.goals.home && g.score_away === jogo.goals.away) {
            scores[g.user_id].acertosExatos += 1;
          }
        }
      });
    }

    // 5b. Adiciona pontos extras dos desafios do GM
    if (userDesafiosData && userDesafiosData.length > 0) {
      userDesafiosData.forEach(ud => {
        if (scores[ud.user_id]) {
          scores[ud.user_id].pontos += ud.points_awarded || 0;
        }
      });
    }

    // Ordena o ranking:
    // 1. Mais pontos descrescente.
    // 2. Critério de desempate: mais acertos exatos.
    const rankingList = Object.values(scores).sort((a, b) => {
      if (b.pontos !== a.pontos) {
        return b.pontos - a.pontos;
      }
      return b.acertosExatos - a.acertosExatos;
    });

    window.ultimoRankingCalculado = rankingList;

    // 6. Injeta na lista
    let rankHtml = '';
    rankingList.forEach((user, index) => {
      const posicao = index + 1;
      
      let medalhaClass = 'text-white/60 text-sm font-bold';
      let borderGold = 'border-white/5';
      let bgGlow = '';
      let badgePosicao = `${posicao}º`;

      if (posicao === 1) {
        medalhaClass = 'text-gold text-lg font-black';
        borderGold = 'glow-gold border-gold/30';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-gold"></div>';
      } else if (posicao === 2) {
        medalhaClass = 'text-silver text-lg font-bold';
        borderGold = 'border-silver/20';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-silver"></div>';
      } else if (posicao === 3) {
        medalhaClass = 'text-bronze text-lg font-bold';
        borderGold = 'border-bronze/20';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-bronze"></div>';
      }

      const isFree = grupoAtual.max_participants <= 3;
      const isLockedRow = isFree && index >= 3;
      const rowStyle = isLockedRow ? 'style="filter: blur(4px); opacity: 0.35; pointer-events: none; user-select: none;"' : '';

      const fotoUrl = user.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nome) + '&background=random&color=fff';
      const adminBadge = user.isAdmin ? '<span class="bg-gold/20 text-gold text-[9px] px-1 rounded ml-1 font-bold">ADMIN</span>' : '';
      const apoiadorBadge = user.apoiador ? '<span title="Apoiador do app" class="ml-1">💛</span>' : '';
      // Visual dourado pro apoiador (sem encostar nas bordas de medalha do top 3)
      if (user.apoiador && posicao > 3) borderGold = 'border-amber-400/40';
      const ringApoiador = user.apoiador ? 'ring-2 ring-amber-400/70' : '';
      const nomeCor = user.apoiador ? 'text-amber-300' : 'text-white';

      rankHtml += `
        <div ${rowStyle} onclick="abrirHistoricoUsuario('${user.id}', '${user.nome.replace(/'/g,"\\'")}', '${fotoUrl}')" class="app-card bg-card-bg p-4 flex items-center justify-between relative overflow-hidden border ${borderGold} mb-3 cursor-pointer hover:bg-card-hover hover:border-brand-green/30 active:scale-[0.99] transition-all">
          ${bgGlow}
          <div class="flex items-center gap-4 pl-2">
            <div class="w-6 flex flex-col items-center"><span class="${medalhaClass}">${badgePosicao}</span></div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg overflow-hidden bg-[#2a2a35] ${ringApoiador}">
                <img src="${fotoUrl}" class="w-full h-full object-cover">
              </div>
              <div>
                <h3 class="font-bold text-[14px] ${nomeCor}">${user.nome}${apoiadorBadge} ${adminBadge}</h3>
                <p class="text-[10px] text-text-muted mt-0.5">${user.acertosExatos} placares exatos</p>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-black text-white">${user.pontos}</div>
            <div class="text-[9px] text-text-muted font-bold uppercase tracking-wider">Pts</div>
          </div>
        </div>
      `;
    });

    const isFree = grupoAtual.max_participants <= 3;
    if (isFree && rankingList.length > 3) {
      const ehDono = usuarioAtual && (usuarioAtual.id === grupoAtual.owner_id);
      const actionButton = ehDono 
        ? `<button onclick="abrirModalUpgrade()" class="mt-4 bg-gradient-to-r from-purple-600 to-brand-green hover:opacity-90 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]">⚡ Desbloquear Ranking</button>`
        : `<p class="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl text-center">Fale com o dono para liberar a lista completa</p>`;

      rankHtml += `
        <div class="mt-4 p-5 bg-purple-900/10 border border-purple-500/20 rounded-2xl flex flex-col items-center text-center shadow-[0_0_25px_rgba(147,51,234,0.05)] relative z-10">
          <span class="text-2xl mb-2">🔒</span>
          <h4 class="text-white font-black text-sm uppercase tracking-wide">Ranking Completo Bloqueado</h4>
          <p class="text-zinc-400 text-[11px] leading-relaxed mt-1 max-w-[260px]">
            No plano gratuito, apenas o Top 3 é visível. Faça o upgrade para liberar a classificação de todos os participantes!
          </p>
          ${actionButton}
        </div>
      `;
    }
    container.innerHTML = rankHtml;

  } catch (err) {
    console.error("Erro inesperado ao renderizar ranking:", err);
    container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar o ranking.</p>';
  }
}

function alternarAba(abaNome) {
  const btnDetalhes = document.getElementById('btn-aba-detalhes');
  const btnPalpites = document.getElementById('btn-aba-palpites');
  const contentDetalhes = document.getElementById('tab-content-detalhes');
  const contentPalpites = document.getElementById('tab-content-palpites');

  if (abaNome === 'palpites') {
    if (jogoAtual) {
      carregarPalpitesDosAmigos(jogoAtual.fixture.id);
    }
    btnPalpites.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all";
    btnDetalhes.className = "flex-1 py-3 text-text-muted hover:text-white transition-all";
    contentDetalhes.classList.add('hidden');
    contentDetalhes.classList.remove('block');
    contentPalpites.classList.remove('hidden');
    contentPalpites.classList.add('block');
  } else {
    btnDetalhes.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all";
    btnPalpites.className = "flex-1 py-3 text-text-muted hover:text-white transition-all";
    contentDetalhes.classList.remove('hidden');
    contentDetalhes.classList.add('block');
    contentPalpites.classList.add('hidden');
    contentPalpites.classList.remove('block');
  }
}

async function carregarPalpitesDosAmigos(matchId) {
  const listaContainer = document.getElementById('lista-palpites-amigos');
  if (!sbClient || !grupoAtual) return;

  const isFree = grupoAtual.max_participants <= 3;
  if (isFree) {
    const ehDono = usuarioAtual && (usuarioAtual.id === grupoAtual.owner_id);
    const actionButton = ehDono 
      ? `<button onclick="abrirModalUpgrade()" class="mt-4 bg-gradient-to-r from-purple-600 to-brand-green hover:opacity-90 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]">⚡ Desbloquear Recursos</button>`
      : `<p class="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl text-center">Fale com o dono para liberar</p>`;

    listaContainer.innerHTML = `
      <div class="mt-2 p-5 bg-purple-900/10 border border-purple-500/20 rounded-2xl flex flex-col items-center text-center shadow-[0_0_25px_rgba(147,51,234,0.05)] w-full">
        <span class="text-2xl mb-2">🔒</span>
        <h4 class="text-white font-black text-sm uppercase tracking-wide">Palpites Ocultados</h4>
        <p class="text-zinc-400 text-[11px] leading-relaxed mt-1 max-w-[260px]">
          O acesso aos palpites detalhados dos seus amigos é um recurso exclusivo do Plano Resenha. Faça o upgrade para desbloquear!
        </p>
        ${actionButton}
      </div>
    `;
    return;
  }

  listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Carregando palpites...</p>';

  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = agora > dezMinutosAntes;

  try {
    const { data: rawGuesses, error: errGuesses } = await sbClient
      .from('guesses')
      .select('user_id, score_home, score_away')
      .eq('match_id', matchId)
      .eq('group_id', grupoAtual.id);

    if (errGuesses) {
      console.error("Erro ao buscar palpites dos amigos:", errGuesses.message);
      listaContainer.innerHTML = '<p class="text-red-400 text-[13px] text-center py-4">Erro ao carregar palpites.</p>';
      return;
    }

    let guesses = [];
    if (rawGuesses && rawGuesses.length > 0) {
      const userIds = rawGuesses.map(g => g.user_id);
      const { data: profiles, error: errProfiles } = await sbClient
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (errProfiles) console.error("Erro ao buscar perfis:", errProfiles.message);

      guesses = rawGuesses.map(g => {
        const p = profiles ? profiles.find(prof => prof.id === g.user_id) : null;
        return {
          ...g,
          profiles: p
        };
      });
    }

    if (isLocked) {
      if (!guesses || guesses.length === 0) {
        listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Nenhum palpite enviado para este jogo.</p>';
        return;
      }

      let pHtml = '';
      guesses.forEach(guess => {
        const name = guess.profiles ? guess.profiles.full_name : 'Participante';
        const avatar = guess.profiles && guess.profiles.avatar_url
          ? guess.profiles.avatar_url
          : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';

        pHtml += `
          <div class="bg-zinc-800/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
            <div class="flex items-center gap-3">
              <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
              <span class="font-bold text-[14px] text-white">${name}</span>
            </div>
            <div class="bg-black/40 px-3 py-1 rounded-lg font-black text-brand-green text-[14px]">
              ${guess.score_home} x ${guess.score_away}
            </div>
          </div>
        `;
      });
      listaContainer.innerHTML = pHtml;
    } else {
      // Jogo ativo: os palpites dos outros permanecem secretos por RLS
      let pHtml = `
        <div class="bg-zinc-800/20 p-5 rounded-2xl border border-white/5 text-center fade-in">
          <p class="text-brand-green font-bold text-[14px] mb-2">🔒 Palpites Ocultos</p>
          <p class="text-text-muted text-[12px] leading-relaxed">
            Para manter a disputa justa, os palpites dos outros participantes ficarão visíveis a partir de 10 minutos antes do início do jogo.
          </p>
        </div>
      `;

      // Listamos quem já palpitou para instigar a participação, mas sem revelar o placar!
      if (guesses && guesses.length > 0) {
        pHtml += `<h3 class="text-[11px] font-bold text-text-muted uppercase tracking-widest mt-6 mb-3">Já participaram:</h3><div class="space-y-2">`;
        guesses.forEach(guess => {
          const name = guess.profiles ? guess.profiles.full_name : 'Participante';
          const avatar = guess.profiles && guess.profiles.avatar_url
            ? guess.profiles.avatar_url
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';

          pHtml += `
            <div class="bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
              <div class="flex items-center gap-3">
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                <span class="font-bold text-[13px] text-white">${name}</span>
              </div>
              <span class="text-brand-green text-[11px] font-bold">Palpitou</span>
            </div>
          `;
        });
        pHtml += `</div>`;
      }
      listaContainer.innerHTML = pHtml;
    }
  } catch (err) {
    console.error("Erro inesperado ao carregar palpites:", err);
    listaContainer.innerHTML = '<p class="text-red-400 text-[13px] text-center py-4">Erro ao carregar palpites.</p>';
  }
}

async function abrirTelaPalpite(id) {
  localStorage.setItem('last_active_match_id', id);
  jogoAtual = todosOsJogos.find(j => Number(j.fixture.id) === Number(id));
  if (!jogoAtual) return;

  const homeNome     = jogoAtual.teams.home.name;
  const awayNome     = jogoAtual.teams.away.name;
  const homeLogo     = getFlagUrl(jogoAtual.teams.home.id) || jogoAtual.teams.home.logo || '';
  const awayLogo     = getFlagUrl(jogoAtual.teams.away.id) || jogoAtual.teams.away.logo || '';
  const homeFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(homeNome) + '&background=047857&color=fff';
  const awayFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(awayNome) + '&background=b45309&color=fff';

  // Reset tabs and set default view to 'detalhes'
  alternarAba('detalhes');

  // Preenche os detalhes da partida
  document.getElementById('d-home-nome').innerText = homeNome;
  document.getElementById('d-away-nome').innerText = awayNome;
  document.getElementById('d-home-logo').src       = homeLogo;
  document.getElementById('d-home-logo').onerror  = function() { this.src = homeFallback; };
  document.getElementById('d-away-logo').src       = awayLogo;
  document.getElementById('d-away-logo').onerror  = function() { this.src = awayFallback; };
  
  // Formata e exibe a data do jogo
  document.getElementById('d-jogo-data').innerText = formatarData(jogoAtual.fixture.date);

  // Estatísticas dos times (perk de apoiador) no Detalhes do Jogo
  if (typeof carregarEstatisticasDetalhe === 'function') carregarEstatisticasDetalhe(jogoAtual);

  // Define o placar real da partida ou "VS" na tela de detalhes
  const realScoreEl = document.getElementById('d-real-score');
  const statusShort = jogoAtual.fixture.status.short;
  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const terminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];
  const isLive = aoVivo.includes(statusShort);
  const isFinished = terminados.includes(statusShort);

  if (realScoreEl) {
    if (isLive || isFinished) {
      const realHome = jogoAtual.goals.home ?? 0;
      const realAway = jogoAtual.goals.away ?? 0;
      realScoreEl.innerHTML = `<span class="text-xl font-black text-white">${realHome} x ${realAway}</span>`;
      if (isLive) {
        const elapsed = jogoAtual.fixture.status.elapsed ? ` (${jogoAtual.fixture.status.elapsed}')` : '';
        document.getElementById('d-jogo-data').innerHTML = `<span class="text-red-500 font-bold animate-pulse">● AO VIVO${elapsed}</span>`;
      } else {
        document.getElementById('d-jogo-data').innerHTML = `<span class="text-zinc-400 font-bold">ENCERRADO</span>`;
      }
    } else {
      realScoreEl.innerText = 'VS';
    }
  }

  // Limpa dados de palpitadores anteriores antes de carregar os novos
  document.getElementById('d-contador-palpites').innerText = "Carregando...";
  document.getElementById('d-palpitadores-fotos').innerHTML = "";
  document.getElementById('lista-palpites-amigos').innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Carregando palpites...</p>';

  // Verifica bloqueio de tempo (10 minutos antes do kickoff) ou se o jogo já iniciou/terminou
  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = (agora > dezMinutosAntes) || isLive || isFinished;

  // 1. Verificação SÍNCRONA no cache local para evitar piscadas
  const meuPalpiteLocal = palpitesUsuario.find(p => p.match_id === id);

  if (meuPalpiteLocal) {
    atualizarInterfacePalpiteExistente(meuPalpiteLocal.score_home, meuPalpiteLocal.score_away, isLocked);
  } else {
    if (isLocked) {
      atualizarInterfacePalpiteExistente(0, 0, true);
    } else {
      golsHome = 0;
      golsAway = 0;
      document.getElementById('d-home-score').innerText = 0;
      document.getElementById('d-away-score').innerText = 0;
      liberarInterfacePalpite();
    }
  }

  // Abre a tela de palpites imediatamente com o layout correto
  switchView('view-palpite');

  // Ativa o monitoramento ao vivo caso a partida esteja rolando
  if (isLive) {
    ativarTelaAoVivo(id);
  }

  // 2. Consulta rápida silenciosa no Supabase para garantir consistência
  if (sbClient && grupoAtual) {
    sbClient.auth.getUser().then(function(result) {
      const user = result.data.user;
      if (user) {
        sbClient
          .from('guesses')
          .select('score_home, score_away')
          .eq('match_id', id)
          .eq('user_id', user.id)
          .eq('group_id', grupoAtual.id)
          .maybeSingle()
          .then(function(res) {
            if (res.data) {
              const dbPalpite = res.data;
              // Se o palpite local não existia ou difere do banco, atualiza
              if (!meuPalpiteLocal || meuPalpiteLocal.score_home !== dbPalpite.score_home || meuPalpiteLocal.score_away !== dbPalpite.score_away) {
                atualizarInterfacePalpiteExistente(dbPalpite.score_home, dbPalpite.score_away, isLocked);
                
                // Atualiza cache local
                const idx = palpitesUsuario.findIndex(p => p.match_id === id);
                if (idx !== -1) {
                  palpitesUsuario[idx].score_home = dbPalpite.score_home;
                  palpitesUsuario[idx].score_away = dbPalpite.score_away;
                } else {
                  palpitesUsuario.push({
                    match_id: id,
                    score_home: dbPalpite.score_home,
                    score_away: dbPalpite.score_away
                  });
                }
              }
            }
          });
      }
    });
  }

  // 3. Carrega informações dinâmicas do grupo (membros e palpites dos amigos)
  if (sbClient && grupoAtual) {
    try {
      // Busca total de membros do grupo
      const { count: totalMembers, error: errMembers } = await sbClient
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', grupoAtual.id);

      if (errMembers) console.error("Erro ao buscar membros:", errMembers.message);

      // Busca palpites deste jogo neste grupo
      const { data: rawGuesses, error: errGuesses } = await sbClient
        .from('guesses')
        .select('user_id, score_home, score_away')
        .eq('match_id', id)
        .eq('group_id', grupoAtual.id);

      if (errGuesses) console.error("Erro ao buscar palpites:", errGuesses.message);

      let guesses = [];
      if (rawGuesses && rawGuesses.length > 0) {
        const userIds = rawGuesses.map(g => g.user_id);
        const { data: profiles, error: errProfiles } = await sbClient
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (errProfiles) console.error("Erro ao buscar perfis:", errProfiles.message);

        guesses = rawGuesses.map(g => {
          const p = profiles ? profiles.find(prof => prof.id === g.user_id) : null;
          return {
            ...g,
            profiles: p
          };
        });
      }
      const totalGuesses = guesses.length;

      // ... e o resto de carregar dados dinâmicos da partida
      const countVal = totalGuesses || 0;
      const membersVal = totalMembers || 0;
      document.getElementById('d-contador-palpites').innerText = `${countVal} de ${membersVal} palpitaram`;

      const fotosContainer = document.getElementById('d-palpitadores-fotos');
      fotosContainer.innerHTML = "";
      
      if (guesses && guesses.length > 0) {
        guesses.slice(0, 5).forEach(guess => {
          const name = guess.profiles ? guess.profiles.full_name : 'Participante';
          const avatar = guess.profiles && guess.profiles.avatar_url 
            ? guess.profiles.avatar_url 
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
          
          fotosContainer.innerHTML += `
            <img src="${avatar}" title="${name}" class="w-6 h-6 rounded-full border border-card-bg object-cover flex-shrink-0">
          `;
        });
        if (guesses.length > 5) {
          fotosContainer.innerHTML += `
            <div class="w-6 h-6 rounded-full border border-card-bg bg-zinc-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 text-white">+${guesses.length - 5}</div>
          `;
        }
      }

      const listaContainer = document.getElementById('lista-palpites-amigos');
      
      const isFree = grupoAtual.max_participants <= 3;
      if (isFree) {
        const ehDono = usuarioAtual && (usuarioAtual.id === grupoAtual.owner_id);
        const actionButton = ehDono 
          ? `<button onclick="abrirModalUpgrade()" class="mt-4 bg-gradient-to-r from-purple-600 to-brand-green hover:opacity-90 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]">⚡ Desbloquear Recursos</button>`
          : `<p class="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl text-center">Fale com o dono para liberar</p>`;

        listaContainer.innerHTML = `
          <div class="mt-2 p-5 bg-purple-900/10 border border-purple-500/20 rounded-2xl flex flex-col items-center text-center shadow-[0_0_25px_rgba(147,51,234,0.05)] w-full">
            <span class="text-2xl mb-2">🔒</span>
            <h4 class="text-white font-black text-sm uppercase tracking-wide">Palpites Ocultados</h4>
            <p class="text-zinc-400 text-[11px] leading-relaxed mt-1 max-w-[260px]">
              O acesso aos palpites detalhados dos seus amigos é um recurso exclusivo do Plano Resenha. Faça o upgrade para desbloquear!
            </p>
            ${actionButton}
          </div>
        `;
        return;
      }

      if (isLocked) {
        if (!guesses || guesses.length === 0) {
          listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Nenhum palpite enviado ainda.</p>';
        } else {
          let p2Html = '';
          guesses.forEach(guess => {
            const name = guess.profiles ? guess.profiles.full_name : 'Participante';
            const avatar = guess.profiles && guess.profiles.avatar_url
              ? guess.profiles.avatar_url
              : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';

            p2Html += `
              <div class="bg-zinc-800/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
                <div class="flex items-center gap-3">
                  <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                  <span class="font-bold text-[14px] text-white">${name}</span>
                </div>
                <div class="bg-black/40 px-3 py-1 rounded-lg font-black text-brand-green text-[14px]">
                  ${guess.score_home} x ${guess.score_away}
                </div>
              </div>
            `;
          });
          listaContainer.innerHTML = p2Html;
        }
      } else {
        let p2Html = `
          <div class="bg-zinc-800/20 p-5 rounded-2xl border border-white/5 text-center fade-in">
            <p class="text-brand-green font-bold text-[14px] mb-2">🔒 Palpites Ocultos</p>
            <p class="text-text-muted text-[12px] leading-relaxed">
              Para manter a disputa justa, os palpites dos outros participantes ficarão visíveis a partir de 10 minutos antes do início do jogo.
            </p>
          </div>
        `;

        if (guesses && guesses.length > 0) {
          p2Html += `<h3 class="text-[11px] font-bold text-text-muted uppercase tracking-widest mt-6 mb-3">Já participaram:</h3><div class="space-y-2">`;
          guesses.forEach(guess => {
            const name = guess.profiles ? guess.profiles.full_name : 'Participante';
            const avatar = guess.profiles && guess.profiles.avatar_url
              ? guess.profiles.avatar_url
              : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';

            p2Html += `
              <div class="bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
                <div class="flex items-center gap-3">
                  <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                  <span class="font-bold text-[13px] text-white">${name}</span>
                </div>
                <span class="text-brand-green text-[11px] font-bold">Palpitou</span>
              </div>
            `;
          });
          p2Html += `</div>`;
        }
        listaContainer.innerHTML = p2Html;
      }

    } catch (e) {
      console.error("Erro ao carregar dados dinâmicos da partida:", e);
    }
  }

  // 4. Carrega desafio do jogador (GM) para este jogo se houver
  if (typeof carregarDesafioPartida === 'function') {
    carregarDesafioPartida(id);
  }
}

async function salvarPalpite() {
  if (!sbClient) {
    showToast("Supabase não está inicializado.", "error");
    return;
  }
  if (!grupoAtual) {
    showToast("Nenhum grupo ativo selecionado.", "error");
    return;
  }

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const originalText = confirmBtn ? confirmBtn.innerHTML : "Confirmar Palpite";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-black inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...';
  }

  try {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) {
      showToast("Você precisa estar logado para palpitar!", "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    const id = jogoAtual.fixture.id;

    // 1. Garante que o jogo existe na tabela matches (exigido pela FK constraint)
    const { error: matchError } = await sbClient.from('matches').upsert([{
      id:           jogoAtual.fixture.id,
      league_id:    jogoAtual.league.id,
      season:       jogoAtual.league.season,
      home_team:    jogoAtual.teams.home.name,
      home_team_id: jogoAtual.teams.home.id,
      home_logo:    getFlagUrl(jogoAtual.teams.home.id) || jogoAtual.teams.home.logo || '',
      away_team:    jogoAtual.teams.away.name,
      away_team_id: jogoAtual.teams.away.id,
      away_logo:    getFlagUrl(jogoAtual.teams.away.id) || jogoAtual.teams.away.logo || '',
      kickoff:      jogoAtual.fixture.date,
      status:       jogoAtual.fixture.status.short,
      score_home:   jogoAtual.goals.home,
      score_away:   jogoAtual.goals.away,
      minute:       jogoAtual.fixture.status.elapsed != null ? String(jogoAtual.fixture.status.elapsed) : null,
      round:        jogoAtual.league.round
    }], { onConflict: 'id' });

    if (matchError) {
      console.error("Erro ao salvar partida:", matchError.message);
      showToast("Erro ao preparar dados da partida. Tente novamente.", "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    // 2. Envia o palpite para o guesses (com group_id do grupo ativo)
    const { error: guessError } = await sbClient
      .from('guesses')
      .upsert([{
        user_id:    user.id,
        match_id:   id,
        score_home: golsHome,
        score_away: golsAway,
        group_id:   grupoAtual.id
      }], { onConflict: 'user_id,group_id,match_id' });

    if (guessError) {
      console.error("Erro ao salvar palpite:", guessError.message);
      showToast("Não foi possível salvar seu palpite. Tente novamente.", "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    // 3. Atualiza a UI se salvou com sucesso
    const idx = palpitesUsuario.findIndex(p => p.match_id === id);
    if (idx !== -1) {
      palpitesUsuario[idx].score_home = golsHome;
      palpitesUsuario[idx].score_away = golsAway;
    } else {
      palpitesUsuario.push({
        match_id: id,
        score_home: golsHome,
        score_away: golsAway
      });
    }

    // Redefine o original para que a interface reflita o estado salvo
    palpiteOriginal.home = golsHome;
    palpiteOriginal.away = golsAway;

    showToast("Palpite salvo com sucesso!", "success");
    switchView('view-jogos');
    gerarFiltrosRodadas();
    filtrarPorRodada(rodadaSelecionada);

  } catch (e) {
    console.error("Erro inesperado:", e);
    showToast("Ocorreu um erro inesperado. Tente novamente.", "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  }
}

// ============ SIMULADOR DE PONTUAÇÃO (TESTE VIA CONSOLE) ============

/**
 * Uso no console do navegador (F12):
 *   simularPontuacaoLocal('2x1', '2x1')  → Placar Exato = 30 pts
 *   simularPontuacaoLocal('3x1', '2x0')  → Vencedor + saldo = 15 pts
 *   simularPontuacaoLocal('1x0', '3x2')  → Só vencedor = 4 pts
 *   simularPontuacaoLocal('0x0', '1x1')  → Empate (não exato) = 18 pts
 */
window.simularPontuacaoLocal = function(palpiteStr, resultadoStr) {
  const parsePlacar = (str) => {
    const partes = str.toLowerCase().split('x');
    return { home: parseInt(partes[0]), away: parseInt(partes[1]) };
  };

  const p = parsePlacar(palpiteStr);
  const r = parsePlacar(resultadoStr);

  if (isNaN(p.home) || isNaN(p.away) || isNaN(r.home) || isNaN(r.away)) {
    console.error('❌ Formato inválido. Use: simularPontuacaoLocal("2x1", "3x2")');
    return;
  }

  const pts = calcularPontosPalpite(p.home, p.away, r.home, r.away);

  const tabela = {
    30: '🏆 Placar Exato',
    18: '🎯 Empate / Vencedor + gols de um time',
    15: '📊 Vencedor + saldo de gols',
    12: '⚽ Vencedor + gols do perdedor',
    4:  '✅ Acertou o vencedor',
    3:  '🔢 Acertou placar de algum time',
    0:  '❌ Nenhum acerto'
  };

  console.log(`\n📋 SIMULAÇÃO DE PONTUAÇÃO`);
  console.log(`   Palpite:   ${p.home} x ${p.away}`);
  console.log(`   Resultado: ${r.home} x ${r.away}`);
  console.log(`   ─────────────────────`);
  console.log(`   Pontos: ${pts}  →  ${tabela[pts] || '?'}`);
  console.log(``);

  return pts;
};

function abrirSuporteWhatsapp() {
  if (typeof SUPORTE_WHATSAPP !== 'undefined' && SUPORTE_WHATSAPP && SUPORTE_WHATSAPP !== '5500000000000') {
    const url = `https://wa.me/${SUPORTE_WHATSAPP}`;
    window.open(url, '_blank');
  } else {
    showToast("O administrador ainda não configurou o número de suporte!", "error");
  }
}

function verificarBannerPWA() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  // Verifica se já está rodando standalone (salvo na tela inicial)
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  if (!isStandalone) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// Carrega e desenha o desafio do jogador (GM) se aplicável
async function carregarDesafioPartida(fixtureId) {
  const container = document.getElementById('desafio-jogo-container');
  if (!container) return;

  container.classList.add('hidden');
  container.innerHTML = '';

  if (!sbClient || !grupoAtual || !usuarioAtual) return;

  try {
    // 1. Busca se há um desafio ativo para a partida
    const { data: desafio, error: errDesafio } = await sbClient
      .from('desafios')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('status', 'active')
      .maybeSingle();

    if (errDesafio || !desafio) return;

    // 2. Busca se o usuário logado já votou nesse desafio
    const { data: meuVoto, error: errVoto } = await sbClient
      .from('user_desafios')
      .select('*')
      .eq('desafio_id', desafio.id)
      .eq('user_id', usuarioAtual.id)
      .eq('group_id', grupoAtual.id)
      .maybeSingle();

    container.classList.remove('hidden');

    const hasPenalty = desafio.event_type.endsWith('_penalty');
    const cleanEventType = desafio.event_type.replace('_penalty', '');

    let acaoTexto = '';
    let customQuestion = '';
    
    if (cleanEventType === 'Goal') {
      acaoTexto = 'marca primeiro';
      customQuestion = 'Qual time marca primeiro? ⚽';
    } else if (cleanEventType === 'Card') {
      acaoTexto = 'leva o primeiro cartão';
      customQuestion = 'Qual time leva o primeiro cartão? 🟨';
    } else if (cleanEventType === 'Assist') {
      acaoTexto = 'dará uma ASSISTÊNCIA';
      customQuestion = 'Quem dará uma ASSISTÊNCIA nesta partida?';
    } else if (cleanEventType === 'CardYellow') {
      acaoTexto = 'receberá CARTÃO AMARELO';
      customQuestion = 'Quem receberá CARTÃO AMARELO nesta partida?';
    } else if (cleanEventType === 'CardRed') {
      acaoTexto = 'receberá CARTÃO VERMELHO';
      customQuestion = 'Quem receberá CARTÃO VERMELHO nesta partida?';
    } else if (cleanEventType.startsWith('CornersOver')) {
      const limit = cleanEventType.replace('CornersOver', '');
      acaoTexto = `Mais/Menos de ${limit} Escanteios`;
      customQuestion = `Teremos mais ou menos de ${limit} escanteios na partida?`;
    } else if (cleanEventType.startsWith('CardsOver')) {
      const limit = cleanEventType.replace('CardsOver', '');
      acaoTexto = `Mais/Menos de ${limit} Cartões`;
      customQuestion = `Teremos mais ou menos de ${limit} cartões na partida?`;
    } else if (cleanEventType === 'BTTS') {
      acaoTexto = 'Ambos Marcam';
      customQuestion = 'Ambos os times marcam gols nesta partida?';
    } else {
      acaoTexto = cleanEventType;
      customQuestion = `Qual opção vencerá o desafio especial?`;
    }

    const infoPontosText = hasPenalty
      ? `(+${desafio.points} pts / -${desafio.points} pts se errar)`
      : `(+${desafio.points} pts)`;

    const subheaderText = hasPenalty
      ? `Acerte e ganhe +${desafio.points} pts. Erre e perca -${desafio.points} pts! ⚠️`
      : `Acerte e ganhe +${desafio.points} pontos extras!`;

    const custo = desafio.custo_fichas || 0;
    const fichasAtuais = usuarioAtual?.fichas ?? 3;
    const semFichas = custo > 0 && fichasAtuais < custo;
    const custoBadge = custo > 0
      ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${semFichas ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}">🎫 ${custo} ficha${custo > 1 ? 's' : ''}</span>`
      : '';

    if (meuVoto) {
      container.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/20 rounded-2xl p-5 border border-purple-500/30 shadow-lg relative overflow-hidden fade-in mt-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm flex-shrink-0">🏆</div>
            <div>
              <h4 class="font-black text-xs text-purple-400 uppercase tracking-widest">Desafio Aceito</h4>
              <p class="text-[12px] text-white font-medium mt-1">Você escolheu <span class="text-purple-300 font-bold">${meuVoto.chosen_player}</span> para acertar o desafio.</p>
              <p class="text-[10px] text-text-muted mt-2">Aguardando o encerramento do jogo para validação do prêmio ${infoPontosText}.</p>
            </div>
          </div>
        </div>
      `;
    } else {
      let buttonsHtml = '';
      desafio.players.forEach(player => {
        buttonsHtml += `
          <button onclick="responderDesafioReal('${desafio.id}', '${player.replace(/'/g, "\\'")}')" ${semFichas ? 'disabled' : ''} class="w-full bg-zinc-900 hover:bg-purple-900/40 border border-zinc-800 hover:border-purple-500/50 text-white hover:text-purple-300 font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 text-center truncate disabled:opacity-40 disabled:cursor-not-allowed">
            ${player}
          </button>
        `;
      });

      container.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900/40 to-indigo-900/30 rounded-2xl p-5 border border-purple-500/40 shadow-lg relative overflow-hidden fade-in mt-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg flex-shrink-0">🏆</div>
              <div>
                <h4 class="font-black text-xs text-purple-300 uppercase tracking-widest">Desafio Especial do GM</h4>
                <p class="text-[13px] text-white/90 font-bold mt-1">${customQuestion}</p>
                <p class="text-[10px] text-purple-400 font-medium mt-0.5">${subheaderText}</p>
                ${semFichas ? `<p class="text-[10px] text-red-400 font-bold mt-1">Fichas insuficientes (você tem ${fichasAtuais} 🎫)</p>` : ''}
              </div>
            </div>
            ${custoBadge}
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${buttonsHtml}
          </div>
        </div>
      `;
    }

  } catch (e) {
    console.error("Erro ao carregar desafio da partida:", e);
  }
}

function atualizarDisplayFichas() {
  const fichas = (usuarioAtual && usuarioAtual.fichas !== undefined) ? usuarioAtual.fichas : '...';
  document.querySelectorAll('.badge-fichas').forEach(b => { b.textContent = `🎫 ${fichas}`; });
}

// Salva a resposta do usuário no desafio
async function responderDesafioReal(desafioId, jogadorEscolhido) {
  if (!sbClient || !grupoAtual || !usuarioAtual) return;

  try {
    // 1. Busca custo do desafio
    const { data: desafioInfo } = await sbClient
      .from('desafios')
      .select('custo_fichas')
      .eq('id', desafioId)
      .maybeSingle();

    const custo = desafioInfo?.custo_fichas || 0;

    // 2. Verifica saldo de fichas
    if (custo > 0) {
      const fichasAtuais = usuarioAtual.fichas ?? 3;
      if (fichasAtuais < custo) {
        showToast(`Fichas insuficientes! Você tem ${fichasAtuais} 🎫 e este desafio custa ${custo} 🎫`, 'error');
        return;
      }
    }

    // 3. Salva o voto
    const { error } = await sbClient
      .from('user_desafios')
      .insert([{
        user_id: usuarioAtual.id,
        desafio_id: desafioId,
        group_id: grupoAtual.id,
        chosen_player: jogadorEscolhido,
        points_awarded: 0
      }]);

    if (error) {
      showToast("Erro ao aceitar desafio: " + error.message, "error");
      return;
    }

    // 4. Desconta fichas no banco e atualiza local
    if (custo > 0) {
      const novasFichas = (usuarioAtual.fichas ?? 3) - custo;
      await sbClient.from('profiles').update({ fichas_desafio: novasFichas }).eq('id', usuarioAtual.id);
      usuarioAtual.fichas = novasFichas;
      atualizarDisplayFichas();
    }

    const msg = custo > 0
      ? `Desafio aceito! Apostou em ${jogadorEscolhido} (-${custo} 🎫)`
      : `Desafio aceito! Você apostou em: ${jogadorEscolhido}`;
    showToast(msg, 'success');

    if (jogoAtual) {
      carregarDesafioPartida(jogoAtual.fixture.id);
    }

  } catch (e) {
    console.error("Erro ao responder desafio:", e);
  }
}

// ============ MONITORAMENTO E POLLING AO VIVO ============

function ativarTelaAoVivo(fixtureId) {
  desativarTelaAoVivo();
  if (!jogoAtual) return;

  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  if (!aoVivo.includes(jogoAtual.fixture.status.short)) return;

  console.log(`[LIVE POLLING] Iniciado para a partida ${fixtureId}`);

  intervaloAoVivo = setInterval(async () => {
    console.log(`[LIVE POLLING] Buscando dados...`);
    if (typeof buscarDadosAoVivo === 'function') {
      const jogosAoVivo = await buscarDadosAoVivo();
      if (Array.isArray(jogosAoVivo)) {
        const jogoEspecifico = jogosAoVivo.find(j => j.fixture.id === fixtureId);
        if (jogoEspecifico) {
          renderizarPlacarAoVivo(jogoEspecifico);
        }
      }
    }
  }, 60000); // 60 segundos
}

function desativarTelaAoVivo() {
  if (intervaloAoVivo) {
    console.log('[LIVE POLLING] Encerrado.');
    clearInterval(intervaloAoVivo);
    intervaloAoVivo = null;
  }
}

function renderizarPlacarAoVivo(jogo) {
  // Atualiza os dados locais na tabela global de jogos
  if (Array.isArray(todosOsJogos)) {
    const idx = todosOsJogos.findIndex(j => j.fixture.id === jogo.fixture.id);
    if (idx !== -1) {
      todosOsJogos[idx] = jogo;
    }
  }

  // Se o usuário ainda estiver olhando para este jogo, atualiza a tela
  if (jogoAtual && jogoAtual.fixture.id === jogo.fixture.id) {
    jogoAtual = jogo;
    const realHome = jogo.goals.home ?? 0;
    const realAway = jogo.goals.away ?? 0;

    const realScoreEl = document.getElementById('d-real-score');
    if (realScoreEl) {
      realScoreEl.innerHTML = `<span class="text-xl font-black text-white">${realHome} x ${realAway}</span>`;
    }

    const elapsed = jogo.fixture.status.elapsed ? ` (${jogo.fixture.status.elapsed}')` : '';
    document.getElementById('d-jogo-data').innerHTML = `<span class="text-red-500 font-bold animate-pulse">● AO VIVO${elapsed}</span>`;
  }

  // Atualiza a visualização principal em segundo plano se ela estiver visível
  const viewJogos = document.getElementById('view-jogos');
  if (viewJogos && !viewJogos.classList.contains('hidden')) {
    if (typeof filtrarPorRodada === 'function') {
      filtrarPorRodada(rodadaSelecionada);
    }
  }
}

async function compartilharRankingWhatsApp() {
  if (!grupoAtual) {
    showToast("Selecione um grupo primeiro!", "error");
    return;
  }

  const ranking = window.ultimoRankingCalculado;
  if (!ranking || ranking.length === 0) {
    showToast("Nenhum ranking carregado para compartilhar!", "error");
    return;
  }

  const seletor = document.getElementById('seletor-ranking');
  const tipoTexto = seletor ? seletor.options[seletor.selectedIndex].text : 'Ranking Geral';

  let msg = `🏆 *${tipoTexto} - Bolão ${grupoAtual.name || grupoAtual.nome || 'Grupo'}* 🏆\n\n`;

  ranking.forEach((user, index) => {
    const posicao = index + 1;
    const primeiroNome = (user.nome || 'Participante').trim().split(/\s+/)[0];
    let prefixo = `${posicao}º`;
    if (posicao === 1) prefixo = '🥇 1º';
    else if (posicao === 2) prefixo = '🥈 2º';
    else if (posicao === 3) prefixo = '🥉 3º';
    const exatos = user.acertosExatos > 0 ? ` (${user.acertosExatos} exato${user.acertosExatos > 1 ? 's' : ''})` : '';
    msg += `${prefixo} ${primeiroNome} - *${user.pontos} pts*${exatos}\n`;
  });

  msg += `\n📲 Código do grupo: *${grupoAtual.invite_code}*`;

  const urlUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(msg);
  // Redireciona para abrir o WhatsApp diretamente (evita bloqueio de popup em PWAs mobile)
  window.location.href = urlUrl;
}

// Pull to Refresh para PWAs (arrastar para baixo e atualizar)
(function() {
  let touchStart = 0;
  let touchMove = 0;
  let pulling = false;
  const threshold = 70;
  const maxPull = 100;
  
  // Elementos do indicador
  const ptr = document.getElementById('pull-to-refresh');
  if (!ptr) return;
  const icon = document.getElementById('ptr-icon');
  const spinner = document.getElementById('ptr-spinner');
  const text = document.getElementById('ptr-text');

  document.addEventListener('touchstart', function(e) {
    // Só ativa quando o scroll está no topo absoluto
    if (window.scrollY === 0) {
      touchStart = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    
    touchMove = e.touches[0].clientY;
    const distance = touchMove - touchStart;
    
    // Puxando para baixo no topo
    if (distance > 0 && window.scrollY === 0) {
      if (e.cancelable) e.preventDefault();
      
      // Aplica resistência física no arrasto
      const pullDist = Math.min(maxPull, distance * 0.4);
      ptr.style.transform = `translateY(${pullDist - 60}px)`;
      
      // Atualiza estado do indicador
      if (pullDist >= threshold) {
        text.textContent = 'Solte para atualizar';
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        text.textContent = 'Puxe para atualizar';
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function() {
    if (!pulling) return;
    pulling = false;
    
    const distance = touchMove - touchStart;
    const pullDist = Math.min(maxPull, distance * 0.4);
    
    if (pullDist >= threshold) {
      // Ativa o estado de carregando e recarrega a página
      ptr.style.transform = 'translateY(15px)';
      if (icon) icon.classList.add('hidden');
      if (spinner) spinner.classList.remove('hidden');
      text.textContent = 'Atualizando...';
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      // Recolhe o indicador
      ptr.style.transform = 'translateY(-100%)';
    }
    
    touchStart = 0;
    touchMove = 0;
  });
})();

// ============ CORREÇÃO DO TECLADO MOBILE (FIXED NAV BARS) ============
(function() {
  if (window.visualViewport) {
    let maxVisualHeight = window.visualViewport.height;
    let lastWidth = window.visualViewport.width;
    
    window.visualViewport.addEventListener('resize', function() {
      const bottomNav = document.getElementById('bottom-nav');
      const gmBottomNav = document.getElementById('gm-bottom-nav');
      
      // Se a largura mudou, foi uma rotação. Atualiza referências e sai.
      if (window.visualViewport.width !== lastWidth) {
        lastWidth = window.visualViewport.width;
        maxVisualHeight = window.visualViewport.height;
        if (bottomNav) bottomNav.style.removeProperty('display');
        if (gmBottomNav) gmBottomNav.style.removeProperty('display');
        return;
      }
      
      if (window.visualViewport.height > maxVisualHeight) {
        maxVisualHeight = window.visualViewport.height;
      }
      
      // Se a altura do viewport visual encolheu mais de 150px em relação ao máximo
      if (window.visualViewport.height < maxVisualHeight - 150) {
        if (bottomNav) bottomNav.style.setProperty('display', 'none', 'important');
        if (gmBottomNav) gmBottomNav.style.setProperty('display', 'none', 'important');
      } else {
        if (bottomNav) bottomNav.style.removeProperty('display');
        if (gmBottomNav) gmBottomNav.style.removeProperty('display');
      }
    });
  }
})();

// ============ CONTROLE DE DESAFIOS DO USUÁRIO ============

let abaDesafiosAtiva = 'ativos';

function alternarAbaDesafios(aba) {
  abaDesafiosAtiva = aba;
  
  const btnAtivos = document.getElementById('btn-tab-desafios-ativos');
  const btnHistorico = document.getElementById('btn-tab-desafios-historico');
  const tabAtivos = document.getElementById('tab-desafios-ativos');
  const tabHistorico = document.getElementById('tab-desafios-historico');

  if (!btnAtivos || !btnHistorico || !tabAtivos || !tabHistorico) return;

  if (aba === 'ativos') {
    btnAtivos.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all text-xs uppercase tracking-wider";
    btnHistorico.className = "flex-1 py-3 text-text-muted hover:text-white transition-all text-xs uppercase tracking-wider font-bold";
    tabAtivos.classList.remove('hidden');
    tabHistorico.classList.add('hidden');
  } else {
    btnHistorico.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all text-xs uppercase tracking-wider";
    btnAtivos.className = "flex-1 py-3 text-text-muted hover:text-white transition-all text-xs uppercase tracking-wider font-bold";
    tabHistorico.classList.remove('hidden');
    tabAtivos.classList.add('hidden');
  }

  carregarDesafiosUsuarioView();
}

async function carregarDesafiosUsuarioView() {
  const listaAtivos = document.getElementById('lista-desafios-ativos-usuario');
  const listaHistorico = document.getElementById('lista-desafios-historico-usuario');

  if (!listaAtivos || !listaHistorico || !sbClient || !grupoAtual || !usuarioAtual) return;

  const isFree = grupoAtual.max_participants <= 3;
  if (isFree) {
    const ehDono = usuarioAtual && (usuarioAtual.id === grupoAtual.owner_id);
    const actionButton = ehDono 
      ? `<button onclick="abrirModalUpgrade()" class="bg-gradient-to-r from-purple-600 to-brand-green hover:opacity-90 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]">⚡ Desbloquear Desafios</button>`
      : `<p class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl">Fale com o dono do grupo para liberar</p>`;

    const htmlLock = `
      <div class="bg-card-bg border border-purple-500/20 rounded-2xl p-6 text-center my-6 flex flex-col items-center shadow-[0_0_30px_rgba(147,51,234,0.05)] w-full">
        <div class="w-14 h-14 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20 mb-4 animate-pulse">
          <svg width="24" height="24" fill="none" stroke="#a855f7" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
        </div>
        <h3 class="text-white font-black text-[16px] uppercase tracking-wide mb-2">Desafios Premium 🪄</h3>
        <p class="text-text-muted text-xs leading-relaxed mb-6 max-w-[280px]">
          Os Desafios do Mago estão bloqueados! Faça o upgrade do seu grupo para liberar palpites relâmpago ao vivo e ganhar pontos extras.
        </p>
        ${actionButton}
      </div>
    `;
    listaAtivos.innerHTML = htmlLock;
    listaHistorico.innerHTML = htmlLock;
    
    const tabController = document.querySelector('#view-desafios .flex.border-b');
    if (tabController) tabController.classList.add('hidden');
    return;
  } else {
    const tabController = document.querySelector('#view-desafios .flex.border-b');
    if (tabController) tabController.classList.remove('hidden');
  }

  if (abaDesafiosAtiva === 'ativos') {
    listaAtivos.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Buscando desafios disponíveis...</p>';
    try {
      const { data: desafios, error } = await sbClient
        .from('desafios')
        .select('*')
        .eq('status', 'active');

      if (error) {
        listaAtivos.innerHTML = `<p class="text-red-400 text-[13px] text-center py-8">Erro: ${error.message}</p>`;
        return;
      }

      const desafiosGrupo = todosOsJogos.length > 0
        ? (desafios || []).filter(d => todosOsJogos.some(j => Number(j.fixture.id) === Number(d.fixture_id)))
        : (desafios || []);

      if (desafiosGrupo.length === 0) {
        listaAtivos.innerHTML = renderEmptyState(
          `<svg class="w-10 h-10 text-brand-green filter drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`, 
          'Calmaria em Campo', 
          'Nenhum desafio ativo no momento. Fique ligado, O Mago pode tirar uma aposta da cartola a qualquer momento!'
        );
        return;
      }

      const desafioIds = desafiosGrupo.map(d => d.id);
      const { data: meusVotos } = await sbClient
        .from('user_desafios')
        .select('desafio_id, chosen_player')
        .in('desafio_id', desafioIds)
        .eq('user_id', usuarioAtual.id)
        .eq('group_id', grupoAtual.id);

      const votosMap = {};
      (meusVotos || []).forEach(v => {
        votosMap[v.desafio_id] = v.chosen_player;
      });

      const fichasAtuais = usuarioAtual?.fichas ?? 3;
      let ativosHtml = `
        <div class="flex items-center justify-between bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5 mb-4">
          <span class="text-[11px] text-zinc-400 font-medium">Seu saldo de fichas</span>
          <span class="badge-fichas text-[13px] font-black text-amber-400">🎫 ${fichasAtuais}</span>
        </div>
      `;

      desafiosGrupo.forEach(d => {
        const jaVotou = !!votosMap[d.id];
        const votoUsuario = votosMap[d.id];
        const labelRegra = (typeof traduzirRegraDesafio === 'function') ? traduzirRegraDesafio(d.event_type) : d.event_type;
        const custo = d.custo_fichas || 0;
        const semFichas = !jaVotou && custo > 0 && fichasAtuais < custo;

        const custoBadge = custo > 0
          ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${semFichas ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'} flex-shrink-0">🎫 ${custo}</span>`
          : '';

        ativosHtml += `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-[14px] text-white truncate">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5">Regra: <strong>${labelRegra}</strong></p>
              </div>
              <div class="flex items-center gap-2 ml-3 flex-shrink-0">
                ${custoBadge}
                <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">+${d.points} pts</span>
              </div>
            </div>

            ${jaVotou ? `
              <div class="mt-3 p-3 bg-purple-650/10 border border-purple-500/20 rounded-xl flex justify-between items-center">
                <span class="text-[11px] text-zinc-300">Seu palpite: <strong class="text-white">${votoUsuario}</strong></span>
                <span class="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">Aguardando</span>
              </div>
            ` : semFichas ? `
              <p class="text-[11px] text-red-400 font-bold mt-3">Fichas insuficientes para participar (você tem ${fichasAtuais} 🎫)</p>
            ` : `
              <div class="flex gap-2 mt-4">
                <button onclick="if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(${d.fixture_id})" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 shadow-lg shadow-purple-650/20">
                  Participar do Desafio
                </button>
              </div>
            `}
          </div>
        `;
      });
      listaAtivos.innerHTML = ativosHtml;

    } catch (e) {
      console.error(e);
      listaAtivos.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar desafios.</p>';
    }
  } else {
    listaHistorico.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Carregando histórico...</p>';
    try {
      const { data: votos, error } = await sbClient
        .from('user_desafios')
        .select(`
          id,
          chosen_player,
          points_awarded,
          desafio_id,
          desafios (
            match_name,
            event_type,
            points,
            status
          )
        `)
        .eq('user_id', usuarioAtual.id)
        .eq('group_id', grupoAtual.id);

      if (error) {
        listaHistorico.innerHTML = `<p class="text-red-400 text-[13px] text-center py-8">Erro: ${error.message}</p>`;
        return;
      }

      const historicoDesafios = (votos || []).filter(v => v.desafios && v.desafios.status === 'resolved');

      if (historicoDesafios.length === 0) {
        listaHistorico.innerHTML = renderEmptyState(
          `<svg class="w-10 h-10 text-zinc-500 filter drop-shadow-[0_0_8px_rgba(113,113,122,0.3)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
          'Sem Registros',
          'Você ainda não participou de nenhum desafio encerrado.'
        );
        return;
      }

      let historicoHtml = '';
      historicoDesafios.forEach(v => {
        const d = v.desafios;
        const acertou = v.points_awarded > 0;
        const perdeu = v.points_awarded < 0;
        
        const labelRegra = (typeof traduzirRegraDesafio === 'function') ? traduzirRegraDesafio(d.event_type) : d.event_type;
        
        let statusBadge = '';
        if (acertou) {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">+${v.points_awarded} PTS</span>`;
        } else if (perdeu) {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">${v.points_awarded} PTS</span>`;
        } else {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">0 PTS</span>`;
        }

        historicoHtml += `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-[14px] text-white truncate">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5">Regra: <strong>${labelRegra}</strong></p>
              </div>
              <div class="ml-3 flex-shrink-0">${statusBadge}</div>
            </div>
            <div class="mt-3 p-3 bg-black/30 border border-white/5 rounded-xl flex justify-between items-center">
              <span class="text-[11px] text-text-muted">Seu voto: <strong class="text-white">${v.chosen_player}</strong></span>
              <span class="text-[11px] font-bold ${acertou ? 'text-green-400' : (perdeu ? 'text-red-400' : 'text-zinc-400')} uppercase">${acertou ? 'Acertou' : (perdeu ? 'Errou' : 'Errou')}</span>
            </div>
          </div>
        `;
      });
      listaHistorico.innerHTML = historicoHtml;

    } catch (e) {
      console.error(e);
      listaHistorico.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar histórico.</p>';
    }
  }
}

function atualizarStatusBannerTV(temJogoAoVivo) {
  try {
    const banner = document.getElementById('btn-ao-vivo-tv');
    if (!banner) return;

    const dotContainer = banner.querySelector('.relative.flex.h-2\\.5.w-2\\.5') || banner.querySelector('.relative');
    const btnSpan = banner.querySelector('span.text-red-400') || banner.querySelector('span.text-zinc-500') || banner.querySelector('#tv-banner-btn');
    
    if (temJogoAoVivo) {
      // Modo ON (Vermelho Vibrante / Ao Vivo)
      banner.className = "bg-gradient-to-r from-red-650/40 via-red-650/5 to-transparent p-5 rounded-2xl border border-red-500/30 mb-6 transition-all hover:border-red-500/50 cursor-pointer flex items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.08)] active:scale-[0.98]";
      if (dotContainer) {
        dotContainer.className = "relative flex h-2.5 w-2.5";
        dotContainer.innerHTML = `
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        `;
      }
      if (btnSpan) {
        btnSpan.className = "text-red-400 text-[10px] font-black uppercase tracking-widest bg-red-500/10 px-2.5 py-1.5 rounded-xl border border-red-500/20 animate-pulse";
        btnSpan.innerText = "Entrar";
      }
    } else {
      // Modo OFF (Desativado / Cinza)
      banner.className = "bg-card-bg p-5 rounded-2xl border border-white/5 mb-6 transition-all hover:border-white/10 cursor-pointer flex items-center justify-between shadow-none active:scale-[0.98]";
      if (dotContainer) {
        dotContainer.className = "relative flex h-2.5 w-2.5";
        dotContainer.innerHTML = `
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-600"></span>
        `;
      }
      if (btnSpan) {
        btnSpan.className = "text-zinc-500 text-[10px] font-black uppercase tracking-widest bg-zinc-800 px-2.5 py-1.5 rounded-xl border border-zinc-700/50";
        btnSpan.innerText = "OFF";
      }
    }
  } catch (err) {
    console.error("Erro interno no atualizarStatusBannerTV:", err);
  }
}

// ============ ONBOARDING (BOAS-VINDAS) ============

function verificarOnboarding() {
  // Verifica se o usuário já viu o tutorial no celular/PC dele
  const jaViu = localStorage.getItem('mago_onboarding_concluido');
  
  if (!jaViu) {
    mostrarModalOnboarding();
  }
}

function mostrarModalOnboarding() {
  // Cria o fundo escuro (Overlay)
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all duration-300';

  // Conteúdo do Modal
  overlay.innerHTML = `
    <div class="bg-card-bg border border-brand-green/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(34,197,94,0.15)] transform transition-all duration-300 scale-100 opacity-100">
      
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center border border-brand-green/20">
          <span class="text-3xl">🧙‍♂️</span>
        </div>
      </div>
      
      <h2 class="text-white font-black text-xl text-center mb-2 uppercase tracking-wide">Bem-vindo ao Bolão do Mago</h2>
      <p class="text-text-muted text-sm text-center mb-6">A revolução dos palpites. Aqui, o jogo não acaba no apito inicial!</p>
      
      <div class="space-y-4 mb-8">
        <div class="flex items-start gap-3">
          <span class="text-brand-green text-lg">⚽</span>
          <p class="text-[13px] text-gray-300"><strong class="text-white">Palpites Fixos:</strong> Deixe seu placar antes do jogo começar.</p>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-brand-green text-lg">📺</span>
          <p class="text-[13px] text-gray-300"><strong class="text-white">Modo TV:</strong> Acompanhe os jogos e a classificação provisória em tempo real.</p>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-purple-400 text-lg">⚡</span>
          <p class="text-[13px] text-gray-300"><strong class="text-purple-400">Desafios do Mago:</strong> Fique de olho na aba Desafios! A qualquer momento, um palpite relâmpago pode surgir para salvar sua pontuação.</p>
        </div>
      </div>
      
      <button onclick="fecharOnboarding()" class="w-full bg-brand-green hover:bg-green-500 text-black font-black py-3 rounded-xl uppercase tracking-wide transition-all active:scale-95">
        Bora pro Jogo!
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
}

function fecharOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.classList.add('opacity-0');
    const child = overlay.firstElementChild;
    if (child) {
      child.classList.remove('scale-100', 'opacity-100');
      child.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
      overlay.remove();
      // Salva no navegador que o cara já viu, para nunca mais aparecer
      localStorage.setItem('mago_onboarding_concluido', 'true'); 
      if (typeof showToast === 'function') {
        showToast("Você está pronto para jogar!", "success");
      }
    }, 300);
  }
}

// ============ LOJA PRO ============

const PRODUTOS_LOJA = {
  // Planos de grupo
  grupo_serie_a:   { tipo:'grupo',  label:'Série A',       icon:'⚡', subLabel:'Até 30 jogadores',            valorFmt:'29,90', limite:30,  successMsg:'Grupo expandido para até 30 jogadores!' },
  grupo_champions: { tipo:'grupo',  label:'Champions',     icon:'🏆', subLabel:'Até 70 jogadores + Desafios', valorFmt:'49,90', limite:70,  successMsg:'Champions ativo! Desafios do Mago liberados.' },
  grupo_god_mode:  { tipo:'grupo',  label:'God Mode',      icon:'👑', subLabel:'Ilimitado + Controle total',  valorFmt:'99,90', limite:999, successMsg:'God Mode ativado! Grupo ilimitado.' },
  // Passes de jogador
  passe_camisa10:  { tipo:'passe',  label:'Camisa 10',     icon:'🎟️', subLabel:'Jogue em até 3 grupos',      valorFmt:'9,90',  limite:3,   successMsg:'Passe Camisa 10 ativo! Você pode entrar em 3 grupos.' },
  passe_lenda:     { tipo:'passe',  label:'Lenda da Copa', icon:'🌟', subLabel:'Grupos ilimitados + Borda Neon',valorFmt:'19,90',limite:999, successMsg:'Você é uma Lenda! Grupos ilimitados desbloqueados.' },
  // Fichas
  fichas_resenha:  { tipo:'fichas', label:'Pacote Resenha',icon:'🪙', subLabel:'15 Fichas para Desafios',    valorFmt:'1,99',  limite:15,  successMsg:'+15 fichas adicionadas ao seu saldo!' },
  fichas_sniper:   { tipo:'fichas', label:'Kit Sniper',    icon:'💎', subLabel:'40 Fichas para Desafios',    valorFmt:'4,90',  limite:40,  successMsg:'+40 fichas adicionadas ao seu saldo!' },
  fichas_bau:      { tipo:'fichas', label:'Baú do Mago',   icon:'🎁', subLabel:'100 Fichas para Desafios',   valorFmt:'9,90',  limite:100, successMsg:'+100 fichas adicionadas ao seu saldo! 🔥' },
  // Apoiador (doação verificada → selo 💛)
  apoio_5:         { tipo:'apoiador', label:'Apoiador 💛',  icon:'💛', subLabel:'Obrigado por ajudar!',       valorFmt:'5,00',  limite:0,   successMsg:'Você agora é Apoiador 💛 Muito obrigado!' },
  apoio_10:        { tipo:'apoiador', label:'Apoiador 💛',  icon:'💛', subLabel:'Você é demais!',             valorFmt:'10,00', limite:0,   successMsg:'Você agora é Apoiador 💛 Muito obrigado!' },
  apoio_20:        { tipo:'apoiador', label:'Apoiador 💛',  icon:'💛', subLabel:'Lenda do app!',              valorFmt:'20,00', limite:0,   successMsg:'Você agora é Apoiador 💛 Muito obrigado!' },
};

async function carregarViewLoja() {
  atualizarDisplayFichas();
  mudarTabLoja('grupos');
  await carregarSelectGruposLoja();
}

async function carregarSelectGruposLoja() {
  const select = document.getElementById('loja-grupo-select');
  if (!select || !sbClient || !usuarioAtual) return;
  select.innerHTML = '<option value="">Carregando seus grupos...</option>';
  try {
    const { data: grupos } = await sbClient
      .from('groups')
      .select('id, name, max_participants')
      .eq('owner_id', usuarioAtual.id)
      .order('created_at', { ascending: false });
    if (!grupos?.length) {
      select.innerHTML = '<option value="">Você não criou nenhum grupo</option>';
      return;
    }
    select.innerHTML = '<option value="">— Selecione um grupo —</option>';
    grupos.forEach(g => {
      const plano = g.max_participants >= 999 ? '👑 God Mode' : g.max_participants >= 70 ? '🏆 Champions' : g.max_participants >= 30 ? '⚡ Série A' : 'Grátis';
      select.innerHTML += `<option value="${g.id}">${g.name} (${plano})</option>`;
    });
  } catch (e) {
    select.innerHTML = '<option value="">Erro ao carregar grupos</option>';
  }
}

function mudarTabLoja(tab) {
  ['grupos','passes','fichas'].forEach(t => {
    const el  = document.getElementById(`loja-tab-${t}`);
    const btn = document.getElementById(`loja-btn-${t}`);
    if (!el || !btn) return;
    if (t === tab) {
      el.classList.remove('hidden');
      btn.classList.add('bg-white/10','text-white');
      btn.classList.remove('text-zinc-500');
    } else {
      el.classList.add('hidden');
      btn.classList.remove('bg-white/10','text-white');
      btn.classList.add('text-zinc-500');
    }
  });
  if (tab === 'fichas') atualizarDisplayFichas();
}

async function gerarPagamentoPix(productId) {
  const produto = PRODUTOS_LOJA[productId];
  if (!produto) { showToast('Produto não encontrado', 'error'); return; }

  let targetId;
  if (produto.tipo === 'grupo') {
    const sel = document.getElementById('loja-grupo-select');
    targetId = sel?.value;
    if (!targetId) { showToast('Selecione um grupo primeiro! ☝️', 'error'); return; }
  } else {
    targetId = usuarioAtual?.id;
    if (!targetId) { showToast('Você precisa estar logado.', 'error'); return; }
  }

  showToast(`Gerando PIX de R$ ${produto.valorFmt}...`, 'success');

  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) { showToast('Sessão expirada. Faça login novamente.', 'error'); return; }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ productId, targetId }),
    });

    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'Erro ao gerar pagamento.', 'error');
      return;
    }

    const fichasAntes = usuarioAtual?.fichas || 0;
    _mostrarOverlayPIX(data, produto, targetId, fichasAntes);
  } catch (err) {
    console.error('gerarPagamentoPix error:', err);
    showToast('Erro de conexão ao gerar pagamento.', 'error');
  }
}

function _mostrarOverlayPIX(pixData, produto, targetId, fichasAntes) {
  if (paymentPollInterval) clearInterval(paymentPollInterval);
  fecharModalPagamento();

  const overlay = document.createElement('div');
  overlay.id = 'payment-overlay';
  overlay.className = 'fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] transition-all duration-300 opacity-0';
  setTimeout(() => overlay.classList.remove('opacity-0'), 50);

  const qrSrc  = `data:image/png;base64,${pixData.qr_code_base64}`;
  const qrCode = pixData.qr_code;

  overlay.innerHTML = `
    <div class="bg-[#121214] border border-purple-500/20 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
      <div class="p-5 text-center border-b border-white/5 relative">
        <button onclick="fecharModalPagamento()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
        <div class="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/30 mx-auto mb-2 text-2xl">${produto.icon}</div>
        <h2 class="text-white font-black text-base uppercase tracking-wide">${produto.label}</h2>
        <p class="text-purple-400 text-[11px] font-bold">${produto.subLabel}</p>
      </div>
      <div class="p-6 flex flex-col items-center">
        <p class="text-gray-300 text-xs text-center mb-4 leading-relaxed">
          Escaneie o QR Code ou copie o código para pagar <strong class="text-white">R$ ${produto.valorFmt}</strong>. Ativação automática após confirmação.
        </p>
        <div class="bg-white p-3 rounded-xl mb-4 border-2 border-purple-500/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] w-44 h-44 flex items-center justify-center">
          <img src="${qrSrc}" alt="QR Code PIX" class="w-full h-full object-contain">
        </div>
        <div class="w-full bg-[#18181b] border border-white/5 rounded-xl p-3 mb-5">
          <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Pix Copia e Cola</label>
          <div class="flex gap-2">
            <input type="text" id="pix-copia-cola" readonly value="${qrCode}" class="bg-transparent border-0 text-white text-xs w-full focus:ring-0 focus:outline-none overflow-hidden text-ellipsis whitespace-nowrap">
            <button onclick="copiarPixCodigo()" id="btn-copy-pix" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wide transition-all active:scale-95 shrink-0">Copiar</button>
          </div>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-gray-400 font-medium">Aguardando confirmação do PIX...</span>
        </div>
        <p class="text-[10px] text-gray-500 text-center">Processado via Mercado Pago · 100% seguro</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => {
    const child = overlay.firstElementChild;
    child?.classList.remove('scale-95', 'opacity-0');
    child?.classList.add('scale-100', 'opacity-100');
  }, 100);

  // Timeout de 10 minutos: se não confirmar, mostra mensagem de suporte
  const pollTimeout = setTimeout(() => {
    if (!paymentPollInterval) return;
    clearInterval(paymentPollInterval);
    paymentPollInterval = null;
    const spinnerEl = overlay.querySelector('.animate-spin')?.parentElement;
    if (spinnerEl) {
      spinnerEl.innerHTML = `<span class="text-xs text-red-400 text-center leading-relaxed">⚠️ Pagamento não confirmado automaticamente.<br><span class="text-zinc-500">Se você pagou, entre em contato via WhatsApp.</span></span>`;
    }
  }, 10 * 60 * 1000);

  // Polling adaptado por tipo de produto
   paymentPollInterval = setInterval(async () => {
    try {
      if (produto.tipo === 'grupo') {
        const { data: grp } = await sbClient.from('groups').select('max_participants').eq('id', targetId).single();
        if (grp && grp.max_participants >= produto.limite) { clearTimeout(pollTimeout); _handlePagamentoConcluido(overlay, produto, targetId, fichasAntes); }
      } else if (produto.tipo === 'passe') {
        const { data: prof } = await sbClient.from('profiles').select('max_grupos').eq('id', targetId).single();
        if (prof && prof.max_grupos >= produto.limite) { clearTimeout(pollTimeout); _handlePagamentoConcluido(overlay, produto, targetId, fichasAntes); }
      } else if (produto.tipo === 'fichas') {
        const { data: prof } = await sbClient.from('profiles').select('fichas_desafio').eq('id', targetId).maybeSingle();
        if (prof && (prof.fichas_desafio || 0) > fichasAntes) { clearTimeout(pollTimeout); _handlePagamentoConcluido(overlay, produto, targetId, fichasAntes); }
      } else if (produto.tipo === 'pote') {
        const { data: part } = await sbClient.from('potes_participantes').select('status_pagamento').eq('id', targetId).single();
        if (part && part.status_pagamento === 'pago') { clearTimeout(pollTimeout); _handlePagamentoConcluido(overlay, produto, targetId, 0); }
      } else if (produto.tipo === 'apoiador') {
        const { data: prof } = await sbClient.from('profiles').select('apoiador').eq('id', targetId).maybeSingle();
        if (prof && prof.apoiador === true) { clearTimeout(pollTimeout); _handlePagamentoConcluido(overlay, produto, targetId, 0); }
      }
    } catch (err) { console.error('Polling error:', err); }
  }, 4000);
}

function _handlePagamentoConcluido(overlay, produto, targetId, fichasAntes) {
  clearInterval(paymentPollInterval);
  paymentPollInterval = null;
  showToast(produto.successMsg, 'success');

  // Atualiza estado local
  if (produto.tipo === 'grupo' && grupoAtual?.id === targetId) {
    grupoAtual.max_participants = produto.limite;
    localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));
  } else if (produto.tipo === 'fichas' && usuarioAtual) {
    usuarioAtual.fichas = fichasAntes + produto.limite;
    atualizarDisplayFichas();
  } else if (produto.tipo === 'pote') {
    if (typeof carregarPoteBanner === 'function') carregarPoteBanner();
  } else if (produto.tipo === 'apoiador') {
    if (usuarioAtual) usuarioAtual.apoiador = true;
    // Busca o novo prazo pra mostrar os dias restantes certinhos
    if (usuarioAtual && sbClient) {
      sbClient.from('profiles').select('apoiador_ate').eq('id', usuarioAtual.id).maybeSingle().then(({ data }) => {
        if (data && usuarioAtual) { usuarioAtual.apoiador_ate = data.apoiador_ate || null; atualizarSeloApoiadorConfig(); }
      });
    }
    if (typeof atualizarSeloApoiadorConfig === 'function') atualizarSeloApoiadorConfig();
  }

  const card = overlay.firstElementChild;
  if (card) {
    card.innerHTML = `
      <div class="p-8 text-center flex flex-col items-center">
        <div class="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4 text-3xl animate-bounce">🎉</div>
        <h2 class="text-white font-black text-lg uppercase tracking-wide mb-2">Compra Confirmada!</h2>
        <p class="text-gray-300 text-xs leading-relaxed mb-6">${produto.successMsg}</p>
        <button onclick="fecharModalPagamento()" class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
          Continuar
        </button>
      </div>
    `;
  }
}

// ============ TELA DE UPGRADE (CHECKOUT) ============

function abrirModalUpgrade() {
  const ehDono = usuarioAtual && grupoAtual && (usuarioAtual.id === grupoAtual.owner_id);
  const overlay = document.createElement('div');
  overlay.id = 'upgrade-overlay';
  overlay.className = 'fixed inset-0 bg-black/90 backdrop-blur-md z-[10000] flex items-center justify-center p-4 transition-all duration-300';

  if (ehDono) {
    overlay.innerHTML = `
      <div class="bg-card-bg border border-purple-500/30 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(147,51,234,0.15)] overflow-hidden transform transition-all duration-300 scale-100 opacity-100">
        
        <!-- Cabeçalho do Modal -->
        <div class="bg-gradient-to-br from-purple-900/40 to-black p-6 text-center border-b border-white/5 relative">
          <button onclick="fecharModalUpgrade()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
          <div class="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center border border-purple-500/50 mx-auto mb-3">
            <span class="text-3xl">👑</span>
          </div>
          <h2 class="text-white font-black text-xl uppercase tracking-widest">Plano Resenha</h2>
          <p class="text-brand-green font-bold mt-1 text-sm">Apenas R$ 9,90 <span class="text-text-muted text-xs font-normal">(Pagamento Único)</span></p>
        </div>
        
        <!-- Benefícios -->
        <div class="p-6">
          <div class="space-y-4 mb-8">
            <div class="flex items-center gap-3">
              <span class="text-brand-green text-lg">✅</span>
              <p class="text-[13px] text-gray-200">Aumenta o limite para <strong class="text-white">20 participantes</strong></p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-purple-400 text-lg">⚡</span>
              <p class="text-[13px] text-gray-200">Libera os <strong class="text-purple-400">Desafios do Mago</strong> ao vivo</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-brand-green text-lg">📺</span>
              <p class="text-[13px] text-gray-200">Acesso total ao <strong class="text-white">Modo TV</strong> e Ranking</p>
            </div>
          </div>
          
          <!-- Botão Mercado Pago -->
          <button onclick="iniciarPagamentoMercadoPago()" class="w-full bg-[#009EE3] hover:bg-[#0080B7] text-white font-black py-3.5 rounded-xl uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2">
            <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="MP" class="w-5 h-5 brightness-0 invert">
            Pagar com Mercado Pago
          </button>
          <p class="text-[10px] text-center text-gray-500 mt-3 flex items-center justify-center gap-1">
            🔒 Pagamento 100% seguro
          </p>
        </div>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div class="bg-card-bg border border-white/5 rounded-2xl w-full max-w-sm shadow-[0_0_30px_rgba(255,255,255,0.02)] overflow-hidden transform transition-all duration-300 scale-100 opacity-100">
        
        <!-- Cabeçalho do Modal -->
        <div class="p-6 text-center border-b border-white/5 relative">
          <button onclick="fecharModalUpgrade()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
          <div class="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center border border-white/5 mx-auto mb-3">
            <span class="text-3xl">📺</span>
          </div>
          <h2 class="text-white font-black text-lg uppercase tracking-wide">Recurso Premium</h2>
          <p class="text-text-muted text-xs mt-1">Modo TV e Desafios são exclusivos para grupos Premium</p>
        </div>
        
        <!-- Mensagem de bloqueio -->
        <div class="p-6 text-center">
          <p class="text-gray-300 text-xs leading-relaxed mb-6">
            Este grupo está no plano gratuito (Várzea). Para liberar o acesso ao Modo TV Ao Vivo, Ranking Completo e Desafios do Mago, peça ao criador do grupo para fazer o upgrade do bolão.
          </p>
          <button onclick="fecharModalUpgrade()" class="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
            Entendido
          </button>
        </div>
      </div>
    `;
  }

  document.body.appendChild(overlay);
}

function fecharModalUpgrade() {
  const overlay = document.getElementById('upgrade-overlay');
  if (overlay) {
    overlay.classList.add('opacity-0');
    const child = overlay.firstElementChild;
    if (child) {
      child.classList.remove('scale-100', 'opacity-100');
      child.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => overlay.remove(), 300);
  }
}

// Função que fará a ponte com o Mercado Pago
// Função que fará a ponte com o Mercado Pago
let paymentPollInterval = null;

function fecharModalPagamento() {
  const overlay = document.getElementById('payment-overlay');
  if (overlay) {
    overlay.classList.add('opacity-0');
    const child = overlay.firstElementChild;
    if (child) {
      child.classList.remove('scale-100', 'opacity-100');
      child.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => overlay.remove(), 300);
  }
  if (paymentPollInterval) {
    clearInterval(paymentPollInterval);
    paymentPollInterval = null;
  }
}

async function iniciarPagamentoMercadoPago() {
  if (!grupoAtual) {
    showToast("Nenhum grupo ativo selecionado.", "error");
    return;
  }
  
  if (typeof showToast === 'function') {
    showToast("Gerando Pix de R$ 9,90...", "success");
  }

  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      showToast("Você precisa estar logado para efetuar o pagamento.", "error");
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ groupId: grupoAtual.id })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Erro MP:", data);
      showToast(data.error || "Erro ao gerar pagamento.", "error");
      return;
    }

    // Fechar o modal de upgrade anterior se estiver aberto
    fecharModalUpgrade();

    // Criar o overlay de checkout PIX
    const overlay = document.createElement('div');
    overlay.id = 'payment-overlay';
    overlay.className = 'fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] transition-all duration-300 opacity-0';
    
    // Animação de entrada
    setTimeout(() => overlay.classList.remove('opacity-0'), 50);

    const qrCodeImageSrc = `data:image/png;base64,${data.qr_code_base64}`;
    const qrCodeCopyPaste = data.qr_code;

    overlay.innerHTML = `
      <div class="bg-[#121214] border border-brand-purple/20 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
        
        <!-- Cabeçalho -->
        <div class="p-5 text-center border-b border-white/5 relative">
          <button onclick="fecharModalPagamento()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
          <div class="w-12 h-12 bg-brand-purple/10 rounded-full flex items-center justify-center border border-brand-purple/30 mx-auto mb-2 text-xl">
            👑
          </div>
          <h2 class="text-white font-black text-base uppercase tracking-wide">Plano Resenha</h2>
          <p class="text-brand-purple text-[11px] font-bold">Upgrade de Bolão — 20 Vagas</p>
        </div>
        
        <!-- Checkout -->
        <div class="p-6 flex flex-col items-center">
          <p class="text-gray-300 text-xs text-center mb-4 leading-relaxed">
            Escaneie o QR Code Pix abaixo ou copie o código "Copia e Cola" para pagar <strong class="text-white">R$ 9,90</strong>. O limite do grupo será atualizado imediatamente após o pagamento.
          </p>

          <!-- QR Code Container -->
          <div class="bg-white p-3 rounded-xl mb-4 border-2 border-brand-purple/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] w-44 h-44 flex items-center justify-center">
            <img src="${qrCodeImageSrc}" alt="QR Code PIX" class="w-full h-full object-contain">
          </div>

          <!-- Pix Copia e Cola -->
          <div class="w-full bg-[#18181b] border border-white/5 rounded-xl p-3 mb-5">
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Código Pix Copia e Cola</label>
            <div class="flex gap-2">
              <input type="text" id="pix-copia-cola" readonly value="${qrCodeCopyPaste}" class="bg-transparent border-0 text-white text-xs w-full focus:ring-0 focus:outline-none overflow-hidden text-ellipsis whitespace-nowrap">
              <button onclick="copiarPixCodigo()" id="btn-copy-pix" class="bg-brand-purple hover:bg-brand-purple/80 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wide transition-all active:scale-95 shrink-0">
                Copiar
              </button>
            </div>
          </div>

          <!-- Aguardando pagamento spinner -->
          <div class="flex items-center gap-2 mb-2">
            <div class="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-gray-400 font-medium">Aguardando confirmação do PIX...</span>
          </div>
          <p class="text-[10px] text-gray-500 text-center">Processado de forma 100% segura via Mercado Pago</p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    // Animação de entrada do card
    setTimeout(() => {
      const child = overlay.firstElementChild;
      if (child) {
        child.classList.remove('scale-95', 'opacity-0');
        child.classList.add('scale-100', 'opacity-100');
      }
    }, 100);

    // Iniciar polling para verificar a confirmação do pagamento
    if (paymentPollInterval) clearInterval(paymentPollInterval);
    
    paymentPollInterval = setInterval(async () => {
      try {
        const { data: grp, error: grpErr } = await sbClient
          .from('groups')
          .select('max_participants')
          .eq('id', grupoAtual.id)
          .single();

        if (grpErr) {
          console.error("Erro ao verificar status do grupo:", grpErr);
          return;
        }

        if (grp && grp.max_participants > 3) {
          // Upgrade detectado!
          clearInterval(paymentPollInterval);
          paymentPollInterval = null;
          
          // Atualizar estado local
          grupoAtual.max_participants = grp.max_participants;
          
          // Atualizar o cache de grupo local
          localStorage.setItem(`grupo_${grupoAtual.id}`, JSON.stringify(grupoAtual));

          // Animação de Sucesso
          showToast("Pagamento Confirmado! Grupo atualizado para Premium 👑", "success");
          
          const card = overlay.firstElementChild;
          if (card) {
            card.innerHTML = `
              <div class="p-8 text-center flex flex-col items-center">
                <div class="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4 text-3xl animate-bounce">
                  🎉
                </div>
                <h2 class="text-white font-black text-lg uppercase tracking-wide mb-2">Upgrade Concluído!</h2>
                <p class="text-gray-300 text-xs leading-relaxed mb-6">
                  Parabéns! O seu grupo agora é <strong class="text-white">Premium</strong> (Plano Resenha) com limite de até <strong class="text-white">20 participantes</strong>. Todos os recursos adicionais foram desbloqueados!
                </p>
                <button onclick="fecharModalPagamento(); recarregarGrupoAposUpgrade();" class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                  Acessar Recursos Premium
                </button>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error("Erro no polling de pagamento:", err);
      }
    }, 4000);

  } catch (error) {
    console.error("Erro iniciarPagamentoMercadoPago:", error);
    showToast("Erro de conexão ao gerar pagamento.", "error");
  }
}

function copiarPixCodigo() {
  const pixInput = document.getElementById('pix-copia-cola');
  if (pixInput) {
    pixInput.select();
    pixInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(pixInput.value);
    
    const btn = document.getElementById('btn-copy-pix');
    if (btn) {
      btn.innerText = 'Copiado!';
      btn.classList.remove('bg-brand-purple');
      btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.innerText = 'Copiar';
        btn.classList.remove('bg-green-600');
        btn.classList.add('bg-brand-purple');
      }, 2000);
    }
    showToast("Código Copia e Cola copiado!", "success");
  }
}

function recarregarGrupoAposUpgrade() {
  // Recarregar a tela atual para remover todas as travas e cadeados
  if (typeof carregarJogos === 'function') {
    carregarJogos();
  }
  if (typeof carregarInformacoesGrupo === 'function') {
    carregarInformacoesGrupo();
  }
  // Se estiver em uma aba específica, re-renderizar
  const activeView = document.querySelector('.view-section:not(.hidden)')?.id;
  if (activeView === 'view-desafios' && typeof carregarDesafiosUsuarioView === 'function') {
    carregarDesafiosUsuarioView();
  } else if (activeView === 'view-ranking' && typeof carregarRanking === 'function') {
    carregarRanking();
  }
}

function abrirModalPasseLivre() {
  fecharModalUpgrade(); // Caso algum outro modal de upgrade esteja aberto
  
  // Garantir que não duplique o modal
  const existing = document.getElementById('passe-livre-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'passe-livre-overlay';
  overlay.className = 'fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] transition-all duration-300 opacity-0';

  // Animação de entrada
  setTimeout(() => overlay.classList.remove('opacity-0'), 50);

  overlay.innerHTML = `
    <div class="bg-[#121214] border border-brand-purple/20 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
      
      <!-- Cabeçalho do Modal -->
      <div class="p-6 text-center border-b border-white/5 relative">
        <button onclick="fecharModalPasseLivre()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
        <div class="w-16 h-16 bg-brand-purple/10 rounded-full flex items-center justify-center border border-brand-purple/30 mx-auto mb-3 text-3xl">
          🎟️
        </div>
        <h2 class="text-white font-black text-lg uppercase tracking-wide">Passe Livre do Mago</h2>
        <p class="text-brand-purple text-xs font-bold mt-1">Ligas & Grupos Ilimitados</p>
      </div>
      
      <!-- Mensagem explicativa -->
      <div class="p-6 text-center">
        <p class="text-gray-300 text-xs leading-relaxed mb-6">
          Você já está participando de um bolão! Para participar de ligas ilimitadas e desafiar outras galeras, adquira o <strong class="text-white">Passe Livre do Mago</strong> por apenas <strong class="text-white">R$ 4,90</strong> no Pix.
        </p>

        <!-- Recursos inclusos -->
        <div class="bg-[#18181b] rounded-xl p-4 mb-6 border border-white/5 text-left flex flex-col gap-2.5">
          <div class="flex items-center gap-3">
            <span class="text-brand-green text-sm">✓</span>
            <p class="text-xs text-gray-200">Participação em <strong class="text-white">Grupos Ilimitados</strong></p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-brand-green text-sm">✓</span>
            <p class="text-xs text-gray-200">Acesso completo a todos os seus bolões</p>
          </div>
        </div>
        
        <!-- Botão Mercado Pago -->
        <button onclick="iniciarPagamentoPasseLivre()" class="w-full bg-[#009EE3] hover:bg-[#0080B7] text-white font-black py-3.5 rounded-xl uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 text-xs">
          <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="MP" class="w-4 h-4 brightness-0 invert">
          Adquirir por R$ 4,90
        </button>
        <p class="text-[10px] text-center text-gray-500 mt-3">
          🔒 Pagamento 100% seguro via Mercado Pago
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    const child = overlay.firstElementChild;
    if (child) {
      child.classList.remove('scale-95', 'opacity-0');
      child.classList.add('scale-100', 'opacity-100');
    }
  }, 100);
}

function fecharModalPasseLivre() {
  const overlay = document.getElementById('passe-livre-overlay');
  if (overlay) {
    overlay.classList.add('opacity-0');
    const child = overlay.firstElementChild;
    if (child) {
      child.classList.remove('scale-100', 'opacity-100');
      child.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => overlay.remove(), 300);
  }
}

async function iniciarPagamentoPasseLivre() {
  if (typeof showToast === 'function') {
    showToast("Gerando Pix de R$ 4,90...", "success");
  }

  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      showToast("Você precisa estar logado para efetuar o pagamento.", "error");
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ paymentType: 'usuario', targetId: session.user.id })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Erro MP Passe Livre:", data);
      showToast(data.error || "Erro ao gerar pagamento.", "error");
      return;
    }

    // Fechar o modal de Passe Livre
    fecharModalPasseLivre();

    // Criar o overlay de checkout PIX
    const overlay = document.createElement('div');
    overlay.id = 'payment-overlay';
    overlay.className = 'fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] transition-all duration-300 opacity-0';
    
    // Animação de entrada
    setTimeout(() => overlay.classList.remove('opacity-0'), 50);

    const qrCodeImageSrc = `data:image/png;base64,${data.qr_code_base64}`;
    const qrCodeCopyPaste = data.qr_code;

    overlay.innerHTML = `
      <div class="bg-[#121214] border border-brand-purple/20 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
        
        <!-- Cabeçalho -->
        <div class="p-5 text-center border-b border-white/5 relative">
          <button onclick="fecharModalPagamento()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✖</button>
          <div class="w-12 h-12 bg-brand-purple/10 rounded-full flex items-center justify-center border border-brand-purple/30 mx-auto mb-2 text-xl">
            🎟️
          </div>
          <h2 class="text-white font-black text-base uppercase tracking-wide">Passe Livre</h2>
          <p class="text-brand-purple text-[11px] font-bold">Upgrade de Usuário — Ligas Ilimitadas</p>
        </div>
        
        <!-- Checkout -->
        <div class="p-6 flex flex-col items-center">
          <p class="text-gray-300 text-xs text-center mb-4 leading-relaxed">
            Escaneie o QR Code Pix abaixo ou copie o código "Copia e Cola" para pagar <strong class="text-white">R$ 4,90</strong>. Sua conta será liberada para grupos ilimitados imediatamente após o pagamento.
          </p>

          <!-- QR Code Container -->
          <div class="bg-white p-3 rounded-xl mb-4 border-2 border-brand-purple/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] w-44 h-44 flex items-center justify-center">
            <img src="${qrCodeImageSrc}" alt="QR Code PIX" class="w-full h-full object-contain">
          </div>

          <!-- Pix Copia e Cola -->
          <div class="w-full bg-[#18181b] border border-white/5 rounded-xl p-3 mb-5">
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Código Pix Copia e Cola</label>
            <div class="flex gap-2">
              <input type="text" id="pix-copia-cola" readonly value="${qrCodeCopyPaste}" class="bg-transparent border-0 text-white text-xs w-full focus:ring-0 focus:outline-none overflow-hidden text-ellipsis whitespace-nowrap">
              <button onclick="copiarPixCodigo()" id="btn-copy-pix" class="bg-brand-purple hover:bg-brand-purple/80 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wide transition-all active:scale-95 shrink-0">
                Copiar
              </button>
            </div>
          </div>

          <!-- Aguardando pagamento spinner -->
          <div class="flex items-center gap-2 mb-2">
            <div class="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-gray-400 font-medium">Aguardando confirmação do PIX...</span>
          </div>
          <p class="text-[10px] text-gray-500 text-center">Processado de forma 100% segura via Mercado Pago</p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    // Animação de entrada do card
    setTimeout(() => {
      const child = overlay.firstElementChild;
      if (child) {
        child.classList.remove('scale-95', 'opacity-0');
        child.classList.add('scale-100', 'opacity-100');
      }
    }, 100);

    // Iniciar polling para verificar a confirmação do pagamento
    if (paymentPollInterval) clearInterval(paymentPollInterval);
    
    paymentPollInterval = setInterval(async () => {
      try {
        const { data: profile, error: profErr } = await sbClient
          .from('profiles')
          .select('max_grupos')
          .eq('id', session.user.id)
          .single();

        if (profErr) {
          console.error("Erro ao verificar status do perfil:", profErr);
          return;
        }

        if (profile && profile.max_grupos > 1) {
          // Upgrade do jogador detectado!
          clearInterval(paymentPollInterval);
          paymentPollInterval = null;
          
          if (usuarioAtual) {
            usuarioAtual.max_grupos = profile.max_grupos;
          }

          // Animação de Sucesso
          showToast("Passe Livre Ativado! Ligas ilimitadas liberadas 🎟️", "success");
          
          const card = overlay.firstElementChild;
          if (card) {
            card.innerHTML = `
              <div class="p-8 text-center flex flex-col items-center">
                <div class="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4 text-3xl animate-bounce">
                  🎉
                </div>
                <h2 class="text-white font-black text-lg uppercase tracking-wide mb-2">Passe Livre Ativo!</h2>
                <p class="text-gray-300 text-xs leading-relaxed mb-6">
                  Parabéns! Sua conta agora possui o <strong class="text-white">Passe Livre do Mago</strong>. Você pode entrar em quantos bolões quiser sem limites!
                </p>
                <button onclick="fecharModalPagamento();" class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                  Começar a Jogar
                </button>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error("Erro no polling do Passe Livre:", err);
      }
    }, 4000);

  } catch (error) {
    console.error("Erro iniciarPagamentoPasseLivre:", error);
    showToast("Erro de conexão ao gerar pagamento.", "error");
  }
}

function toggleMenuRegras() {
  const menu = document.getElementById('menu-regras-custom');
  const seta = document.getElementById('seta-menu-regras');
  if (menu && seta) {
    if (menu.classList.contains('hidden')) {
      menu.classList.remove('hidden');
      seta.style.transform = 'rotate(180deg)';
      seta.innerText = '▲';
    } else {
      menu.classList.add('hidden');
      seta.style.transform = 'rotate(0deg)';
      seta.innerText = '▼';
    }
  }
}

function toggleAjustesRegras() {
  const container = document.getElementById('container-ajustes-regras');
  const seta = document.getElementById('seta-ajustes-regras');
  if (container && seta) {
    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      seta.innerText = '▼';
    } else {
      container.classList.add('hidden');
      seta.innerText = '›';
    }
  }
}

function toggleAjustesMembros() {
  const container = document.getElementById('container-ajustes-membros');
  const seta = document.getElementById('seta-ajustes-membros');
  if (container && seta) {
    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      seta.innerText = '▼';
    } else {
      container.classList.add('hidden');
      seta.innerText = '›';
    }
  }
}

function toggleAjustesGerais() {
  const container = document.getElementById('container-ajustes-gerais');
  const seta = document.getElementById('seta-ajustes-gerais');
  if (container && seta) {
    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      seta.innerText = '▼';
      
      const chkDesafios = document.getElementById('chk-desafios-enabled');
      if (chkDesafios && typeof grupoAtual !== 'undefined' && grupoAtual) {
        chkDesafios.checked = (grupoAtual.desafios_enabled !== false);
      }
    } else {
      container.classList.add('hidden');
      seta.innerText = '›';
    }
  }
}

async function alterarStatusDesafios() {
  if (typeof grupoAtual === 'undefined' || !grupoAtual || !sbClient) return;
  const chk = document.getElementById('chk-desafios-enabled');
  if (!chk) return;
  
  const isEnabled = chk.checked;
  try {
    const { error } = await sbClient
      .from('groups')
      .update({ desafios_enabled: isEnabled })
      .eq('id', grupoAtual.id);
      
    if (error) throw error;
    
    grupoAtual.desafios_enabled = isEnabled;
    localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));
    
    const navBtn = document.getElementById('nav-view-desafios');
    if (navBtn) {
      if (isEnabled) navBtn.classList.remove('hidden');
      else navBtn.classList.add('hidden');
    }
    const bannerDesafios = document.getElementById('banner-desafios-home');
    if (bannerDesafios) {
      if (isEnabled) bannerDesafios.classList.remove('hidden');
      else bannerDesafios.classList.add('hidden');
    }
    
    if (typeof showToast === 'function') {
      showToast(`Desafios do Mago ${isEnabled ? 'ativados' : 'desativados'} para o grupo!`, "success");
    }
  } catch (err) {
    console.error("Erro ao alterar status de desafios:", err);
    chk.checked = !isEnabled; // Reverte visualmente
    if (typeof showToast === 'function') {
      showToast("Erro ao alterar o status. Verifique sua conexão.", "error");
    }
  }
}

function toggleInputRegra(inputId, checkbox) {
  const input = document.getElementById(inputId);
  if (input) {
    input.disabled = !checkbox.checked;
    if (input.disabled) {
      input.classList.add('opacity-30', 'cursor-not-allowed');
    } else {
      input.classList.remove('opacity-30', 'cursor-not-allowed');
    }
  }
}

function detalharPontosPalpite(palpiteHome, palpiteAway, realHome, realAway) {
  const pHome = parseInt(palpiteHome);
  const pAway = parseInt(palpiteAway);
  const rHome = parseInt(realHome);
  const rAway = parseInt(realAway);

  if (isNaN(pHome) || isNaN(pAway) || isNaN(rHome) || isNaN(rAway)) {
    return { pts: 0, desc: 'Sem palpite' };
  }

  const regras = {
    pt_placar_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_placar_exato !== undefined && grupoAtual.pt_placar_exato !== null) ? Number(grupoAtual.pt_placar_exato) : 12,
    pt_vencedor_gols_time: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_gols_time !== undefined && grupoAtual.pt_vencedor_gols_time !== null) ? Number(grupoAtual.pt_vencedor_gols_time) : 0,
    pt_empate_nao_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_empate_nao_exato !== undefined && grupoAtual.pt_empate_nao_exato !== null) ? Number(grupoAtual.pt_empate_nao_exato) : 6,
    pt_vencedor_saldo: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_saldo !== undefined && grupoAtual.pt_vencedor_saldo !== null) ? Number(grupoAtual.pt_vencedor_saldo) : 7,
    pt_vencedor_gols_perdedor: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_gols_perdedor !== undefined && grupoAtual.pt_vencedor_gols_perdedor !== null) ? Number(grupoAtual.pt_vencedor_gols_perdedor) : 0,
    pt_apenas_vencedor: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_apenas_vencedor !== undefined && grupoAtual.pt_apenas_vencedor !== null) ? Number(grupoAtual.pt_apenas_vencedor) : 3,
    pt_gols_um_time: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_gols_um_time !== undefined && grupoAtual.pt_gols_um_time !== null) ? Number(grupoAtual.pt_gols_um_time) : 0
  };

  // 1. Placar Exato
  if (pHome === rHome && pAway === rAway && regras.pt_placar_exato > 0) {
    return { pts: regras.pt_placar_exato, desc: 'Placar Exato' };
  }

  const vencedorPalpite = pHome > pAway ? 'home' : (pHome < pAway ? 'away' : 'empate');
  const vencedorReal = rHome > rAway ? 'home' : (rHome < rAway ? 'away' : 'empate');
  const acertouVencedor = vencedorPalpite === vencedorReal;

  if (acertouVencedor) {
    // 2. Empate Não-Exato
    if (vencedorReal === 'empate' && regras.pt_empate_nao_exato > 0) {
      return { pts: regras.pt_empate_nao_exato, desc: 'Empate Não-Exato' };
    }

    const saldoPalpite = Math.abs(pHome - pAway);
    const saldoReal = Math.abs(rHome - rAway);

    const acertouGolsHome = pHome === rHome;
    const acertouGolsAway = pAway === rAway;
    
    let acertouGolsDoVencedor = false;
    let acertouGolsDoPerdedor = false;
    
    if (vencedorReal === 'home') {
      acertouGolsDoVencedor = acertouGolsHome;
      acertouGolsDoPerdedor = acertouGolsAway;
    } else if (vencedorReal === 'away') {
      acertouGolsDoVencedor = acertouGolsAway;
      acertouGolsDoPerdedor = acertouGolsHome;
    }

    // 3. Vencedor e Gols de um Time (Gols do Vencedor)
    if (acertouGolsDoVencedor && regras.pt_vencedor_gols_time > 0) {
      return { pts: regras.pt_vencedor_gols_time, desc: 'Vencedor + Gols Time' };
    }

    // 4. Vencedor e Saldo
    if (saldoPalpite === saldoReal && regras.pt_vencedor_saldo > 0) {
      return { pts: regras.pt_vencedor_saldo, desc: 'Vencedor + Saldo' };
    }

    // 5. Vencedor e Gols do Perdedor
    if (acertouGolsDoPerdedor && regras.pt_vencedor_gols_perdedor > 0) {
      return { pts: regras.pt_vencedor_gols_perdedor, desc: 'Vencedor + Gols Perdedor' };
    }

    // 6. Apenas o Vencedor
    if (regras.pt_apenas_vencedor > 0) {
      return { pts: regras.pt_apenas_vencedor, desc: 'Apenas Vencedor' };
    }
  } else {
    // 7. Gols de um Time
    const acertouGolsHome = pHome === rHome;
    const acertouGolsAway = pAway === rAway;
    if ((acertouGolsHome || acertouGolsAway) && regras.pt_gols_um_time > 0) {
      return { pts: regras.pt_gols_um_time, desc: 'Placar de um Time' };
    }
  }

  return { pts: 0, desc: 'Zerou' };
}

async function abrirHistoricoUsuario(userId, userName, userFoto) {
  const modal = document.getElementById('modal-historico');
  const fotoEl = document.getElementById('hist-usuario-foto');
  const nomeEl = document.getElementById('hist-usuario-nome');
  const resumoEl = document.getElementById('hist-usuario-resumo');
  const listaEl = document.getElementById('hist-usuario-lista');

  if (!modal || !listaEl) return;

  // Carrega detalhes no header
  if (fotoEl) fotoEl.src = userFoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=random&color=fff';
  if (nomeEl) nomeEl.innerText = userName;
  if (resumoEl) resumoEl.innerText = "Calculando resumo de pontos...";
  listaEl.innerHTML = `
    <div class="flex flex-col items-center justify-center py-10 space-y-2">
      <svg class="animate-spin h-6 w-6 text-brand-green" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span class="text-xs text-text-muted">Calculando estatísticas no banco...</span>
    </div>
  `;

  // Exibe modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  try {
    // 1. Busca todos os palpites do usuário
    const { data: guesses, error: errG } = await sbClient
      .from('guesses')
      .select('*')
      .eq('group_id', grupoAtual.id)
      .eq('user_id', userId);

    if (errG) throw errG;

    // 2. Busca desafios (pontos extras do GM)
    const { data: desafios, error: errD } = await sbClient
      .from('user_desafios')
      .select('points_awarded, created_at, challenges:challenge_id(title)')
      .eq('group_id', grupoAtual.id)
      .eq('user_id', userId);

    // Configuração de regras do grupo
    const regras = {
      pt_placar_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_placar_exato !== undefined && grupoAtual.pt_placar_exato !== null) ? Number(grupoAtual.pt_placar_exato) : 12,
      pt_vencedor_gols_time: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_gols_time !== undefined && grupoAtual.pt_vencedor_gols_time !== null) ? Number(grupoAtual.pt_vencedor_gols_time) : 0,
      pt_empate_nao_exato: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_empate_nao_exato !== undefined && grupoAtual.pt_empate_nao_exato !== null) ? Number(grupoAtual.pt_empate_nao_exato) : 6,
      pt_vencedor_saldo: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_saldo !== undefined && grupoAtual.pt_vencedor_saldo !== null) ? Number(grupoAtual.pt_vencedor_saldo) : 7,
      pt_vencedor_gols_perdedor: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_vencedor_gols_perdedor !== undefined && grupoAtual.pt_vencedor_gols_perdedor !== null) ? Number(grupoAtual.pt_vencedor_gols_perdedor) : 0,
      pt_apenas_vencedor: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_apenas_vencedor !== undefined && grupoAtual.pt_apenas_vencedor !== null) ? Number(grupoAtual.pt_apenas_vencedor) : 3,
      pt_gols_um_time: (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.pt_gols_um_time !== undefined && grupoAtual.pt_gols_um_time !== null) ? Number(grupoAtual.pt_gols_um_time) : 0
    };

    // Objeto para consolidar a contagem por regras
    // totalPts = soma dos pontos REAIS (já com zebra/mata-mata); zebra = nº de acertos multiplicados
    const counts = {
      placar_exato: { name: "Placar Exato 🎯", ptsEach: regras.pt_placar_exato, count: 0, totalPts: 0, zebra: 0 },
      vencedor_gols_time: { name: "Vencedor e Gols de um Time ⚽", ptsEach: regras.pt_vencedor_gols_time, count: 0, totalPts: 0, zebra: 0 },
      empate_nao_exato: { name: "Empate Não-Exato 🤝", ptsEach: regras.pt_empate_nao_exato, count: 0, totalPts: 0, zebra: 0 },
      vencedor_saldo: { name: "Vencedor e Saldo de Gols 📊", ptsEach: regras.pt_vencedor_saldo, count: 0, totalPts: 0, zebra: 0 },
      vencedor_gols_perdedor: { name: "Vencedor e Gols do Perdedor 📉", ptsEach: regras.pt_vencedor_gols_perdedor, count: 0, totalPts: 0, zebra: 0 },
      apenas_vencedor: { name: "Apenas o Vencedor 👑", ptsEach: regras.pt_apenas_vencedor, count: 0, totalPts: 0, zebra: 0 },
      gols_um_time: { name: "Placar de Algum Time ⚽", ptsEach: regras.pt_gols_um_time, count: 0, totalPts: 0, zebra: 0 },
      desafios: { name: "Desafios do GM (Bônus) ⚡", ptsEach: null, count: 0, totalPts: 0, zebra: 0 }
    };

    // Mapa de categoria (desc do detalharPontosPalpite -> chave do counts)
    const mapaCategoria = {
      'Placar Exato': 'placar_exato',
      'Vencedor + Gols Time': 'vencedor_gols_time',
      'Empate Não-Exato': 'empate_nao_exato',
      'Vencedor + Saldo': 'vencedor_saldo',
      'Vencedor + Gols Perdedor': 'vencedor_gols_perdedor',
      'Apenas Vencedor': 'apenas_vencedor',
      'Placar de um Time': 'gols_um_time'
    };

    // Processa palpites dos jogos encerrados
    if (guesses) {
      guesses.forEach(g => {
        const match = todosOsJogos.find(j => j.fixture.id === g.match_id);
        if (!match) return;

        const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);
        if (isFinished && match.goals.home !== null && match.goals.away !== null) {
          const ptDetails = detalharPontosPalpite(g.score_home, g.score_away, match.goals.home, match.goals.away);
          if (ptDetails.pts > 0) {
            const chave = mapaCategoria[ptDetails.desc];
            if (chave && counts[chave]) {
              // Pontos REAIS: mesmo motor do ranking oficial (aplica zebra dinâmica + mata-mata)
              const vencedorReal = match.goals.home > match.goals.away ? 'home' : (match.goals.home < match.goals.away ? 'away' : 'empate');
              const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined' && distribuicaoPalpitesGrupo) ? distribuicaoPalpitesGrupo[g.match_id] : null;
              const pctVencedor = dist ? dist[vencedorReal] : 100;
              const ptsReais = calcularPontosPalpite(g.score_home, g.score_away, match.goals.home, match.goals.away, match.league.round, pctVencedor);

              counts[chave].count++;
              counts[chave].totalPts += ptsReais;
              // Foi multiplicado (zebra ou mata-mata) se rendeu mais que o valor-base da categoria
              if (ptsReais > ptDetails.pts) counts[chave].zebra++;
            }
          }
        }
      });
    }

    // Processa pontos extras de desafios
    if (desafios) {
      desafios.forEach(d => {
        counts.desafios.count++;
        counts.desafios.totalPts += d.points_awarded || 0;
      });
    }

    // Gera o HTML das linhas do resumo
    listaEl.innerHTML = '';
    let html = '';
    let totalPontos = 0;
    let placaresExatos = counts.placar_exato.count;

    const renderRow = (name, ptsEach, countVal, totalVal, isPurple = false, zebraVal = 0) => {
      const total = totalVal !== undefined ? totalVal : (ptsEach * countVal);
      let sub = ptsEach !== null ? `${ptsEach} pts por acerto` : 'Pontos de desafios extras';
      if (zebraVal > 0) sub += ` · 🦓 ${zebraVal} zebra${zebraVal > 1 ? 's' : ''} (x2)`;
      const borderTheme = isPurple ? 'border-purple-500/20 bg-purple-950/10' : (zebraVal > 0 ? 'border-purple-500/30 bg-purple-950/10' : 'border-zinc-800/80 bg-zinc-900/30');
      const ptsTheme = isPurple ? 'text-purple-400 bg-purple-500/10' : (zebraVal > 0 ? 'text-purple-300 bg-purple-500/15' : 'text-brand-green bg-brand-green/10');

      return `
        <div class="border p-4 rounded-xl flex items-center justify-between ${borderTheme} transition-colors">
          <div>
            <h4 class="text-[12.5px] font-black text-white leading-tight">${name}</h4>
            <p class="text-[10px] text-text-muted mt-1.5 font-medium">${sub}</p>
          </div>
          <div class="text-right flex flex-col items-end flex-shrink-0">
            <span class="text-[12px] text-zinc-300 font-bold">${countVal}x acertos</span>
            <span class="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg mt-1.5 ${ptsTheme}">+${total} pts</span>
          </div>
        </div>
      `;
    };

    Object.keys(counts).forEach(k => {
      const cat = counts[k];
      if (k === 'desafios') {
        if (cat.count > 0) {
          html += renderRow(cat.name, null, cat.count, cat.totalPts, true);
          totalPontos += cat.totalPts;
        }
      } else {
        if (cat.ptsEach > 0 || cat.count > 0) {
          html += renderRow(cat.name, cat.ptsEach, cat.count, cat.totalPts, false, cat.zebra);
          totalPontos += cat.totalPts;
        }
      }
    });

    listaEl.innerHTML = html || '<p class="text-text-muted text-[12.5px] text-center py-8">Nenhum palpite computado ou ponto extra recebido ainda.</p>';

    if (resumoEl) {
      resumoEl.innerText = `${totalPontos} pts • ${placaresExatos} placares exatos`;
    }

    // ====== Respostas das Perguntas Bônus (reveladas só DEPOIS do prazo) ======
    try {
      const { data: bConfig } = await sbClient
        .from('bonus_config')
        .select('*')
        .eq('group_id', grupoAtual.id)
        .single();

      const algumaAtiva = bConfig && (bConfig.q1_ativa || bConfig.q2_ativa || bConfig.q3_ativa || bConfig.q4_ativa || bConfig.q5_ativa);

      if (algumaAtiva) {
        const prazoData = bConfig.prazo ? new Date(bConfig.prazo) : null;
        const prazoExpirado = prazoData ? (new Date() > prazoData) : false;
        const prazoTxt = prazoData ? `${prazoData.toLocaleDateString('pt-BR')} às ${prazoData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';

        const perguntasBonus = [
          { key: 'q1', n: 1, label: 'Gols do campeão no campeonato', ativa: bConfig.q1_ativa },
          { key: 'q2', n: 2, label: 'Último colocado (rebaixado)', ativa: bConfig.q2_ativa },
          { key: 'q3', n: 3, label: 'Terceiro colocado', ativa: bConfig.q3_ativa },
          { key: 'q4', n: 4, label: 'Vice-campeão', ativa: bConfig.q4_ativa },
          { key: 'q5', n: 5, label: 'Campeão', ativa: bConfig.q5_ativa }
        ].filter(p => p.ativa);

        let bonusHtml = `
          <div class="pt-2">
            <div class="flex items-center gap-2 mb-2 px-1">
              <span class="text-[13px]">⭐</span>
              <h4 class="text-[12px] font-black uppercase tracking-wider text-zinc-300">Respostas Bônus</h4>
            </div>`;

        if (!prazoExpirado) {
          // Antes do prazo: respostas ficam ocultas pra ninguém copiar
          bonusHtml += `
            <div class="border border-zinc-800/80 bg-zinc-900/30 rounded-xl p-4 text-center">
              <p class="text-[11.5px] text-text-muted leading-relaxed">🔒 As respostas ficam ocultas até o prazo encerrar${prazoTxt ? `<br><span class="text-zinc-300 font-bold">${prazoTxt}</span>` : ''}.<br>Depois disso ninguém muda e todo mundo pode ver.</p>
            </div>`;
        } else {
          // Depois do prazo: revela as respostas do jogador (já travadas)
          const { data: resp } = await sbClient
            .from('bonus_respostas')
            .select('*')
            .eq('group_id', grupoAtual.id)
            .eq('user_id', userId)
            .single();

          if (!resp) {
            bonusHtml += `
              <div class="border border-zinc-800/80 bg-zinc-900/30 rounded-xl p-4 text-center">
                <p class="text-[12px] text-text-muted">Esse jogador não respondeu as perguntas bônus.</p>
              </div>`;
          } else {
            perguntasBonus.forEach(p => {
              const valor = resp[p.key + '_resposta'];
              const respTxt = (valor !== null && valor !== undefined && valor !== '') ? valor : '—';
              const semResp = respTxt === '—';
              bonusHtml += `
                <div class="border border-zinc-800/80 bg-zinc-900/30 rounded-xl p-3.5 flex items-center justify-between gap-3 mb-2">
                  <p class="text-[11px] text-text-muted font-medium leading-tight min-w-0"><span class="text-brand-green font-bold">${p.n}.</span> ${p.label}</p>
                  <span class="text-[12px] font-black ${semResp ? 'text-zinc-600' : 'text-white'} text-right flex-shrink-0">${respTxt}</span>
                </div>`;
            });
          }
        }

        bonusHtml += `</div>`;
        listaEl.innerHTML += bonusHtml;
      }
    } catch (eBonus) {
      console.error("Erro ao carregar respostas bônus do jogador:", eBonus);
    }

  } catch (err) {
    console.error("Erro ao carregar resumo de pontos do jogador:", err);
    listaEl.innerHTML = '<p class="text-red-400 text-[12px] text-center py-8">Erro ao calcular resumo do jogador.</p>';
    if (resumoEl) resumoEl.innerText = "Erro ao buscar resumo";
  }
}

function toggleMenuParticipantes() {
  const menu = document.getElementById('menu-participantes-custom');
  const seta = document.getElementById('seta-menu-participantes');
  if (menu && seta) {
    if (menu.classList.contains('hidden')) {
      menu.classList.remove('hidden');
      seta.style.transform = 'rotate(180deg)';
      seta.innerText = '▲';
    } else {
      menu.classList.add('hidden');
      seta.style.transform = 'rotate(0deg)';
      seta.innerText = '▼';
    }
  }
}

// ==================== CONTROLE DAS NOVAS ABAS ====================

async function abrirPerguntasBonus() {
  if (!grupoAtual || !sbClient) return;
  const modal = document.getElementById('modal-perguntas-bonus');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Mostra loading nos estados temporariamente
    document.getElementById('label-prazo').innerText = "Carregando...";
    const chk1 = document.querySelector('input[name="q1"]');
    const chk2 = document.querySelector('input[name="q2"]');
    const chk3 = document.querySelector('input[name="q3"]');
    const chk4 = document.querySelector('input[name="q4"]');
    const chk5 = document.querySelector('input[name="q5"]');
    if (chk1) chk1.checked = false;
    if (chk2) chk2.checked = false;
    if (chk3) chk3.checked = false;
    if (chk4) chk4.checked = false;
    if (chk5) chk5.checked = false;
    
    try {
      const { data: config } = await sbClient
        .from('bonus_config')
        .select('*')
        .eq('group_id', grupoAtual.id)
        .single();
        
      if (config) {
        if (chk1) chk1.checked = !!config.q1_ativa;
        if (chk2) chk2.checked = !!config.q2_ativa;
        if (chk3) chk3.checked = !!config.q3_ativa;
        if (chk4) chk4.checked = !!config.q4_ativa;
        if (chk5) chk5.checked = !!config.q5_ativa;
        
        if (config.prazo) {
          const dateLocal = new Date(config.prazo);
          const offset = dateLocal.getTimezoneOffset();
          const adjustedDate = new Date(dateLocal.getTime() - (offset * 60 * 1000));
          const formatted = adjustedDate.toISOString().slice(0, 16);
          
          document.getElementById('prazo-bonus-input').value = formatted;
          
          const label = document.getElementById('label-prazo');
          if (label) {
            label.innerText = dateLocal.toLocaleDateString('pt-BR') + ' às ' + dateLocal.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            label.classList.remove('text-gray-400');
            label.classList.add('text-brand-green');
          }
        } else {
          document.getElementById('label-prazo').innerText = "Definir prazo";
        }
      } else {
        document.getElementById('label-prazo').innerText = "Definir prazo";
      }
    } catch (e) {
      console.error("Erro ao obter configurações bônus:", e);
      document.getElementById('label-prazo').innerText = "Definir prazo";
    }
    
    atualizarContadorBonus();
  }
}

function fecharPerguntasBonus() {
  const modal = document.getElementById('modal-perguntas-bonus');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function abrirHistoricoPontos() {
  const modal = document.getElementById('modal-historico-pontos');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function fecharHistoricoPontos() {
  const modal = document.getElementById('modal-historico-pontos');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==================== LÓGICA DAS PERGUNTAS BÔNUS ====================

const PONTOS_POR_PERGUNTA = 10; 

function atualizarContadorBonus() {
  const checkboxes = document.querySelectorAll('.chk-pergunta-bonus');
  let qtdAtivas = 0;

  checkboxes.forEach(chk => {
    const card = chk.closest('.card-pergunta');
    if (card) {
      if (chk.checked) {
        qtdAtivas++;
        card.classList.remove('border-white/5');
        card.classList.add('border-brand-green', 'bg-brand-green/5');
      } else {
        card.classList.add('border-white/5');
        card.classList.remove('border-brand-green', 'bg-brand-green/5');
      }
    }
  });

  const totalPontos = qtdAtivas * PONTOS_POR_PERGUNTA;

  document.getElementById('contador-ativas-topo').innerText = `${qtdAtivas}/5 ATIVAS`;
  document.getElementById('contador-pontos-topo').innerText = `+${totalPontos} pts totais possíveis`;
  
  document.getElementById('contador-ativas-rodape').innerText = qtdAtivas;
  document.getElementById('contador-pontos-rodape').innerText = `+${totalPontos} pts`;
}

function atualizarTextoPrazo() {
  const input = document.getElementById('prazo-bonus-input');
  const label = document.getElementById('label-prazo');
  
  if (input.value) {
    const dataObj = new Date(input.value);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    label.innerText = dataFormatada;
    label.classList.remove('text-gray-400');
    label.classList.add('text-brand-green');
  } else {
    label.innerText = 'Definir prazo';
    label.classList.remove('text-brand-green');
    label.classList.add('text-gray-400');
  }
}

async function salvarPerguntasBonus() {
  const inputPrazo = document.getElementById('prazo-bonus-input').value;

  const q1 = document.querySelector('input[name="q1"]')?.checked || false;
  const q2 = document.querySelector('input[name="q2"]')?.checked || false;
  const q3 = document.querySelector('input[name="q3"]')?.checked || false;
  const q4 = document.querySelector('input[name="q4"]')?.checked || false;
  const q5 = document.querySelector('input[name="q5"]')?.checked || false;

  const temAtiva = (q1 || q2 || q3 || q4 || q5);

  if (temAtiva && !inputPrazo) {
    showToast("Você precisa definir um prazo de resposta!", "error");
    return;
  }

  showToast("Salvando perguntas bônus...", "info");

  const payload = {
    group_id: grupoAtual.id,
    prazo: temAtiva ? new Date(inputPrazo).toISOString() : null,
    q1_ativa: q1,
    q2_ativa: q2,
    q3_ativa: q3,
    q4_ativa: q4,
    q5_ativa: q5,
    pontos: PONTOS_POR_PERGUNTA
  };

  const { error } = await sbClient.from('bonus_config').upsert(payload, { onConflict: 'group_id' });

  if (error) {
    showToast("Erro ao salvar regras no banco.", "error");
    console.error(error);
  } else {
    fecharPerguntasBonus();
    if (temAtiva) {
      showToast("Perguntas Bônus salvas com sucesso!", "success");
    } else {
      showToast("Perguntas Bônus desativadas com sucesso!", "success");
    }
    verificarExibicaoBotaoBonusJogador();
  }
}

// ==================== A VISÃO DO JOGADOR (RESPONDER BÔNUS) ====================

function obterTimesDoGrupo() {
  if (Array.isArray(todosOsJogos) && todosOsJogos.length > 0) {
    return [...new Set(todosOsJogos.flatMap(j => {
      const names = [];
      if (j && j.teams) {
        if (j.teams.home && j.teams.home.name) names.push(j.teams.home.name);
        if (j.teams.away && j.teams.away.name) names.push(j.teams.away.name);
      }
      return names;
    }))].sort((a, b) => a.localeCompare(b));
  }
  return [];
}

async function abrirResponderBonus() {
  if (!grupoAtual || !usuarioAtual || !sbClient) return;

  const modal = document.getElementById('modal-responder-bonus');
  const container = document.getElementById('container-perguntas-jogador');
  container.innerHTML = '<p class="text-center text-gray-500 py-4 animate-pulse">Buscando perguntas do GM...</p>';
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Garante que os jogos estejam carregados para obter a lista de times
  if (!todosOsJogos || todosOsJogos.length === 0) {
    if (typeof carregarJogos === 'function') {
      await carregarJogos();
    }
  }

  // 1. Busca a configuração do GM
  const { data: config } = await sbClient.from('bonus_config').select('*').eq('group_id', grupoAtual.id).single();
  
  if (!config || (!config.q1_ativa && !config.q2_ativa && !config.q3_ativa && !config.q4_ativa && !config.q5_ativa)) {
    container.innerHTML = '<p class="text-center text-gray-400 p-6 bg-white/5 rounded-xl border border-white/5">O Administrador ainda não ativou nenhuma pergunta bônus para este grupo.</p>';
    document.getElementById('player-bonus-prazo').innerText = "SEM PERGUNTAS ATIVAS";
    return;
  }

  // Verifica o prazo
  const prazoData = new Date(config.prazo);
  const agora = new Date();
  const prazoExpirado = agora > prazoData;
  
  document.getElementById('player-bonus-prazo').innerText = prazoExpirado 
    ? "⚠️ PRAZO ENCERRADO" 
    : "⏳ ENCERRA: " + prazoData.toLocaleDateString('pt-BR') + " às " + prazoData.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

  // 2. Busca se o jogador já respondeu antes
  const { data: respostaSalva } = await sbClient.from('bonus_respostas').select('*').eq('group_id', grupoAtual.id).eq('user_id', usuarioAtual.id).single();

  // 3. Monta o formulário apenas com o que está ativo
  let html = '';
  const disableInput = prazoExpirado ? 'disabled' : '';
  const opacidade = prazoExpirado ? 'opacity-50' : '';

  const timesList = obterTimesDoGrupo();
  const buildSelectTimes = (id, val) => {
    if (timesList.length === 0) {
      return `<input type="text" id="${id}" value="${val}" placeholder="Digite o nome do time..." class="w-full bg-[#222226] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-brand-green uppercase" ${disableInput}>`;
    }
    let selectHtml = `<select id="${id}" class="w-full bg-[#222226] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-brand-green" ${disableInput}>`;
    selectHtml += `<option value="" disabled ${!val ? 'selected' : ''}>Selecione um time...</option>`;
    timesList.forEach(t => {
      selectHtml += `<option value="${t}" ${val === t ? 'selected' : ''}>${t}</option>`;
    });
    selectHtml += `</select>`;
    return selectHtml;
  };

  if (config.q1_ativa) {
    const val = respostaSalva?.q1_resposta || '';
    html += `
      <div class="bg-[#151518] border border-white/5 rounded-xl p-4 ${opacidade}">
        <p class="text-white font-bold text-sm mb-3"><span class="text-brand-green">1.</span> Quantos gols o campeão fará no campeonato?</p>
        <select id="resp-q1" class="w-full bg-[#222226] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-brand-green" ${disableInput}>
          <option value="" disabled ${!val ? 'selected' : ''}>Selecione uma opção...</option>
          <option value="< 10" ${val === '< 10' ? 'selected' : ''}>Menos de 10</option>
          <option value="10-30" ${val === '10-30' ? 'selected' : ''}>Entre 10 e 30</option>
          <option value="30-50" ${val === '30-50' ? 'selected' : ''}>Entre 30 e 50</option>
          <option value="50-70" ${val === '50-70' ? 'selected' : ''}>Entre 50 e 70</option>
          <option value="70-90" ${val === '70-90' ? 'selected' : ''}>Entre 70 e 90</option>
          <option value="> 110" ${val === '> 110' ? 'selected' : ''}>Mais de 110</option>
        </select>
      </div>`;
  }

  if (config.q2_ativa) {
    const val = respostaSalva?.q2_resposta || '';
    html += `
      <div class="bg-[#151518] border border-white/5 rounded-xl p-4 ${opacidade}">
        <p class="text-white font-bold text-sm mb-3"><span class="text-brand-green">2.</span> Quem será o último colocado (rebaixado)?</p>
        ${buildSelectTimes('resp-q2', val)}
      </div>`;
  }

  if (config.q3_ativa) {
    const val = respostaSalva?.q3_resposta || '';
    html += `
      <div class="bg-[#151518] border border-white/5 rounded-xl p-4 ${opacidade}">
        <p class="text-white font-bold text-sm mb-3"><span class="text-brand-green">3.</span> Quem será o terceiro colocado?</p>
        ${buildSelectTimes('resp-q3', val)}
      </div>`;
  }
  if (config.q4_ativa) {
    const val = respostaSalva?.q4_resposta || '';
    html += `
      <div class="bg-[#151518] border border-white/5 rounded-xl p-4 ${opacidade}">
        <p class="text-white font-bold text-sm mb-3"><span class="text-brand-green">4.</span> Quem será o vice-campeão?</p>
        ${buildSelectTimes('resp-q4', val)}
      </div>`;
  }
  if (config.q5_ativa) {
    const val = respostaSalva?.q5_resposta || '';
    html += `
      <div class="bg-[#151518] border border-white/5 rounded-xl p-4 ${opacidade}">
        <p class="text-white font-bold text-sm mb-3"><span class="text-brand-green">5.</span> Quem será o campeão?</p>
        ${buildSelectTimes('resp-q5', val)}
      </div>`;
  }

  if(prazoExpirado) {
    html += `<div class="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-center text-sm font-bold rounded-xl mt-4">O prazo para enviar ou alterar respostas acabou!</div>`;
  }

  container.innerHTML = html;
}

function fecharResponderBonus() {
  document.getElementById('modal-responder-bonus').classList.add('hidden');
  document.getElementById('modal-responder-bonus').classList.remove('flex');
}

async function enviarRespostasBonus() {
  if (!grupoAtual || !usuarioAtual || !sbClient) return;

  const q1 = document.getElementById('resp-q1')?.value || null;
  const q2 = document.getElementById('resp-q2')?.value || null;
  const q3 = document.getElementById('resp-q3')?.value || null;
  const q4 = document.getElementById('resp-q4')?.value || null;
  const q5 = document.getElementById('resp-q5')?.value || null;

  showToast("Enviando suas respostas...", "info");

  const { error } = await sbClient.from('bonus_respostas').upsert({
    group_id: grupoAtual.id,
    user_id: usuarioAtual.id,
    q1_resposta: q1,
    q2_resposta: q2,
    q3_resposta: q3,
    q4_resposta: q4,
    q5_resposta: q5
  }, { onConflict: 'group_id, user_id' });

  if (error) {
    showToast("Erro ao enviar respostas.", "error");
    console.error(error);
  } else {
    showToast("Respostas salvas com sucesso! Boa sorte!", "success");
    fecharResponderBonus();
  }
}

async function verificarExibicaoBotaoBonusJogador() {
  const container = document.getElementById('container-responder-bonus-jogador');
  if (!container) return;
  if (!grupoAtual || !sbClient) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  
  try {
    const { data: config } = await sbClient
      .from('bonus_config')
      .select('*')
      .eq('group_id', grupoAtual.id)
      .single();
      
    if (config && (config.q1_ativa || config.q2_ativa || config.q3_ativa || config.q4_ativa || config.q5_ativa)) {
      container.classList.remove('hidden');
      container.innerHTML = `
        <button onclick="abrirResponderBonus()" class="w-full bg-brand-green/10 border border-brand-green/25 hover:bg-brand-green/20 text-brand-green font-bold py-2.5 px-3.5 rounded-xl text-[12px] flex items-center justify-between gap-2 active:scale-[0.99] transition-all">
          <span class="flex items-center gap-1.5"><span class="text-[13px]">⭐</span> Perguntas Bônus</span>
          <span class="text-[11px] font-black uppercase tracking-wide opacity-80 flex items-center gap-0.5">Responder ›</span>
        </button>
      `;
    } else {
      container.classList.add('hidden');
      container.innerHTML = '';
    }
  } catch (e) {
    console.error("Erro ao verificar perguntas bônus do jogador:", e);
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

// ==================== LÓGICA DO EDITOR DE REGRAS V2 ====================

function abrirEditorRegras() {
  if (!grupoAtual) return;
  
  const modal = document.getElementById('modal-regras-pontuacao');
  if (modal) {
    // Carrega dados da memória (trata as 4 regras ativas e os fallbacks)
    document.getElementById('regra-pt-placar-exato').value = (grupoAtual.pt_placar_exato !== undefined && grupoAtual.pt_placar_exato !== null) ? grupoAtual.pt_placar_exato : 12;
    document.getElementById('regra-pt-saldo').value = (grupoAtual.pt_vencedor_saldo !== undefined && grupoAtual.pt_vencedor_saldo !== null) ? grupoAtual.pt_vencedor_saldo : 7;
    document.getElementById('regra-pt-empate').value = (grupoAtual.pt_empate_nao_exato !== undefined && grupoAtual.pt_empate_nao_exato !== null) ? grupoAtual.pt_empate_nao_exato : 6;
    document.getElementById('regra-pt-apenas-vencedor').value = (grupoAtual.pt_apenas_vencedor !== undefined && grupoAtual.pt_apenas_vencedor !== null) ? grupoAtual.pt_apenas_vencedor : 3;
    
    // Carrega as configurações premium
    document.getElementById('toggle-zebra').checked = grupoAtual.regra_zebra_dinamica === true;
    document.getElementById('select-mult-fase').value = (grupoAtual.mult_fase_final !== undefined && grupoAtual.mult_fase_final !== null) ? grupoAtual.mult_fase_final : 2;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function fecharEditorRegras() {
  const modal = document.getElementById('modal-regras-pontuacao');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function salvarRegrasPontuacao() {
  if (!grupoAtual || !sbClient) return;
  
  const pt_placar_exato = parseInt(document.getElementById('regra-pt-placar-exato').value) || 0;
  const pt_vencedor_saldo = parseInt(document.getElementById('regra-pt-saldo').value) || 0;
  const pt_empate_nao_exato = parseInt(document.getElementById('regra-pt-empate').value) || 0;
  const pt_apenas_vencedor = parseInt(document.getElementById('regra-pt-apenas-vencedor').value) || 0;
  
  const regra_zebra_dinamica = document.getElementById('toggle-zebra').checked;
  const mult_fase_final = parseInt(document.getElementById('select-mult-fase').value) || 1;
  
  showToast("Salvando regras...", "info");
  
  try {
    const { error } = await sbClient
      .from('groups')
      .update({
        pt_placar_exato,
        pt_vencedor_saldo,
        pt_empate_nao_exato,
        pt_apenas_vencedor,
        regra_zebra_dinamica,
        mult_fase_final,
        // Mantém as regras legadas zeradas ou limpas
        pt_vencedor_gols_time: 0,
        pt_vencedor_gols_perdedor: 0,
        pt_gols_um_time: 0
      })
      .eq('id', grupoAtual.id);
      
    if (error) {
      console.error("Erro ao salvar regras de pontuação:", error.message);
      showToast("Erro ao salvar novas regras.", "error");
      return;
    }
    
    // Atualiza estado local
    grupoAtual.pt_placar_exato = pt_placar_exato;
    grupoAtual.pt_vencedor_saldo = pt_vencedor_saldo;
    grupoAtual.pt_empate_nao_exato = pt_empate_nao_exato;
    grupoAtual.pt_apenas_vencedor = pt_apenas_vencedor;
    grupoAtual.regra_zebra_dinamica = regra_zebra_dinamica;
    grupoAtual.mult_fase_final = mult_fase_final;
    
    // Limpa regras legadas
    grupoAtual.pt_vencedor_gols_time = 0;
    grupoAtual.pt_vencedor_gols_perdedor = 0;
    grupoAtual.pt_gols_um_time = 0;
    
    showToast("Novas regras aplicadas com sucesso!", "success");
    fecharEditorRegras();
    
    // Força recálculo visual se estiver na aba de regras
    if (document.getElementById('view-regras') && !document.getElementById('view-regras').classList.contains('hidden')) {
      renderizarRegrasGrupo();
    }
  } catch (e) {
    console.error(e);
    showToast("Erro ao processar as alterações.", "error");
  }
}

// Mapeador de clique no rodapé do modal
function salvarNovasRegras() {
  salvarRegrasPontuacao();
}

// Renderiza a lista de regras e os cards explicativos de Zebra/Mata-Mata
function renderizarRegrasGrupo() {
  const containerBase = document.getElementById('lista-regras-base-container');
  const cardPremium = document.getElementById('card-neon-premium');
  const premiumList = document.getElementById('premium-rules-active-list');

  if (!containerBase) return;

  const regras = {
    pt_placar_exato: (grupoAtual && grupoAtual.pt_placar_exato !== undefined && grupoAtual.pt_placar_exato !== null) ? Number(grupoAtual.pt_placar_exato) : 12,
    pt_vencedor_saldo: (grupoAtual && grupoAtual.pt_vencedor_saldo !== undefined && grupoAtual.pt_vencedor_saldo !== null) ? Number(grupoAtual.pt_vencedor_saldo) : 7,
    pt_empate_nao_exato: (grupoAtual && grupoAtual.pt_empate_nao_exato !== undefined && grupoAtual.pt_empate_nao_exato !== null) ? Number(grupoAtual.pt_empate_nao_exato) : 6,
    pt_apenas_vencedor: (grupoAtual && grupoAtual.pt_apenas_vencedor !== undefined && grupoAtual.pt_apenas_vencedor !== null) ? Number(grupoAtual.pt_apenas_vencedor) : 3
  };

  // Renderiza as Regras Base
  containerBase.innerHTML = `
    <!-- Placar Exato -->
    <div class="bg-card-bg rounded-xl p-4 border border-brand-green relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.1)]">
      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-green"></div>
      <div class="flex justify-between items-center mb-2 pl-2">
        <h4 class="font-bold text-[14px] text-white flex items-center gap-2">
          <span class="bg-brand-green text-black px-1.5 py-0.5 rounded text-[9px] font-black uppercase">TOP</span> 
          Na Mosca (Placar Exato)
        </h4>
        <span class="bg-brand-green/10 text-brand-green text-[13px] font-black px-2 py-0.5 rounded">+${regras.pt_placar_exato} pts</span>
      </div>
      <p class="text-[12px] text-text-muted pl-2">Palpitou <strong class="text-white">2x1</strong> e o jogo terminou <strong class="text-white">2x1</strong>.</p>
    </div>

    <!-- Vencedor e Saldo -->
    <div class="bg-card-bg rounded-xl p-4 border border-white/5">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-[14px] text-white">Vencedor e Saldo</h4>
        <span class="bg-white/5 text-white text-[13px] font-bold px-2 py-0.5 rounded">+${regras.pt_vencedor_saldo} pts</span>
      </div>
      <p class="text-[12px] text-text-muted">Palpitou <strong class="text-white">2x1</strong> e deu <strong class="text-white">3x2</strong> ou <strong class="text-white">1x0</strong> (Acertou quem ganhou e a diferença exata de gols).</p>
    </div>

    <!-- Empate -->
    <div class="bg-card-bg rounded-xl p-4 border border-white/5">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-[14px] text-white">Empate</h4>
        <span class="bg-white/5 text-white text-[13px] font-bold px-2 py-0.5 rounded">+${regras.pt_empate_nao_exato} pts</span>
      </div>
      <p class="text-[12px] text-text-muted">Palpitou <strong class="text-white">1x1</strong> e deu <strong class="text-white">2x2</strong> (Acertou o empate, mas errou a quantia exata de gols).</p>
    </div>

    <!-- Apenas Vencedor -->
    <div class="bg-card-bg rounded-xl p-4 border border-white/5">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-[14px] text-white">Apenas o Vencedor</h4>
        <span class="bg-white/5 text-white text-[13px] font-bold px-2 py-0.5 rounded">+${regras.pt_apenas_vencedor} pts</span>
      </div>
      <p class="text-[12px] text-text-muted">Palpitou <strong class="text-white">2x0</strong> e deu <strong class="text-white">3x1</strong> (Só acertou quem ganhou a partida).</p>
    </div>
  `;

  // Renderiza as Regras Premium ativas
  if (cardPremium && premiumList) {
    premiumList.innerHTML = '';
    let hasPremium = false;

    if (grupoAtual && grupoAtual.regra_zebra_dinamica) {
      hasPremium = true;
      premiumList.innerHTML += `
        <div class="flex items-start gap-3 p-3 bg-black/35 rounded-xl border border-[#10b981]/25">
          <span class="text-xl">🦓</span>
          <div>
            <h4 class="text-[#10b981] font-bold text-[13px]">Zebra Dinâmica Ativa</h4>
            <p class="text-gray-400 text-[10px] leading-snug mt-0.5">Se o time vencedor tiver <strong>menos de 15%</strong> de palpites do grupo, a pontuação obtida nessa partida é <strong>DOBRADA</strong>!</p>
          </div>
        </div>
      `;
    }

    const mult = (grupoAtual && grupoAtual.mult_fase_final !== undefined && grupoAtual.mult_fase_final !== null) ? Number(grupoAtual.mult_fase_final) : 2;
    if (mult > 1) {
      hasPremium = true;
      premiumList.innerHTML += `
        <div class="flex items-start gap-3 p-3 bg-black/35 rounded-xl border border-[#10b981]/25">
          <span class="text-xl">🔥</span>
          <div>
            <h4 class="text-[#10b981] font-bold text-[13px]">Multiplicador Mata-Mata Ativo (x${mult})</h4>
            <p class="text-gray-400 text-[10px] leading-snug mt-0.5">Todas as pontuações da fase final (oitavas de final em diante) serão multiplicadas por <strong>x${mult}</strong>!</p>
          </div>
        </div>
      `;
    }

    if (hasPremium) {
      cardPremium.classList.remove('hidden');
    } else {
      cardPremium.classList.add('hidden');
    }
  }
}
