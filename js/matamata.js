// ============================================================
// MATA-MATA DO GRUPO (SUPER UPDATE) — "a copa dentro da copa"
// Disputa INTERNA entre os jogadores do grupo: duelos diretos,
// fase a fase, usando os pontos do bolão feitos nos jogos reais
// daquela janela. Cada fase zera. Avança quem pontuar mais que
// o adversário direto.
//
// Etapa atual: estrutura da view + SIMULADOR + explicadores.
// A disputa real (chaves valendo, com persistência) é a próxima
// etapa — precisa de tabela no banco (ver Backlog).
// ============================================================

const MM_MIN_JOGADORES = 6;

let _mmTab = 'fases';
let _mmSimN = 12;              // jogadores no simulador
let _mmMembros = null;         // qtd de membros do grupo atual (cache)
let _mmJogosFuturos = null;    // qtd de jogos da Copa ainda por vir (cache)

async function carregarViewMatamata() {
  _mmTab = 'fases';
  mmRender();
  // dados em background (contagem de membros + jogos restantes)
  try {
    if (grupoAtual && sbClient) {
      const { count } = await sbClient.from('group_members')
        .select('*', { count: 'exact', head: true }).eq('group_id', grupoAtual.id);
      _mmMembros = count || 0;
      if (_mmMembros >= MM_MIN_JOGADORES) _mmSimN = _mmMembros;
    }
  } catch (e) { console.error('matamata membros:', e); }
  try {
    if (_mmJogosFuturos === null && typeof _copaFetch === 'function') {
      const j = await _copaFetch('fixtures?league=' + ((grupoAtual && grupoAtual.league_id) || 1) + '&season=2026');
      _mmJogosFuturos = ((j && j.response) || []).filter(f => !['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(f.fixture.status.short)).length;
    }
  } catch (e) { console.error('matamata fixtures:', e); }
  mmRender();
}

function mmSwitchTab(t) { _mmTab = t; mmRender(); }

function mmRender() {
  const el = document.getElementById('mm-body');
  if (!el) return;
  const ATIVA = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[12px] font-black transition-all border-brand-green/40 bg-brand-green/10 text-brand-green';
  const INATIVA = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[12px] font-black transition-all border-white/5 bg-card-bg text-text-muted';

  el.innerHTML = `
    <div class="flex gap-2 mb-4 mt-3">
      <button onclick="mmSwitchTab('fases')" class="${_mmTab === 'fases' ? ATIVA : INATIVA}">⚔️ Fases do Mata-mata</button>
      <button onclick="mmSwitchTab('sim')" class="${_mmTab === 'sim' ? ATIVA : INATIVA}">▶️ Simulador</button>
    </div>
    ${_mmTab === 'fases' ? mmTabFases() : mmTabSimulador()}`;
}

// ---------------- ABA: FASES ----------------
function mmTabFases() {
  const n = _mmMembros;
  const temMinimo = n !== null && n >= MM_MIN_JOGADORES;

  const avisoMembros = (n === null) ? '' : (temMinimo ? `
    <div class="rounded-2xl border border-brand-green/25 bg-brand-green/5 p-4 mb-3 flex gap-3 items-center">
      <span class="text-xl">✅</span>
      <p class="text-[13px] text-zinc-300"><b class="text-brand-green">${n} jogadores</b> no grupo — já dá pra montar um chaveamento. A disputa valendo chega na próxima atualização; veja no <b>Simulador</b> como ficaria.</p>
    </div>` : `
    <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-3 flex gap-3 items-center">
      <span class="text-xl">👥</span>
      <p class="text-[13px] text-amber-200/90">Este formato precisa de pelo menos <b>${MM_MIN_JOGADORES} membros</b> pra acontecer (o grupo tem <b>${n}</b>). Convide mais amigos pro bolão!</p>
    </div>`);

  return `
    <!-- hero -->
    <div class="rounded-3xl bg-card-bg border border-white/5 p-6 text-center mb-3 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-brand-green/5 to-transparent pointer-events-none"></div>
      <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center text-2xl mb-3">⚔️</div>
      <h2 class="text-2xl font-black">O temido <span class="text-brand-green">Mata-mata</span></h2>
      <p class="text-text-muted text-[13px] mt-1 mb-4">Não recomendado para cardíacos</p>
      <button onclick="mmModalComoFunciona()" class="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-200 text-[13px] font-bold px-5 py-2.5 rounded-2xl active:scale-95">Saiba como funciona ›</button>
    </div>

    ${avisoMembros}

    <span class="inline-block bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">🚧 Em construção — chega na próxima atualização</span>

    <!-- 4 disputas -->
    <button onclick="mmModal4Disputas()" class="w-full bg-card-bg border border-white/5 rounded-2xl p-4 flex items-center gap-3.5 active:scale-[0.98] transition-transform text-left">
      <div class="grid grid-cols-2 gap-1 shrink-0">
        <span class="w-3 h-3 rounded-full bg-gold/70"></span><span class="w-3 h-3 rounded-full bg-purple-500/70"></span>
        <span class="w-3 h-3 rounded-full bg-blue-500/70"></span><span class="w-3 h-3 rounded-full bg-brand-green/70"></span>
      </div>
      <div class="flex-1">
        <p class="font-black text-[15px]">4 disputas, um app só</p>
        <p class="text-text-muted text-[12px]">Quatro jeitos de pontuar. Todos rodando ao mesmo tempo.</p>
      </div>
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-text-muted shrink-0"><path d="M9 5l7 7-7 7"/></svg>
    </button>

    <div class="mt-3 rounded-2xl bg-card-bg border border-white/5 p-4">
      <p class="text-[13px] text-zinc-300 mb-3">O Bolão Pro vai ter <b>4 competições paralelas e independentes</b>:</p>
      ${[
        ['🏆', 'Ranking principal', 'bg-gold/15 border-gold/30', 'rodando'],
        ['💬', 'Ranking de perguntas', 'bg-purple-500/15 border-purple-500/30', 'em breve'],
        ['👥', 'Ranking de Equipes', 'bg-blue-500/15 border-blue-500/30', 'em breve'],
        ['⚔️', 'O temido Mata-Mata', 'bg-brand-green/15 border-brand-green/30', 'em construção']
      ].map(c => `
        <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
          <div class="w-9 h-9 rounded-xl border ${c[2]} flex items-center justify-center text-base shrink-0">${c[0]}</div>
          <p class="flex-1 font-bold text-[13px]">${c[1]}</p>
          <span class="text-[9px] font-black uppercase tracking-widest ${c[3] === 'rodando' ? 'text-brand-green' : 'text-text-muted'}">${c[3]}</span>
        </div>`).join('')}
    </div>`;
}

// ---------------- ABA: SIMULADOR ----------------
// Estrutura: cabeças de chave (byes) + qualificatória + fases até a Grande Final.
// B = maior potência de 2 <= N. Cabeças = 2B - N (melhores do ranking pulam a
// qualificatória). Qualificatória = N - cabeças jogadores brigando pelas vagas.
function mmEstrutura(n) {
  let B = 1; while (B * 2 <= n) B *= 2;
  const cabecas = 2 * B - n;            // n == B -> todos são "cabeça" (sem qualificatória)
  const qualificantes = n - cabecas;    // disputam (qualificantes/2) duelos
  const fases = [];
  let vivos = B;
  while (vivos >= 2) {
    fases.push({ jogadores: vivos, duelos: vivos / 2 });
    vivos = vivos / 2;
  }
  return { B, cabecas, qualificantes, fases };
}

function _mmNomeFase(jogadores) {
  if (jogadores === 2) return 'Grande Final';
  if (jogadores === 4) return 'Semifinais';
  if (jogadores === 8) return 'Quartas de final';
  if (jogadores === 16) return 'Oitavas de final';
  return `Fase de ${jogadores}`;
}

function _mmDots(qtd, cor, extra = '') {
  let h = '';
  for (let i = 0; i < qtd; i++) h += `<span class="w-3.5 h-3.5 rounded-full ${cor} ${extra}"></span>`;
  return h;
}
function _mmDotsDuelos(duelos) {
  // pares verde+laranja ligados (vencedor avança, perdedor cai)
  let h = '';
  for (let i = 0; i < duelos; i++) {
    h += `<span class="inline-flex items-center mr-2 mb-1.5">
      <span class="w-3.5 h-3.5 rounded-full bg-brand-green"></span>
      <span class="w-2 h-px bg-white/20"></span>
      <span class="w-3.5 h-3.5 rounded-full bg-orange-400/80"></span>
    </span>`;
  }
  return h;
}

function mmSimAjusta(d) {
  _mmSimN = Math.min(250, Math.max(MM_MIN_JOGADORES, _mmSimN + d));
  mmRender();
}

function mmTabSimulador() {
  const n = _mmSimN;
  const e = mmEstrutura(n);

  // janela de jogos reais por fase (divide os jogos futuros da Copa)
  const totalFases = e.fases.length + (e.qualificantes ? 1 : 0);
  const jf = _mmJogosFuturos;
  let janelas = null;
  if (jf && jf >= totalFases) {
    const base = Math.floor(jf / totalFases);
    janelas = []; let usado = 0;
    for (let i = 0; i < totalFases; i++) {
      const qtd = (i === totalFases - 1) ? jf - usado : base;
      janelas.push({ de: usado + 1, ate: usado + qtd });
      usado += qtd;
    }
  }
  let idxJanela = 0;
  const rotJanela = () => janelas ? `<p class="text-[11px] text-text-muted">Jogos ${janelas[idxJanela].de}–${janelas[idxJanela].ate} da Copa (restantes)</p>` : '';

  let html = `
    <p class="text-[10px] uppercase tracking-widest text-text-muted font-black mb-2 ml-1">Simulador de chaveamento</p>
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4 mb-4">
      <div class="flex items-center justify-between mb-1">
        <p class="font-black text-[14px]">Jogadores no grupo</p>
        <span class="text-[11px] text-text-muted font-bold">${MM_MIN_JOGADORES}–250</span>
      </div>
      <div class="flex items-center justify-center gap-3 mt-2">
        <button onclick="mmSimAjusta(-1)" class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 font-black text-lg active:scale-95">−</button>
        <div class="w-20 text-center text-2xl font-black text-brand-green">${n}</div>
        <button onclick="mmSimAjusta(1)" class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 font-black text-lg active:scale-95">+</button>
      </div>
      ${_mmMembros !== null ? `<p class="text-center text-[11px] text-text-muted mt-2">seu grupo hoje: <b class="text-zinc-300">${_mmMembros}</b> jogador${_mmMembros === 1 ? '' : 'es'}</p>` : ''}
    </div>

    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4 text-[11px] font-bold text-zinc-300">
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-brand-green"></span> Avança</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-brand-green ring-2 ring-gold"></span> Cabeça de chave</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-orange-400/80"></span> Eliminado</span>
    </div>`;

  const seta = `<div class="flex justify-center my-2 text-text-muted">↓</div>`;

  if (e.qualificantes) {
    html += `
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4">
      <div class="flex items-center gap-3 mb-1">
        <div class="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">🛡️</div>
        <div><p class="font-black text-[15px]">Qualificatória</p>${rotJanela()}</div>
      </div>
      <p class="text-[11px] text-text-muted mb-2">${e.cabecas} cabeça${e.cabecas === 1 ? '' : 's'} de chave (topo do ranking) passa${e.cabecas === 1 ? '' : 'm'} direto · ${e.qualificantes} disputam ${e.qualificantes / 2} duelos</p>
      <div class="flex flex-wrap gap-1.5">
        ${_mmDots(e.cabecas, 'bg-brand-green', 'ring-2 ring-gold')}
        ${_mmDotsDuelos(e.qualificantes / 2)}
      </div>
    </div>`;
    idxJanela++;
    html += seta;
  }

  e.fases.forEach((f, i) => {
    const ehFinal = f.jogadores === 2;
    html += `
    <div class="rounded-2xl bg-card-bg border ${ehFinal ? 'border-gold/30 glow-gold' : 'border-white/5'} p-4">
      <div class="flex items-center gap-3 mb-1">
        <div class="w-9 h-9 rounded-xl ${ehFinal ? 'bg-gold/15' : 'bg-white/5'} flex items-center justify-center">${ehFinal ? '🏆' : '⚔️'}</div>
        <div><p class="font-black text-[15px]">${_mmNomeFase(f.jogadores)}</p>${rotJanela()}</div>
      </div>
      <p class="text-[11px] text-text-muted mb-2">${f.jogadores} jogadores · ${f.duelos} duelo${f.duelos === 1 ? '' : 's'} — cada fase ZERA os pontos</p>
      <div class="flex flex-wrap gap-1.5">${_mmDotsDuelos(f.duelos)}</div>
    </div>`;
    idxJanela++;
    if (!ehFinal) html += seta;
  });

  html += seta + `
    <div class="rounded-2xl bg-card-bg border border-gold/30 p-5 text-center">
      <div class="flex items-center justify-center gap-2 mb-2"><span class="text-lg">👑</span></div>
      <span class="inline-block w-5 h-5 rounded-full bg-brand-green ring-2 ring-gold mb-2"></span>
      <p class="font-black text-[15px] mb-1">Campeão do Mata-mata</p>
      <p class="text-text-muted text-[12px] leading-relaxed max-w-[280px] mx-auto">Aquele que superou todas as fases, uma após a outra. Sem depender de acumulado — na raça, duelo a duelo.</p>
    </div>

    <p class="text-[11px] text-text-muted text-center mt-3">🚧 Simulação da estrutura — a disputa valendo chega na próxima atualização.</p>`;

  return html;
}

// ---------------- MODAIS ----------------
function _mmModal(titulo, html) {
  const wrap = document.getElementById('mm-modal');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="absolute inset-0 bg-black/80" onclick="mmFecharModal()"></div>
    <div class="relative w-full max-w-md mx-auto h-full sm:h-auto sm:max-h-[92vh] sm:my-6 sm:rounded-3xl overflow-hidden flex flex-col bg-app-bg border border-white/10">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <p class="text-lg font-black">${titulo}</p>
        <button onclick="mmFecharModal()" class="w-9 h-9 rounded-full bg-white/10 font-black">✕</button>
      </div>
      <div class="overflow-y-auto p-5">${html}</div>
    </div>`;
  wrap.classList.remove('hidden');
}
function mmFecharModal() { const w = document.getElementById('mm-modal'); if (w) { w.classList.add('hidden'); w.innerHTML = ''; } }

function mmModalComoFunciona() {
  _mmModal('Como funciona o Mata-mata', `
    ${[
      ['🪟', 'Cada fase = uma janela de jogos reais', 'O calendário da Copa é fatiado em janelas. Cada fase do mata-mata acontece nos jogos daquela janela.'],
      ['🎯', 'Seus palpites viram sua arma', 'Os pontos que você fizer no bolão dentro da janela contam pro seu duelo. Palpitou bem, avançou.'],
      ['⚔️', 'Duelo direto', 'Você contra UM adversário por fase. Quem fizer mais pontos na janela, avança. O outro tá fora.'],
      ['🧨', 'Cada fase ZERA', 'Tinha 100 pontos? Zerou. Agora vale o que você pontuar daqui pra frente. Igual à Copa: final na faca.'],
      ['👑', 'Cabeça de chave', 'Se o número de jogadores não fecha a chave, os melhores do ranking pulam a qualificatória.'],
      ['⚖️', 'Desempate', 'Empatou o duelo? Valem os critérios do grupo (placares exatos, acertos de vencedor...).']
    ].map(c => `
      <div class="flex gap-3.5 mb-4">
        <div class="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center text-lg shrink-0">${c[0]}</div>
        <div><p class="font-black text-[14px]">${c[1]}</p><p class="text-text-muted text-[12px] leading-relaxed mt-0.5">${c[2]}</p></div>
      </div>`).join('')}
    <div class="rounded-2xl border border-brand-green/25 bg-brand-green/5 p-4 mt-2">
      <p class="text-[12px] text-zinc-300">💡 O Ranking principal continua rodando normal — o Mata-mata é uma disputa <b>paralela</b>. Ninguém sai do bolão por ser eliminado.</p>
    </div>`);
}

function mmModal4Disputas() {
  const bloco = (borda, icone, cat, titulo, tagline, texto, chip) => `
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4 mb-3 relative overflow-hidden">
      <div class="absolute left-0 top-0 bottom-0 w-1 ${borda}"></div>
      <div class="flex items-center gap-3 mb-2 pl-2">
        <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">${icone}</div>
        <div><p class="text-[9px] font-black uppercase tracking-widest text-text-muted">${cat}</p><p class="font-black text-[15px]">${titulo}</p></div>
      </div>
      <p class="text-[13px] font-bold mb-1.5 pl-2 ${borda.replace('bg-', 'text-').replace('/70', '')}">${tagline}</p>
      <p class="text-[13px] text-zinc-400 leading-relaxed pl-2 mb-2.5">${texto}</p>
      <div class="ml-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] font-bold text-zinc-300">✨ ${chip}</div>
    </div>`;
  _mmModal('4 disputas, um app só', `
    <p class="text-[13px] text-zinc-400 leading-relaxed mb-4">Você não vai jogar UMA competição — vai jogar <b class="text-white">quatro</b>, em paralelo, cada uma coroando um campeão. Não dá pra perder em tudo: alguma vai te abraçar. 😄</p>
    ${bloco('bg-gold/70', '🏆', 'A maratona', 'Ranking principal', 'Pontos corridos. Quem soma mais, ganha.', 'Acertou um palpite? Marcou pontos. Os pontos só sobem — nunca zeram. Quem for consistente do primeiro ao último jogo, leva.', 'Recompensa quem é consistente · JÁ RODANDO')}
    ${bloco('bg-purple-500/70', '💬', 'O quiz', 'Ranking de perguntas', 'Cada resposta certa: pontos. Simples.', 'Perguntas da Copa — "quem marca mais gols?", "qual seleção vai mais longe?". Ranking próprio, separado do geral.', 'Quem nasceu virado pra lua tem vantagem · EM BREVE')}
    ${bloco('bg-blue-500/70', '👥', 'Os times internos', 'Ranking de Equipes', 'Crie times no grupo. Disputem juntos.', 'Homens vs mulheres, família vs a do cunhado — você decide. Cada equipe soma os pontos dos integrantes.', 'Bom pra grupos grandes e rixas internas · EM BREVE')}
    ${bloco('bg-brand-green/70', '⚔️', 'A copa dentro da copa', 'O temido Mata-Mata', 'Cada nova fase zera os pontos.', 'Duelo direto contra um adversário por fase. Avança quem pontua mais. Eliminado, tá fora. Final na faca.', 'Pra quem aguenta a pressão · EM CONSTRUÇÃO')}
    <p class="text-center text-[12px] text-text-muted mt-1">Você participa de todas sem fazer nada extra — cada palpite seu conta nas 4 disputas.</p>`);
}
