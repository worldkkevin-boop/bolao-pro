// ============================================================
// CRIAR BOLÃO — wizard de 8 passos (SUPER UPDATE)
// Regras: docs/regras-pontuacao-v2.md · Motor: js/pontos.js
// View: #view-criar-bolao (index.html) — tudo renderizado aqui.
// ============================================================

const CB_ICONES = [
  { id: 'trofeu',   emoji: '🏆' }, { id: 'bola',     emoji: '⚽' },
  { id: 'estrela',  emoji: '⭐' }, { id: 'coroa',    emoji: '👑' },
  { id: 'medalha',  emoji: '🥇' }, { id: 'bandeira', emoji: '🚩' }
];

const CB_PASSOS = ['Identidade', 'Campeonato', 'Equipes', 'Jogos', 'Pontuação', 'Pesos', 'Desempate', 'Revisão'];

const CB_SISTEMAS = {
  mercado: {
    nome: 'O mais justo e equilibrado', desc: 'A maior inovação já vista', icone: '✨', rec: true,
    resumo: 'Base 5–20 pts por probabilidade + bônus'
  },
  classico: {
    nome: 'Sistema simplificado', desc: 'Simplesmente emocionante, mas sem reviravoltas', icone: '⚡',
    resumo: 'Cascata clássica: Exato 12 · Saldo 7 · Empate 6 · Vencedor 3'
  },
  so_vencedor: {
    nome: 'Sem placar, só vencedor', desc: 'Mais simples e divertido que isso impossível', icone: '🎯',
    resumo: 'Acertou quem ganha = 5 pts. Fim.'
  },
  custom: {
    nome: 'Personalizar sistema', desc: 'Liberdade total', icone: '⚙️',
    resumo: 'Motor de mercado com todos os valores editáveis'
  }
};

const CB_PESOS = {
  gradual:           { nome: 'Equilíbrio gradual',       desc: 'Grupos peso 1×, eliminatórias peso 2×, final peso 4×', icone: '📈', rec: true },
  unico_final_dobro: { nome: 'Peso único, final o dobro', desc: 'Todos os jogos valem o mesmo; a final vale em dobro',   icone: '⭐' },
  unico:             { nome: 'Peso único',                desc: 'Pontuação única em todos os jogos',                     icone: '➖' },
  acelerado:         { nome: 'Aumenta aceleradamente',    desc: 'Rodadas de grupos 1×/2×/3×, eliminatórias 4×, final 6×', icone: '🚀' }
};

const CB_DESEMPATE = [
  ['Pontos Totais', 'Total de pontos acumulados'],
  ['Acertou Vencedor', 'Vezes que acertou o vencedor'],
  ['Placar Exato', 'Quantidade de placares exatos'],
  ['Gols do Vencedor', 'Acertou gols do vencedor'],
  ['Diferença de Gols', 'Acertou a diferença de gols'],
  ['Gols do Perdedor', 'Acertou gols do perdedor'],
  ['Goleada', 'Bônus por acertar goleada'],
  ['Ordem de Entrada', 'Quem entrou primeiro']
];

// -------- estado do wizard --------
let cb = null;
// Copa do Mundo encerrou (campeão: Espanha) — Brasileirão vira o campeonato
// disponível pra testar o wizard nessa reforma da 2.0.
const CB_CAMPEONATO_ATIVO = {
  leagueId: 71, season: 2026,
  nome: 'Brasileirão Série A', pais: 'Brasil', periodo: 'JAN – DEZ'
};

function _cbEstadoInicial() {
  return {
    passo: 1,
    nome: '', icone: 'trofeu',
    leagueId: CB_CAMPEONATO_ATIVO.leagueId, season: CB_CAMPEONATO_ATIVO.season,
    equipesModo: 'todas', equipesSel: new Set(),
    jogosModo: 'todos', fasesSel: new Set(),
    sistema: 'mercado', cfg: Object.assign({}, PONTOS_V2_DEFAULTS),
    pesoModo: 'gradual',
    privado: false, maxParticipantes: 20,
    _fixtures: null, _times: null
  };
}

function abrirCriarBolao() {
  cb = _cbEstadoInicial();
  switchView('view-criar-bolao');
  cbRender();
  _cbCarregarFixtures(); // em background (times + contagens)
}

async function _cbCarregarFixtures() {
  try {
    const j = await _copaFetch(`fixtures?league=${cb.leagueId}&season=${cb.season}`);
    const fx = (j && j.response) || [];
    cb._fixtures = fx;
    const map = {};
    fx.forEach(f => {
      [f.teams.home, f.teams.away].forEach(t => { if (t && t.id) map[t.id] = { id: t.id, name: t.name, logo: t.logo }; });
    });
    cb._times = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    if (cb.passo === 2 || cb.passo === 3 || cb.passo === 4) cbRender();
  } catch (e) { console.error('criar-bolao fixtures:', e); }
}

// -------- helpers de contagem/filtro --------
function _cbJogosFiltrados() {
  let fx = cb._fixtures || [];
  if (cb.equipesModo === 'sel' && cb.equipesSel.size) {
    fx = fx.filter(f => cb.equipesSel.has(f.teams.home.id) || cb.equipesSel.has(f.teams.away.id));
  }
  if (cb.jogosModo === 'fases' && cb.fasesSel.size) {
    fx = fx.filter(f => cb.fasesSel.has((f.league && f.league.round) || ''));
  }
  return fx;
}
// Rounds distintos, na ordem em que aparecem nos fixtures (funciona tanto pra
// campeonato de mata-mata quanto liga de pontos corridos — não hardcoda fases).
function _cbRoundsDisponiveis() {
  const vistos = new Set();
  const lista = [];
  (cb._fixtures || []).forEach(f => {
    const r = (f.league && f.league.round) || '';
    if (!r || vistos.has(r)) return;
    vistos.add(r);
    lista.push(r);
  });
  return lista;
}
function _cbContagemFases(fixtures, modo) {
  // agrupa os jogos pelo PESO que teriam no modo escolhido
  const grupos = {};
  (fixtures || []).forEach(f => {
    const round = (f.league && f.league.round) || '';
    const peso = pesoDaFaseV2(round, modo);
    const fase = faseDoJogoV2(round);
    const rot = fase.final ? 'A Final' : (fase.mataMata ? 'Fase Final' : (fase.rodada ? `${fase.rodada}ª Rodada` : 'Fase Grupos'));
    const key = rot + '|' + peso;
    if (!grupos[key]) grupos[key] = { rotulo: rot, peso, jogos: 0 };
    grupos[key].jogos++;
  });
  return Object.values(grupos).sort((a, b) => a.peso - b.peso);
}

// -------- render principal --------
function cbRender() {
  const body = document.getElementById('cb-body');
  const dots = document.getElementById('cb-dots');
  const rotulo = document.getElementById('cb-rotulo-passo');
  const footer = document.getElementById('cb-footer');
  if (!body) return;

  // dots de progresso
  dots.innerHTML = CB_PASSOS.map((p, i) => {
    const n = i + 1;
    const done = n < cb.passo, atual = n === cb.passo;
    return `${i > 0 ? '<div class="flex-1 h-px bg-white/10 min-w-[8px]"></div>' : ''}
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0
        ${done ? 'bg-emerald-500 text-black' : atual ? 'bg-emerald-600/90 text-white ring-2 ring-emerald-400/40' : 'bg-white/5 text-zinc-500'}">
        ${done ? '✓' : n}
      </div>`;
  }).join('');
  rotulo.innerHTML = `${cb.passo} / 8: <span class="text-white font-bold">${CB_PASSOS[cb.passo - 1]}</span>`;

  const fns = [cbPasso1, cbPasso2, cbPasso3, cbPasso4, cbPasso5, cbPasso6, cbPasso7, cbPasso8];
  body.innerHTML = fns[cb.passo - 1]();
  body.scrollTop = 0;

  // footer
  const ultimo = cb.passo === 8;
  footer.innerHTML = `
    ${cb.passo > 1 ? `<button onclick="cbVoltar()" class="px-6 py-3.5 rounded-2xl border border-emerald-700/50 text-emerald-300 font-bold text-sm active:scale-95">← Voltar</button>` : ''}
    <button onclick="${ultimo ? 'cbCriar()' : 'cbContinuar()'}" id="cb-btn-continuar"
      class="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black text-sm active:scale-95 disabled:opacity-40">
      ${ultimo ? '🏆 Criar Bolão' : 'Continuar →'}
    </button>`;
}

function cbVoltar() { if (cb.passo > 1) { cb.passo--; cbRender(); } }
function cbContinuar() {
  if (cb.passo === 1 && cb.nome.trim().length < 3) { showToast('O nome precisa de pelo menos 3 caracteres', 'error'); return; }
  if (cb.passo === 3 && cb.equipesModo === 'sel' && cb.equipesSel.size < 2) { showToast('Escolha pelo menos 2 equipes', 'error'); return; }
  if (cb.passo === 4 && cb.jogosModo === 'fases' && !cb.fasesSel.size) { showToast('Escolha pelo menos uma fase', 'error'); return; }
  if (cb.passo < 8) { cb.passo++; cbRender(); }
}

// -------- PASSO 1: Identidade --------
function cbPasso1() {
  return `
  <h2 class="text-3xl font-black mb-1">Nome do seu bolão</h2>
  <p class="text-zinc-400 text-sm mb-6">Escolha um nome e um ícone para identificar seu grupo</p>

  <label class="text-[13px] text-zinc-300 font-bold">Nome do grupo</label>
  <input id="cb-nome" value="${cb.nome.replace(/"/g, '&quot;')}" oninput="cb.nome=this.value"
    class="w-full mt-2 bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-emerald-500/60" placeholder="Ex: Resenha da Copa">
  <p class="text-[11px] text-zinc-500 mt-1.5 mb-6">Mínimo 3 caracteres</p>

  <label class="text-[13px] text-zinc-300 font-bold">Ícone do grupo</label>
  <div class="grid grid-cols-4 gap-3 mt-2">
    ${CB_ICONES.map(i => `
      <button onclick="cb.icone='${i.id}';cbRender()"
        class="aspect-square rounded-2xl flex items-center justify-center text-3xl border transition-all active:scale-95
        ${cb.icone === i.id ? 'border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/40' : 'border-white/10 bg-white/5'}">
        ${i.emoji}
      </button>`).join('')}
  </div>`;
}

// -------- PASSO 2: Campeonato --------
function cbPasso2() {
  const nJogos = cb._fixtures ? cb._fixtures.length : 380;
  const nTimes = cb._times ? cb._times.length : 20;
  return `
  <h2 class="text-3xl font-black mb-1">Campeonato</h2>
  <p class="text-zinc-400 text-sm mb-6">Selecione o campeonato para o seu bolão</p>

  <div class="rounded-3xl border border-emerald-500/60 bg-emerald-950/30 p-5">
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-2xl">🏆</div>
      <div class="flex-1">
        <p class="text-lg font-black">${CB_CAMPEONATO_ATIVO.nome}</p>
        <p class="text-zinc-400 text-[12px]">${CB_CAMPEONATO_ATIVO.pais}</p>
      </div>
      <span class="text-[11px] font-bold bg-emerald-500/15 text-emerald-300 px-3 py-1.5 rounded-full">Selecionado</span>
    </div>
    <div class="h-px bg-white/10 my-4"></div>
    <p class="text-center text-2xl font-black text-emerald-300">${CB_CAMPEONATO_ATIVO.season} <span class="text-zinc-400 text-sm font-bold">· ${CB_CAMPEONATO_ATIVO.periodo}</span></p>
    <div class="h-px bg-white/10 my-4"></div>
    <div class="grid grid-cols-3 gap-2 text-center">
      <div><p class="font-black">🏁 Em andamento</p><p class="text-[11px] text-zinc-500">rolando</p></div>
      <div><p class="font-black">⊙ ${nJogos}</p><p class="text-[11px] text-zinc-500">jogos</p></div>
      <div><p class="font-black">🚩 ${nTimes}</p><p class="text-[11px] text-zinc-500">times</p></div>
    </div>
  </div>

  <div class="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
    <span class="text-amber-400">ⓘ</span>
    <p class="text-amber-200/90 text-[13px]">Mais campeonatos em breve! Por enquanto, o ${CB_CAMPEONATO_ATIVO.nome} é o campeonato disponível para bolões.</p>
  </div>`;
}

// -------- PASSO 3: Equipes --------
function cbPasso3() {
  const times = cb._times || [];
  return `
  <h2 class="text-3xl font-black mb-1">Seleção de Equipes</h2>
  <p class="text-zinc-400 text-sm mb-6">Escolha quais equipes participarão do bolão</p>

  ${_cbCardOpcao('cbEquipesModo(\'todas\')', cb.equipesModo === 'todas', '🚩', 'Todas as equipes', `Inclui todas as ${times.length || 48} seleções`, true)}
  ${_cbCardOpcao('cbEquipesModo(\'sel\')', cb.equipesModo === 'sel', '☰', 'Selecionar equipes', 'Escolha equipes específicas')}

  ${cb.equipesModo === 'sel' ? `
    <div class="mt-5">
      <p class="text-[12px] text-zinc-400 mb-3 font-bold">${cb.equipesSel.size} selecionada(s) — os jogos incluem qualquer partida com pelo menos 1 equipe escolhida</p>
      ${times.length ? `<div class="grid grid-cols-3 gap-2">
        ${times.map(t => `
          <button onclick="cbToggleEquipe(${t.id})"
            class="rounded-xl border p-2 flex flex-col items-center gap-1.5 active:scale-95 transition-all
            ${cb.equipesSel.has(t.id) ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-white/5'}">
            <img src="${t.logo}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
            <span class="text-[10px] font-bold leading-tight text-center">${t.name}</span>
          </button>`).join('')}
      </div>` : `<p class="text-zinc-500 text-sm animate-pulse">Carregando as seleções...</p>`}
    </div>` : ''}`;
}
function cbEquipesModo(m) { cb.equipesModo = m; cbRender(); }
function cbToggleEquipe(id) { cb.equipesSel.has(id) ? cb.equipesSel.delete(id) : cb.equipesSel.add(id); cbRender(); }

// -------- PASSO 4: Jogos --------
function cbPasso4() {
  const total = cb._fixtures ? cb._fixtures.length : 380;
  const filtrados = _cbJogosFiltrados().length;
  return `
  <h2 class="text-3xl font-black mb-1">Seleção de Jogos</h2>
  <p class="text-zinc-400 text-sm mb-6">Escolha quais jogos farão parte do bolão</p>

  ${_cbCardOpcao('cbJogosModo(\'todos\')', cb.jogosModo === 'todos', '⊙', 'Todos os jogos', `Inclui todos os ${total} jogos`, true)}
  ${_cbCardOpcao('cbJogosModo(\'fases\')', cb.jogosModo === 'fases', '☰', 'Selecionar por fase', 'Filtre quais fases valem ponto')}

  ${cb.jogosModo === 'fases' ? `
    <div class="mt-5 flex flex-wrap gap-2 max-h-64 overflow-y-auto">
      ${_cbRoundsDisponiveis().map(r => `
        <button onclick="cbToggleFase('${r.replace(/'/g, "\\'")}')"
          class="px-4 py-2 rounded-full text-[12px] font-bold border active:scale-95
          ${cb.fasesSel.has(r) ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-400'}">
          ${r}
        </button>`).join('') || '<p class="text-zinc-500 text-sm animate-pulse">Carregando as fases...</p>'}
    </div>` : ''}

  <div class="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
    <p class="text-[11px] uppercase tracking-widest text-zinc-500 font-black">Jogos no seu bolão</p>
    <p class="text-3xl font-black text-emerald-300 mt-1">${cb._fixtures ? filtrados : '—'}</p>
  </div>`;
}
function cbJogosModo(m) { cb.jogosModo = m; cbRender(); }
function cbToggleFase(k) { cb.fasesSel.has(k) ? cb.fasesSel.delete(k) : cb.fasesSel.add(k); cbRender(); }

// -------- PASSO 5: Pontuação --------
function cbPasso5() {
  return `
  <h2 class="text-3xl font-black mb-1">Sistema de Pontos</h2>
  <p class="text-zinc-400 text-sm mb-6">Escolha como os pontos serão calculados</p>

  ${Object.entries(CB_SISTEMAS).map(([id, s]) => `
    <div onclick="cb.sistema='${id}';cbRender()"
      class="rounded-3xl border p-4 mb-3 flex items-center gap-4 cursor-pointer transition-all
      ${cb.sistema === id ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400/30' : 'border-white/10 bg-white/5'}">
      <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl shrink-0">${s.icone}</div>
      <div class="flex-1 min-w-0">
        <p class="font-black text-[15px]">${s.nome}</p>
        <p class="text-zinc-400 text-[12px] leading-snug">${s.desc}</p>
      </div>
      <div class="flex flex-col items-end gap-1.5 shrink-0">
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation();cbModalComoFunciona()" class="w-8 h-8 rounded-full bg-white/10 text-zinc-300 text-sm font-bold">?</button>
          ${cb.sistema === id ? '<div class="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black">✓</div>' : ''}
        </div>
        ${s.rec ? '<span class="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Recomendado</span>' : ''}
      </div>
    </div>`).join('')}

  ${cb.sistema === 'custom' ? _cbKnobsCustom() : `
    <div class="mt-3 rounded-2xl bg-white/5 border border-white/10 p-4">
      <p class="text-[11px] uppercase tracking-widest text-zinc-500 font-black mb-1">Como pontua</p>
      <p class="text-[13px] text-zinc-300">${CB_SISTEMAS[cb.sistema].resumo}</p>
    </div>`}

  <div class="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
    <span class="text-amber-400">⚠️</span>
    <p class="text-amber-200/90 text-[13px]">O sistema de pontos e peso dos jogos <b>não pode ser editado</b> após a criação do grupo.</p>
  </div>`;
}

function _cbKnobsCustom() {
  const k = (campo, rotulo, hint) => `
    <div class="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div class="pr-3"><p class="text-[13px] font-bold">${rotulo}</p><p class="text-[10px] text-zinc-500">${hint}</p></div>
      <input type="number" value="${cb.cfg[campo]}" onchange="cb.cfg.${campo}=parseInt(this.value)||0"
        class="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-center font-black text-emerald-300 outline-none">
    </div>`;
  return `
  <div class="mt-3 rounded-2xl bg-white/5 border border-emerald-500/20 p-4">
    <p class="text-[11px] uppercase tracking-widest text-emerald-400 font-black mb-2">Personalizar valores</p>
    ${k('base_piso', 'Pontuação mínima', 'acertou o favorito absoluto (>90%)')}
    ${k('base_teto', 'Pontuação máxima', 'teto da zebra')}
    ${k('bonus_exato', 'Placar Exato', 'palpite 2x1, placar 2x1')}
    ${k('bonus_placar_vencedor', 'Placar do Vencedor', 'palpite 2x1, placar 2x0')}
    ${k('bonus_diferenca', 'Diferença de Gols', 'palpite 3x0, placar 5x2')}
    ${k('bonus_gols_perdedor', 'Gols do Perdedor', 'palpite 2x1, placar 3x1')}
    ${k('bonus_goleada', 'Goleada (4+ gols)', 'palpitou 4+ e aconteceu')}
    ${k('extra_prorrogacao', 'Prorrogação', 'acertou quem vence na prorrogação')}
    ${k('extra_penaltis', 'Pênaltis', 'acertou quem vence nos pênaltis')}
  </div>`;
}

// -------- PASSO 6: Pesos --------
function cbPasso6() {
  return `
  <h2 class="text-3xl font-black mb-1">Peso dos Pontos</h2>
  <p class="text-zinc-400 text-sm mb-6">Defina como os pontos variam ao longo do campeonato</p>

  ${Object.entries(CB_PESOS).map(([id, p]) => `
    <div onclick="cb.pesoModo='${id}';cbRender()"
      class="rounded-3xl border p-4 mb-3 flex items-center gap-4 cursor-pointer transition-all
      ${cb.pesoModo === id ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400/30' : 'border-white/10 bg-white/5'}">
      <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl shrink-0">${p.icone}</div>
      <div class="flex-1 min-w-0">
        <p class="font-black text-[15px]">${p.nome}</p>
        <p class="text-zinc-400 text-[12px] leading-snug">${p.desc}</p>
      </div>
      <div class="flex flex-col items-end gap-1.5 shrink-0">
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation();cbModalPesos()" class="w-8 h-8 rounded-full bg-white/10 text-zinc-300 text-sm font-bold">?</button>
          ${cb.pesoModo === id ? '<div class="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black">✓</div>' : ''}
        </div>
        ${p.rec ? '<span class="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Recomendado</span>' : ''}
      </div>
    </div>`).join('')}`;
}

// -------- PASSO 7: Desempate --------
function cbPasso7() {
  return `
  <h2 class="text-3xl font-black mb-1">Critérios de Desempate</h2>
  <p class="text-zinc-400 text-sm mb-6">Em caso de empate na pontuação, os critérios abaixo são aplicados em ordem. O primeiro critério diferente entre os empatados define quem fica na frente.</p>
  ${CB_DESEMPATE.map((c, i) => `
    <div class="rounded-2xl bg-white/5 border border-white/10 p-3.5 mb-2 flex items-center gap-3.5">
      <div class="w-8 h-8 rounded-full bg-emerald-900/60 text-emerald-300 flex items-center justify-center text-[13px] font-black shrink-0">${i + 1}</div>
      <div><p class="font-black text-[14px]">${c[0]}</p><p class="text-zinc-400 text-[12px]">${c[1]}</p></div>
    </div>`).join('')}
  <p class="text-[11px] text-zinc-500 mt-3">⚖️ A ordem é fixa — igual pra todos os bolões.</p>`;
}

// -------- PASSO 8: Revisão --------
function cbPasso8() {
  const ic = (CB_ICONES.find(i => i.id === cb.icone) || CB_ICONES[0]).emoji;
  const nJogos = cb._fixtures ? _cbJogosFiltrados().length : '—';
  const nEquipes = cb.equipesModo === 'todas' ? (cb._times ? cb._times.length : 20) : cb.equipesSel.size;
  const linha = (l, v) => `
    <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span class="text-zinc-400 text-[13px]">${l}</span><span class="font-black text-[13px] text-right">${v}</span>
    </div>`;
  return `
  <h2 class="text-3xl font-black mb-1">Revisão</h2>
  <p class="text-zinc-400 text-sm mb-6">Confere tudo antes de criar — sistema e pesos não mudam depois</p>

  <div class="rounded-3xl bg-white/5 border border-white/10 p-5 mb-4">
    <div class="flex items-center gap-3 mb-2">
      <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-2xl">${ic}</div>
      <p class="text-xl font-black">${cb.nome || '—'}</p>
    </div>
    ${linha('Campeonato', `${CB_CAMPEONATO_ATIVO.nome} ${CB_CAMPEONATO_ATIVO.season}`)}
    ${linha('Equipes', nEquipes + ' seleções')}
    ${linha('Jogos', nJogos + ' jogos')}
    ${linha('Sistema de pontos', CB_SISTEMAS[cb.sistema].nome)}
    ${linha('Peso dos jogos', CB_PESOS[cb.pesoModo].nome)}
    ${linha('Desempate', '8 critérios em ordem')}
  </div>

  <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3 flex items-center justify-between">
    <div><p class="font-black text-[14px]">Grupo privado</p><p class="text-zinc-400 text-[11px]">Só entra quem tiver o código</p></div>
    <button onclick="cb.privado=!cb.privado;cbRender()" class="w-12 h-7 rounded-full transition-colors relative ${cb.privado ? 'bg-emerald-500' : 'bg-zinc-700'}">
      <div class="w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${cb.privado ? 'right-1' : 'left-1'}"></div>
    </button>
  </div>
  <div class="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
    <div><p class="font-black text-[14px]">Limite de participantes</p></div>
    <input type="number" value="${cb.maxParticipantes}" min="2" max="100" onchange="cb.maxParticipantes=parseInt(this.value)||20"
      class="w-16 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-center font-black text-emerald-300 outline-none">
  </div>`;
}

// -------- card de opção genérico (Todas/Selecionar) --------
function _cbCardOpcao(onclick, ativo, icone, titulo, sub, rec) {
  return `
  <div onclick="${onclick}"
    class="rounded-3xl border p-4 mb-3 flex items-center gap-4 cursor-pointer transition-all
    ${ativo ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400/30' : 'border-white/10 bg-white/5'}">
    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl shrink-0">${icone}</div>
    <div class="flex-1"><p class="font-black text-[15px]">${titulo}</p><p class="text-zinc-400 text-[12px]">${sub}</p></div>
    <div class="flex flex-col items-end gap-1.5">
      ${ativo ? '<div class="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black">✓</div>' : ''}
      ${rec ? '<span class="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Recomendado</span>' : ''}
    </div>
  </div>`;
}

// ============================================================
// MODAIS EXPLICATIVOS
// ============================================================
function _cbModal(titulo, html) {
  const wrap = document.getElementById('cb-modal');
  wrap.innerHTML = `
    <div class="absolute inset-0 bg-black/80" onclick="cbFecharModal()"></div>
    <div class="relative w-full max-w-md mx-auto h-full sm:h-auto sm:max-h-[92vh] sm:my-6 sm:rounded-3xl overflow-hidden flex flex-col bg-gradient-to-b from-[#0b1a14] to-[#07110d] border border-white/10">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <p class="text-lg font-black">${titulo}</p>
        <button onclick="cbFecharModal()" class="w-9 h-9 rounded-full bg-white/10 font-black">✕</button>
      </div>
      <div class="overflow-y-auto p-5" id="cb-modal-body">${html}</div>
    </div>`;
  wrap.classList.remove('hidden');
}
function cbFecharModal() { const w = document.getElementById('cb-modal'); w.classList.add('hidden'); w.innerHTML = ''; }

// ---- modal "Como funciona" (sistema de pontos) ----
let _cbDemo = { brasil: 80, empate: 15, haiti: 5, teste: 21 };
function cbModalComoFunciona() {
  _cbModal('Como funciona', `
    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-1.5">O Coração da Estratégia</p>
      <p class="text-zinc-400 text-[13px] leading-relaxed">A pontuação base é o "termômetro" do seu palpite: quanto <b class="text-white">menor a chance</b> de um time ganhar, <b class="text-white">mais pontos</b> ele vale. Maior o risco, maior a glória. Piso de <b class="text-emerald-300">5 pts</b> (favorito absoluto) e teto de <b class="text-emerald-300">20 pts</b> (zebra épica).</p>
    </div>

    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-3">Probabilidades <span class="text-zinc-500 text-[11px] font-normal">(mexa e veja os pontos)</span></p>
      <div class="grid grid-cols-3 gap-2 text-center" id="cb-demo-probs">${_cbDemoProbsHTML()}</div>
    </div>

    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-1">Teste Você Mesmo</p>
      <p class="text-zinc-400 text-[12px] mb-3">Escolha a probabilidade de vitória e veja quantos pontos vale acertar:</p>
      <input type="range" min="2" max="95" value="${_cbDemo.teste}" oninput="_cbDemo.teste=parseInt(this.value);_cbDemoTesteRender()" class="w-full accent-emerald-400">
      <div id="cb-demo-teste" class="text-center mt-3">${_cbDemoTesteHTML()}</div>
    </div>

    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-2">Bônus <span class="text-zinc-500 text-[11px] font-normal">(somam à base; só valem acertando o vencedor)</span></p>
      ${[['🟢 Placar Exato', '+5'], ['🔵 Placar do Vencedor', '+3'], ['🩵 Diferença de Gols', '+2'], ['🟣 Gols do Perdedor', '+1'], ['🟠 Goleada 4+ (extra)', '+1']].map(b => `
        <div class="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-[13px]"><span>${b[0]}</span><span class="font-black text-emerald-300">${b[1]} pts</span></div>`).join('')}
    </div>

    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-2">Tempo Extra (mata-mata)</p>
      <p class="text-zinc-400 text-[13px] leading-relaxed mb-2">Palpites separados, valem <b class="text-white">independente do seu placar dos 90'</b>:</p>
      ${[['⏱️ Quem vence na prorrogação', '+3'], ['🥅 Quem vence nos pênaltis', '+3']].map(b => `
        <div class="flex justify-between py-1.5 text-[13px]"><span>${b[0]}</span><span class="font-black text-emerald-300">${b[1]} pts</span></div>`).join('')}
    </div>

    <div class="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4">
      <p class="text-[13px] text-emerald-200/90"><b>A Fórmula:</b> Pontos = Lógica de Risco × Probabilidade. As probabilidades são atualizadas pelas estatísticas reais do futebol e congeladas na trava do palpite — ninguém sai perdendo na matemática.</p>
    </div>`);
}
function _cbDemoProbsHTML() {
  const c = (rot, campo) => {
    const v = _cbDemo[campo];
    const pts = pontosBaseMercado(v);
    return `
    <div>
      <p class="text-[11px] text-zinc-400 font-bold mb-1">${rot}</p>
      <div class="flex items-center justify-center gap-1.5">
        <button onclick="_cbDemoAjusta('${campo}',-5)" class="w-7 h-7 rounded-full bg-white/10 font-black text-sm">−</button>
        <span class="font-black text-lg w-9">${v}</span>
        <button onclick="_cbDemoAjusta('${campo}',5)" class="w-7 h-7 rounded-full bg-white/10 font-black text-sm">+</button>
      </div>
      <div class="mt-2 rounded-lg border border-emerald-500/40 py-1 text-emerald-300 font-black text-[13px]">${pts} pts</div>
    </div>`;
  };
  return c('Brasil %', 'brasil') + c('Empate %', 'empate') + c('Haiti %', 'haiti');
}
function _cbDemoAjusta(campo, d) {
  _cbDemo[campo] = Math.min(95, Math.max(2, _cbDemo[campo] + d));
  const el = document.getElementById('cb-demo-probs');
  if (el) el.innerHTML = _cbDemoProbsHTML();
}
function _cbDemoTesteHTML() {
  const p = _cbDemo.teste, pts = pontosBaseMercado(p);
  const rot = p >= 70 ? 'Favorito claro' : p >= 40 ? 'Jogo parelho' : p >= 18 ? 'Azarão respeitável' : 'Zebra das brabas';
  const frase = p >= 70 ? 'O óbvio às vezes acontece. Prêmio honesto.' : p >= 40 ? 'Ninguém sabe de nada — pontos justos.' : p >= 18 ? "Um choque se ganhar, mas daqueles que a gente fala 'eu sabia'." : 'Se cravar isso, vira lenda no grupo. 🐐';
  return `
    <p class="text-emerald-300 text-[12px] font-bold mb-2">${rot}</p>
    <div class="flex items-center justify-center gap-6">
      <div><p class="text-3xl font-black">${p}%</p><p class="text-[10px] text-zinc-500 uppercase tracking-widest">chance de vitória</p></div>
      <div class="w-px h-10 bg-white/10"></div>
      <div><p class="text-3xl font-black text-emerald-300">${pts} pts</p><p class="text-[10px] text-zinc-500 uppercase tracking-widest">se acertar</p></div>
    </div>
    <p class="text-zinc-400 text-[12px] mt-2">${frase}</p>`;
}
function _cbDemoTesteRender() { const el = document.getElementById('cb-demo-teste'); if (el) el.innerHTML = _cbDemoTesteHTML(); }

// ---- modal "O peso dos jogos" ----
function cbModalPesos() {
  const modo = cb.pesoModo;
  const fx = cb._fixtures && cb._fixtures.length ? cb._fixtures : null;
  const blocos = fx ? _cbContagemFases(fx, modo) : _cbBlocosEstaticos(modo);
  const CORES = { 1: 'bg-slate-500', 2: 'bg-teal-600', 3: 'bg-emerald-500', 4: 'bg-amber-500', 6: 'bg-red-500' };
  const CORES_TXT = { 1: 'text-slate-300 border-slate-500/50', 2: 'text-teal-300 border-teal-500/50', 3: 'text-emerald-300 border-emerald-500/50', 4: 'text-amber-300 border-amber-500/50', 6: 'text-red-300 border-red-500/50' };

  // waffle: 104 quadradinhos na ordem cronológica, coloridos pelo peso
  let waffle = '';
  if (fx) {
    const ordenados = [...fx].sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    waffle = ordenados.map(f => {
      const p = pesoDaFaseV2((f.league && f.league.round) || '', modo);
      return `<div class="rounded-[4px] ${CORES[p] || 'bg-slate-500'}" style="width:100%;aspect-ratio:1"></div>`;
    }).join('');
  }

  _cbModal('O peso dos jogos', `
    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black text-lg mb-0.5">A regra para todos</p>
      <p class="text-zinc-400 text-[12px] mb-4">O peso de pontos de cada fase da competição — modo <b class="text-white">${CB_PESOS[modo].nome}</b>.</p>
      <div class="grid grid-cols-3 gap-2">
        ${blocos.map(b => `
          <div class="rounded-2xl border ${CORES_TXT[b.peso] || ''} bg-black/20 p-3">
            <p class="text-[10px] font-black uppercase leading-tight mb-2">${b.rotulo}</p>
            <span class="inline-block rounded-lg border ${CORES_TXT[b.peso] || ''} px-2 py-0.5 text-[12px] font-black">${b.peso}×</span>
            <p class="text-2xl font-black mt-2">${b.jogos}</p>
            <p class="text-[10px] text-zinc-500">jogo${b.jogos > 1 ? 's' : ''}</p>
          </div>`).join('')}
      </div>
    </div>

    ${fx ? `
    <div class="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
      <p class="font-black mb-0.5">Os ${fx.length} jogos, um por um</p>
      <p class="text-zinc-400 text-[12px] mb-3">Cada bloco é um jogo, colorido pelo seu peso (em ordem cronológica).</p>
      <div class="grid gap-1" style="grid-template-columns:repeat(15,1fr)">${waffle}</div>
      <div class="flex flex-wrap gap-3 mt-3">
        ${blocos.map(b => `<span class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300"><span class="w-3 h-3 rounded ${CORES[b.peso]}"></span>${b.rotulo} · ${b.peso}×</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4">
      <p class="text-emerald-400 text-[11px] font-black uppercase tracking-widest mb-1.5">A sacada</p>
      <p class="text-[13px] text-emerald-100/90 leading-relaxed">${_cbSacada(modo)}</p>
    </div>`);
}
function _cbBlocosEstaticos(modo) {
  const base = { gradual: [['Fase Grupos', 1, 72], ['Fase Final', 2, 31], ['A Final', 4, 1]],
    acelerado: [['1ª Rodada', 1, 24], ['2ª Rodada', 2, 24], ['3ª Rodada', 3, 24], ['Fase Final', 4, 31], ['A Final', 6, 1]],
    unico_final_dobro: [['Todos os jogos', 1, 103], ['A Final', 2, 1]],
    unico: [['Todos os jogos', 1, 104]] };
  return (base[modo] || base.unico).map(b => ({ rotulo: b[0], peso: b[1], jogos: b[2] }));
}
function _cbSacada(modo) {
  return {
    gradual: 'Esse sistema começa suave e vai pegando fogo. A fase de grupos testa o palpiteiro, a eliminatória separa quem é craque de quem está passeando pelo bolão. E a final será simplesmente emocionante.',
    acelerado: 'Zebras da 1ª rodada quase não doem. Zerar a final custa caríssimo. Combina com grupos que querem final pra decidir tudo — e reviravoltas improváveis até o último minuto.',
    unico_final_dobro: 'Simples e direto: consistência vence, mas a final ainda dá aquela apimentada — dá pra virar no último jogo.',
    unico: 'Modo raiz: todo jogo vale igual, do primeiro ao último. Vence quem for consistente a Copa inteira.'
  }[modo] || '';
}

// ============================================================
// CRIAR O GRUPO (grava no banco)
// ============================================================
async function cbCriar() {
  const btn = document.getElementById('cb-btn-continuar');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

  try {
    const { data: { user } } = await sbClient.auth.getUser();
    const codigo = Math.random().toString(36).substring(2, 9).toUpperCase();

    // filtro de jogos (null = todos)
    let filtro = null;
    if (cb.equipesModo === 'sel' && cb.equipesSel.size) filtro = { equipes: [...cb.equipesSel] };
    if (cb.jogosModo === 'fases' && cb.fasesSel.size) filtro = Object.assign(filtro || {}, { fases: [...cb.fasesSel] });

    // sistema clássico reaproveita o motor legado (colunas pt_*); os demais usam o V2
    const ehClassico = cb.sistema === 'classico';
    const row = {
      name: cb.nome.trim(),
      invite_code: codigo,
      owner_id: user.id,
      league_id: cb.leagueId,
      max_participants: cb.maxParticipantes,
      privado: cb.privado,
      icone: cb.icone,
      sistema_pontos: cb.sistema,
      config_pontos: ehClassico ? null : cb.cfg,
      peso_modo: cb.pesoModo,
      filtro_jogos: filtro,
      // legado: clássico usa a cascata; V2 zera pra não interferir
      pt_placar_exato: ehClassico ? 12 : 0,
      pt_vencedor_saldo: ehClassico ? 7 : 0,
      pt_empate_nao_exato: ehClassico ? 6 : 0,
      pt_apenas_vencedor: ehClassico ? 3 : 0,
      pt_vencedor_gols_time: 0, pt_vencedor_gols_perdedor: 0, pt_gols_um_time: 0,
      mult_fase_final: ehClassico ? 2 : 1,
      regra_zebra_dinamica: false
    };

    const { data: novo, error } = await sbClient.from('groups').insert([row]).select().single();
    if (error) throw error;

    await sbClient.from('group_members').insert([{ group_id: novo.id, user_id: user.id, role: 'owner' }]);

    showToast(`🏆 Bolão "${cb.nome.trim()}" criado! Código: ${codigo}`, 'success');
    if (typeof navInvalidarGrupos === 'function') navInvalidarGrupos();
    switchView('view-inicio');
    if (typeof carregarGrupos === 'function') carregarGrupos();
  } catch (e) {
    console.error('cbCriar:', e);
    showToast('Erro ao criar o bolão: ' + (e.message || e), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🏆 Criar Bolão'; }
  }
}

function cbSair() { cbFecharModal(); switchView('view-inicio'); }
