// ============================================================
// FAZER PALPITE V2 — overlay completo (SUPER UPDATE)
// Steppers + abas Estatísticas/Pontos/Social + prorrogação →
// pênaltis (mata-mata, sistema V2) + AUTO-PRÓXIMO jogo.
// Salva no mesmo esquema do fluxo antigo (upsert matches -> guesses).
// Depende dos helpers de js/palpites.js (_palSigla, _palMeuPalpite...).
// ============================================================

const _PAL_API_HEADERS = { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5' };
let _palM = null;                 // estado do overlay
let _palOddsCache = {};           // fixtureId -> {home,draw,away} (%)
let _palLast5Cache = {};          // teamId -> fixtures[]
let _palStandCache = null;        // standings normalizados

function _palApi(caminho) {
  return fetch('https://v3.football.api-sports.io/' + caminho, { headers: _PAL_API_HEADERS }).then(r => r.json());
}

// ---------- abrir / fechar ----------
async function palAbrirPalpite(id) {
  const jogo = (todosOsJogos || []).find(j => j.fixture.id === id);
  if (!jogo) { if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(id); return; }

  const g = grupoAtual || {};
  const sist = g.sistema_pontos || 'classico';
  const ehV2 = (sist === 'mercado' || sist === 'custom');
  const kickoff = new Date(jogo.fixture.date);
  const fechado = new Date() > new Date(kickoff.getTime() - 10 * 60 * 1000);
  const encerrado = _palJogoEncerrado(jogo);
  const round = (jogo.league && jogo.league.round) || '';
  const mata = (typeof faseDoJogoV2 === 'function') ? faseDoJogoV2(round).mataMata : /round of|quarter|semi|final/i.test(round);

  const meu = _palMeuPalpite(id);
  _palM = {
    id, jogo, sist, ehV2, round,
    locked: fechado || encerrado,
    temExtras: ehV2 && mata && !(fechado || encerrado),
    etapa: 'placar', tab: 'stats',
    h: meu ? meu.score_home : 0, a: meu ? meu.score_away : 0,
    extra: { prorrogacao: null, penaltis: null },
    probs: _palOddsCache[id] || null,
    peso: _palPesoDoJogo(round),
    cfg: Object.assign({}, (typeof PONTOS_V2_DEFAULTS !== 'undefined' ? PONTOS_V2_DEFAULTS : {}), g.config_pontos || {})
  };

  _palMRender();

  // extras já salvos (busca a linha completa — à prova de coluna faltando)
  try {
    const { data: { user } } = await sbClient.auth.getUser();
    const { data: row } = await sbClient.from('guesses').select('*')
      .eq('user_id', user.id).eq('group_id', g.id).eq('match_id', id).maybeSingle();
    if (row && _palM && _palM.id === id) {
      _palM.extra.prorrogacao = row.palpite_prorrogacao || null;
      _palM.extra.penaltis = row.palpite_penaltis || null;
    }
  } catch (e) {}

  // cargas em paralelo
  _palCarregarProbs(id, jogo);
  _palCarregarUltimos(jogo);
  _palCarregarClassif(jogo);
  _palCarregarSocial(id);
}

function palFecharPalpite() {
  const w = document.getElementById('pal-modal');
  if (w) { w.classList.add('hidden'); w.innerHTML = ''; }
  _palM = null;
  if (typeof renderPalpitesV2 === 'function') renderPalpitesV2();
}

function _palPesoDoJogo(round) {
  const g = grupoAtual || {};
  if (g.sistema_pontos && g.sistema_pontos !== 'classico' && g.peso_modo && typeof pesoDaFaseV2 === 'function') {
    return pesoDaFaseV2(round, g.peso_modo);
  }
  const mata = /round of|oitavas|quartas|semi|final/i.test(round || '');
  return mata ? (g.mult_fase_final || 1) : 1;
}

// ---------- render ----------
function _palMRender() {
  const w = document.getElementById('pal-modal');
  if (!w || !_palM) return;
  const m = _palM;
  const h = m.jogo.teams.home, a = m.jogo.teams.away;
  const kickoff = new Date(m.jogo.fixture.date);
  const dataStr = kickoff.getDate() + ' de ' + _PAL_MESES[kickoff.getMonth()].toLowerCase() + ', ' + kickoff.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h';

  let corpo, footer;
  if (m.etapa === 'prorrogacao' || m.etapa === 'penaltis') {
    const ehPro = m.etapa === 'prorrogacao';
    const sel = ehPro ? m.extra.prorrogacao : m.extra.penaltis;
    const valor = (ehPro ? (m.cfg.extra_prorrogacao ?? 3) : (m.cfg.extra_penaltis ?? 3)) * m.peso;
    const card = (lado, rotulo, img) => `
      <button onclick="palMSelExtra('${m.etapa}','${lado}')"
        class="flex-1 max-w-[110px] rounded-2xl border p-4 flex flex-col items-center gap-2.5 transition-all active:scale-95
        ${sel === lado ? 'border-brand-green bg-brand-green/10 ring-1 ring-brand-green/40' : 'border-white/10 bg-card-bg'}">
        ${img ? `<img src="${img}" class="w-14 h-10 rounded-lg object-cover">` : '<div class="w-14 h-10 rounded-lg bg-white/10 flex items-center justify-center font-black text-lg">=</div>'}
        <span class="text-[12px] font-bold">${rotulo}</span>
      </button>`;
    corpo = `
      <div class="text-center pt-4 pb-2">
        <p class="font-black text-lg">${ehPro ? 'Prorrogação' : 'Pênaltis'}</p>
        <p class="text-[11px] text-text-muted">${ehPro ? '1 de 2' : '2 de 2'}</p>
      </div>
      <h2 class="text-center text-xl font-black px-8 mb-6 leading-snug">Se o jogo for para ${ehPro ? 'prorrogação' : 'pênaltis'}, quem vai vencer?</h2>
      <div class="flex justify-center gap-3 px-4 mb-5">
        ${card('home', h.name, h.logo)}
        ${ehPro ? card('empate', 'Empate', null) : ''}
        ${card('away', a.name, a.logo)}
      </div>
      <p class="text-center"><span class="inline-block bg-brand-green/10 border border-brand-green/25 text-brand-green text-[12px] font-bold px-4 py-1.5 rounded-full">⭐ vale ${valor} pontos · Soma ao ranking geral</span></p>
      <p class="text-center text-[12px] text-text-muted mt-4 px-8">DICA: você pode pontuar aqui independente do seu palpite nos 90 minutos${ehPro ? '' : ' ou na prorrogação'}.</p>`;
    footer = `
      <button onclick="palMVoltarEtapa()" class="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-lg shrink-0">‹</button>
      <button onclick="palMContinuar()" ${sel ? '' : 'disabled'} class="flex-1 py-3.5 rounded-2xl font-black text-[14px] transition-all ${sel ? 'bg-brand-green text-black' : 'bg-white/5 text-text-muted'}">${sel ? (ehPro ? 'Continuar →' : '✓ Salvar palpite') : 'Selecione uma opção'}</button>`;
  } else {
    // ----- etapa PLACAR -----
    const stepper = (lado, valor) => m.locked
      ? `<span class="text-3xl font-black w-10 text-center">${valor}</span>`
      : `<div class="flex items-center gap-2">
          <button onclick="palMAjusta('${lado}',-1)" class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 font-black text-lg active:scale-90">−</button>
          <span class="text-3xl font-black w-9 text-center">${valor}</span>
          <button onclick="palMAjusta('${lado}',1)" class="w-10 h-10 rounded-xl bg-white/10 border border-white/20 font-black text-lg active:scale-90">+</button>
        </div>`;

    const TAB_A = 'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black bg-brand-green/15 text-brand-green transition-all';
    const TAB_I = 'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-text-muted transition-all';

    corpo = `
      <p class="text-center text-[12px] text-text-muted pt-3">${dataStr}</p>
      ${m.locked ? '<p class="text-center text-[11px] font-bold text-amber-300 mt-1">🔒 palpites fechados — modo consulta</p>' : ''}
      <div class="flex items-start justify-center gap-6 px-4 mt-4 mb-5">
        <div class="flex flex-col items-center gap-2 w-28">
          <img src="${h.logo}" class="w-16 h-11 rounded-lg object-cover shadow-lg">
          <span class="text-[12px] font-black text-center uppercase leading-tight">${h.name}</span>
          ${stepper('h', m.h)}
        </div>
        <span class="text-text-muted font-black italic text-xl mt-8 opacity-50">VS</span>
        <div class="flex flex-col items-center gap-2 w-28">
          <img src="${a.logo}" class="w-16 h-11 rounded-lg object-cover shadow-lg">
          <span class="text-[12px] font-black text-center uppercase leading-tight">${a.name}</span>
          ${stepper('a', m.a)}
        </div>
      </div>
      <div class="mx-4 flex bg-card-bg border border-white/5 rounded-2xl p-1 mb-4">
        <button onclick="palMTab('stats')" class="${m.tab === 'stats' ? TAB_A : TAB_I}">📊 Estatísticas</button>
        <button onclick="palMTab('pontos')" class="${m.tab === 'pontos' ? TAB_A : TAB_I}">🧮 Pontos</button>
        <button onclick="palMTab('social')" class="${m.tab === 'social' ? TAB_A : TAB_I}">👥 Social</button>
      </div>
      <div class="px-4 pb-4" id="palm-tab-corpo">${_palMTabCorpo()}</div>`;

    footer = m.locked
      ? `<button onclick="palFecharPalpite()" class="flex-1 py-3.5 rounded-2xl bg-white/10 font-black text-[14px]">Fechar</button>`
      : `<div class="flex-1 flex flex-col gap-1.5">
          <button onclick="palMContinuar()" class="w-full py-3.5 rounded-2xl bg-brand-green text-black font-black text-[14px] active:scale-[0.98] transition-all">${m.temExtras ? 'Continuar →' : '✓ Salvar palpite'}</button>
          <button onclick="palMDepois()" class="w-full py-1.5 text-[13px] font-bold text-text-muted">Palpitar depois</button>
        </div>`;
  }

  w.innerHTML = `
    <div class="absolute inset-0 bg-black/85" onclick="palFecharPalpite()"></div>
    <div class="relative w-full max-w-md mx-auto h-full flex flex-col bg-app-bg sm:my-4 sm:h-auto sm:max-h-[94vh] sm:rounded-3xl sm:border sm:border-white/10 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0" style="padding-top: max(0.9rem, env(safe-area-inset-top));">
        <div class="w-9"></div>
        <p class="font-black text-[16px]">Fazer Palpite</p>
        <button onclick="palFecharPalpite()" class="w-9 h-9 rounded-full bg-white/10 font-black">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto">${corpo}</div>
      <div class="shrink-0 flex items-center gap-3 px-4 pt-3 border-t border-white/10" style="padding-bottom: max(1rem, env(safe-area-inset-bottom));">${footer}</div>
    </div>`;
  w.classList.remove('hidden');
}

function _palMTabCorpo() {
  const m = _palM;
  if (m.tab === 'pontos') return _palMTabPontos();
  if (m.tab === 'social') return `<div id="palm-social"><p class="text-text-muted text-[12px] text-center py-6 animate-pulse">Carregando o grupo...</p></div>`;
  // stats
  return `
    <p class="text-[10px] uppercase tracking-widest text-text-muted font-black mb-2">Chances de ganhar</p>
    <div id="palm-chances" class="mb-4"><p class="text-text-muted text-[12px] text-center py-4 animate-pulse">Buscando as odds...</p></div>
    <p class="text-[10px] uppercase tracking-widest text-text-muted font-black mb-2">Últimos jogos</p>
    <div id="palm-ultimos" class="mb-4"><p class="text-text-muted text-[12px] text-center py-4 animate-pulse">Carregando a forma...</p></div>
    <p class="text-[10px] uppercase tracking-widest text-text-muted font-black mb-2">Classificação nos grupos</p>
    <div id="palm-classif"><p class="text-text-muted text-[12px] text-center py-4 animate-pulse">Carregando os grupos...</p></div>`;
}

// ---------- aba PONTOS ----------
function _palMTabPontos() {
  const m = _palM, g = grupoAtual || {};
  const h = m.jogo.teams.home, a = m.jogo.teams.away;
  const peso = m.peso;
  const pesoBadge = `<span class="bg-brand-green/15 text-brand-green text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">Peso: ×${peso}</span>`;

  if (m.sist === 'classico') {
    const linhas = [
      ['Placar Exato', (g.pt_placar_exato ?? 12)], ['Vencedor + Saldo', (g.pt_vencedor_saldo ?? 7)],
      ['Empate não-exato', (g.pt_empate_nao_exato ?? 6)], ['Apenas o Vencedor', (g.pt_apenas_vencedor ?? 3)]
    ].filter(l => l[1] > 0);
    return `
      <div class="rounded-2xl bg-card-bg border border-white/5 p-4">
        <div class="flex items-center justify-between mb-3"><p class="text-[10px] uppercase tracking-widest text-text-muted font-black">Escala do grupo (cascata)</p>${pesoBadge}</div>
        ${linhas.map(l => `<div class="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-[13px]"><span>${l[0]}</span><span class="font-black text-brand-green">+${l[1] * peso}</span></div>`).join('')}
        <p class="text-[11px] text-text-muted mt-2.5">valores já incluem o peso da fase${g.regra_zebra_dinamica ? ' · 🦓 zebra dinâmica pode DOBRAR' : ''}</p>
      </div>`;
  }

  // sistemas V2
  const p = m.probs;
  const basePts = (prob) => (p && typeof pontosBaseMercado === 'function') ? pontosBaseMercado(prob, m.cfg) * peso : null;
  const col = (rot, prob) => `
    <div class="text-center flex-1">
      <p class="text-[11px] text-zinc-300 font-bold mb-1">${rot}</p>
      <p class="text-2xl font-black ${(m.sist === 'so_vencedor' || basePts(prob)) ? '' : 'text-text-muted'}">${m.sist === 'so_vencedor' ? (m.cfg.base_fixa ?? 5) * peso : (basePts(prob) ?? '—')}</p>
      <span class="inline-block bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-bold mt-1">${prob != null ? prob + '%' : '?'}</span>
    </div>`;
  const bonus = [
    ['Placar Exato', m.cfg.bonus_exato], ['Placar do Vencedor', m.cfg.bonus_placar_vencedor],
    ['Diferença de gols', m.cfg.bonus_diferenca], ['Placar do Perdedor', m.cfg.bonus_gols_perdedor],
    ['Goleada (4+)', m.cfg.bonus_goleada]
  ].filter(b => (b[1] || 0) > 0);
  const extras = (typeof faseDoJogoV2 === 'function' && faseDoJogoV2(m.round).mataMata)
    ? [['Prorrogação', m.cfg.extra_prorrogacao], ['Pênaltis', m.cfg.extra_penaltis]].filter(b => (b[1] || 0) > 0) : [];

  return `
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4 mb-3">
      <div class="flex items-center justify-between mb-3"><p class="text-[10px] uppercase tracking-widest text-text-muted font-black">Pontos por acertar o vencedor</p>${pesoBadge}</div>
      <div class="flex gap-2">${col(_palSigla(h.name), p ? p.home : null)}${m.sist !== 'so_vencedor' ? col('Empate', p ? p.draw : null) : ''}${col(_palSigla(a.name), p ? p.away : null)}</div>
      <p class="text-center text-[11px] text-text-muted mt-2.5">${p ? 'chance de vencer · valores já incluem o peso' : 'probabilidades chegam quando as odds abrem'}</p>
    </div>
    ${m.sist !== 'so_vencedor' && (bonus.length || extras.length) ? `
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4">
      <p class="text-[10px] uppercase tracking-widest text-text-muted font-black mb-2">Bônus (pontos extras)</p>
      ${bonus.map(b => `<div class="flex justify-between py-1.5 border-b border-white/5 text-[13px]"><span>${b[0]}</span><span class="font-black text-brand-green">+${b[1] * peso}</span></div>`).join('')}
      ${extras.map(b => `<div class="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-[13px]"><span>⏱️ ${b[0]}</span><span class="font-black text-purple-300">+${b[1] * peso}</span></div>`).join('')}
      <p class="text-[11px] text-text-muted mt-2">bônus só valem acertando o vencedor · já incluem o peso</p>
    </div>` : ''}`;
}

// ---------- cargas assíncronas ----------
async function _palCarregarProbs(id, jogo) {
  if (!_palOddsCache[id]) {
    try {
      const j = await _palApi('odds?fixture=' + id);
      const books = (j.response && j.response[0] && j.response[0].bookmakers) || [];
      const soma = { home: 0, draw: 0, away: 0 }; let n = 0;
      books.forEach(b => (b.bets || []).forEach(bet => {
        if (bet.name === 'Match Winner') {
          const v = {}; (bet.values || []).forEach(x => v[x.value] = parseFloat(x.odd));
          if (v.Home && v.Draw && v.Away) { soma.home += 1 / v.Home; soma.draw += 1 / v.Draw; soma.away += 1 / v.Away; n++; }
        }
      }));
      if (n) {
        const t = (soma.home + soma.draw + soma.away);
        _palOddsCache[id] = {
          home: Math.round((soma.home / t) * 100),
          draw: Math.round((soma.draw / t) * 100),
          away: Math.round((soma.away / t) * 100)
        };
        // persiste no matches (dev; em prod sem coluna, o catch engole)
        try {
          await sbClient.from('matches').upsert([{
            id, league_id: jogo.league.id, season: jogo.league.season,
            home_team: jogo.teams.home.name, away_team: jogo.teams.away.name,
            kickoff: jogo.fixture.date, round: jogo.league.round,
            prob_home: _palOddsCache[id].home, prob_draw: _palOddsCache[id].draw,
            prob_away: _palOddsCache[id].away, probs_updated_at: new Date().toISOString()
          }], { onConflict: 'id' });
        } catch (e) {}
      }
    } catch (e) { console.error('odds:', e); }
  }
  if (_palM && _palM.id === id) {
    _palM.probs = _palOddsCache[id] || null;
    _palPreencherChances();
    if (_palM.tab === 'pontos') { const c = document.getElementById('palm-tab-corpo'); if (c) c.innerHTML = _palMTabCorpo(); }
  }
}

function _palPreencherChances() {
  const el = document.getElementById('palm-chances');
  if (!el || !_palM) return;
  const p = _palM.probs;
  if (!p) { el.innerHTML = '<p class="text-text-muted text-[12px] text-center py-3">Odds ainda não abriram pra esse jogo.</p>'; return; }
  const h = _palM.jogo.teams.home, a = _palM.jogo.teams.away;
  const fav = Math.max(p.home, p.draw, p.away);
  const linha = (rot, v, cor, corTxt, ehTime) => `
    <div class="mb-2.5 last:mb-0">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[13px] font-bold flex items-center gap-2">${rot}${ehTime && v === fav ? '<span class="bg-brand-green/15 text-brand-green text-[9px] font-black px-2 py-0.5 rounded-md uppercase">Favorito</span>' : ''}</span>
        <span class="text-[13px] font-black ${corTxt}">${v}%</span>
      </div>
      <div class="h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full ${cor} rounded-full" style="width:${v}%"></div></div>
    </div>`;
  el.innerHTML = `<div class="rounded-2xl bg-card-bg border border-white/5 p-4">
    ${linha(h.name, p.home, 'bg-brand-green', 'text-brand-green', true)}
    ${linha('Empate', p.draw, 'bg-zinc-400', 'text-zinc-300', false)}
    ${linha(a.name, p.away, 'bg-orange-400', 'text-orange-300', true)}
  </div>`;
}

async function _palCarregarUltimos(jogo) {
  const el = () => document.getElementById('palm-ultimos');
  const times = [jogo.teams.home, jogo.teams.away].filter(t => t.id && !/winner|loser/i.test(t.name || ''));
  if (!times.length) { const e = el(); if (e) e.innerHTML = '<p class="text-text-muted text-[12px] text-center py-3">Times ainda não definidos.</p>'; return; }
  try {
    await Promise.all(times.map(async t => {
      if (!_palLast5Cache[t.id]) {
        const j = await _palApi('fixtures?team=' + t.id + '&last=5');
        _palLast5Cache[t.id] = (j.response || []);
      }
    }));
  } catch (e) { console.error('last5:', e); }
  const e = el(); if (!e || !_palM) return;
  e.innerHTML = times.map(t => {
    const fx = _palLast5Cache[t.id] || [];
    const dots = fx.map(f => {
      const casa = f.teams.home.id === t.id;
      const gf = casa ? f.goals.home : f.goals.away, gc = casa ? f.goals.away : f.goals.home;
      const r = gf > gc ? 'v' : (gf < gc ? 'd' : 'e');
      return `<span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${r === 'v' ? 'bg-brand-green/20 text-brand-green' : r === 'd' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-zinc-400'}">${r === 'v' ? '✓' : r === 'd' ? '✕' : '–'}</span>`;
    }).join('');
    const linhas = fx.slice(0, 5).map(f => {
      const casa = f.teams.home.id === t.id;
      const gf = casa ? f.goals.home : f.goals.away, gc = casa ? f.goals.away : f.goals.home;
      const r = gf > gc ? ['Vitória', 'text-brand-green'] : (gf < gc ? ['Derrota', 'text-red-400'] : ['Empate', 'text-zinc-400']);
      const dias = Math.max(1, Math.round((Date.now() - new Date(f.fixture.date)) / 86400000));
      return `<div class="flex items-center gap-2.5 py-1.5 border-b border-white/5 last:border-0 text-[12px]">
        <span class="${r[1]} font-bold w-14">${r[0]}</span>
        <span class="flex-1 text-right font-bold">${_palSigla(f.teams.home.name)}</span>
        <span class="bg-brand-green/15 text-brand-green font-black px-2 py-0.5 rounded-md">${f.goals.home} - ${f.goals.away}</span>
        <span class="flex-1 font-bold">${_palSigla(f.teams.away.name)}</span>
        <span class="text-text-muted text-[10px] w-14 text-right">Há ${dias} dia${dias > 1 ? 's' : ''}</span>
      </div>`;
    }).join('');
    return `<div class="rounded-2xl bg-card-bg border border-white/5 p-3.5 mb-2.5">
      <div class="flex items-center gap-2.5 mb-2"><span class="font-black text-[14px]">${_palSigla(t.name)}</span><div class="flex gap-1">${dots}</div></div>
      ${linhas || '<p class="text-text-muted text-[11px]">sem jogos recentes</p>'}
    </div>`;
  }).join('');
}

async function _palCarregarClassif(jogo) {
  const el = () => document.getElementById('palm-classif');
  try {
    if (!_palStandCache) {
      const liga = (grupoAtual && grupoAtual.league_id) || 1;
      const sj = await _palApi('standings?league=' + liga + '&season=2026');
      let raw = (sj.response && sj.response[0] && sj.response[0].league && sj.response[0].league.standings) || [];
      const dd = (g) => { const v = new Set(); return g.filter(t => { const i = t && t.team && t.team.id; if (i == null || v.has(i)) return false; v.add(i); return true; }); };
      const limpos = raw.filter(g => Array.isArray(g) && g.length).map(dd);
      const reais = limpos.filter(g => { const n = ((g[0] && g[0].group) || '').trim(); return /^group\s+[a-z0-9]+$/i.test(n) && !/^group stage$/i.test(n); });
      _palStandCache = reais.length ? reais : limpos;
    }
  } catch (e) { console.error('standings:', e); }
  const e = el(); if (!e || !_palM) return;
  const ids = [jogo.teams.home.id, jogo.teams.away.id];
  const grupos = (_palStandCache || []).filter(g => g.some(t => ids.includes(t.team.id)));
  if (!grupos.length) { e.innerHTML = '<p class="text-text-muted text-[12px] text-center py-3">Classificação indisponível.</p>'; return; }
  e.innerHTML = grupos.map(g => `
    <div class="rounded-2xl bg-card-bg border border-white/5 overflow-hidden mb-2.5">
      <p class="px-3.5 pt-3 pb-1.5 text-[11px] font-black uppercase tracking-widest text-brand-green">${(g[0].group || '').replace('Group', 'Grupo')}</p>
      <div class="px-2 pb-2">
        <div class="grid grid-cols-[1.6rem_1fr_2rem_1.4rem_1.7rem] text-[10px] text-text-muted font-black px-1.5 py-1"><span></span><span>EQUIPE</span><span class="text-center">PTS</span><span class="text-center">J</span><span class="text-center">SG</span></div>
        ${g.map((t, i) => {
          const destaque = ids.includes(t.team.id);
          return `<div class="grid grid-cols-[1.6rem_1fr_2rem_1.4rem_1.7rem] items-center px-1.5 py-1.5 rounded-lg text-[12px] ${destaque ? 'bg-brand-green/10' : ''} ${i < 2 ? 'border-l-2 border-brand-green/60' : ''}">
            <span class="font-bold text-text-muted">${t.rank}</span>
            <span class="font-bold flex items-center gap-1.5 min-w-0"><img src="${t.team.logo}" class="w-4 h-3 rounded-sm object-cover">${_palSigla(t.team.name)}</span>
            <span class="text-center"><span class="bg-brand-green/15 text-brand-green font-black rounded px-1.5">${t.points}</span></span>
            <span class="text-center text-text-muted">${t.all.played}</span>
            <span class="text-center font-bold ${t.goalsDiff > 0 ? 'text-brand-green' : t.goalsDiff < 0 ? 'text-red-400' : 'text-zinc-400'}">${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

async function _palCarregarSocial(id) {
  try {
    const { data: gs } = await sbClient.from('guesses')
      .select('user_id, score_home, score_away')
      .eq('group_id', grupoAtual.id).eq('match_id', id);
    const { data: membros } = await sbClient.from('group_members').select('user_id').eq('group_id', grupoAtual.id);
    const ids = (membros || []).map(x => x.user_id);
    const { data: perfis } = ids.length ? await sbClient.from('profiles').select('id, full_name, avatar_url').in('id', ids) : { data: [] };
    if (!_palM || _palM.id !== id) return;
    const el = document.getElementById('palm-social'); if (!el) return;

    const mapa = {}; (gs || []).forEach(x => mapa[x.user_id] = x);
    const revela = _palM.locked; // regra do app: palpites só aparecem depois da trava
    const semPalpite = ids.filter(u => !mapa[u]).length;

    el.innerHTML = `
      <div class="rounded-2xl bg-card-bg border border-brand-green/15 p-4 mb-3">
        <p class="font-black text-[14px] flex items-center gap-2 mb-2.5">👥 Atividade do Grupo</p>
        <div class="flex items-center justify-between">
          <div class="flex -space-x-2">${(gs || []).slice(0, 6).map(x => {
            const p = (perfis || []).find(q => q.id === x.user_id);
            const foto = (p && p.avatar_url) || ('https://ui-avatars.com/api/?name=' + encodeURIComponent((p && p.full_name) || '?') + '&background=10b981&color=fff');
            return `<img src="${foto}" class="w-8 h-8 rounded-full border-2 border-app-bg object-cover">`;
          }).join('') || '<span class="text-[12px] text-text-muted">ninguém palpitou ainda</span>'}</div>
          ${semPalpite ? `<div class="text-center bg-amber-400/10 border border-amber-400/25 rounded-xl px-3 py-1.5"><p class="font-black text-amber-300 text-[15px] leading-none">${semPalpite}</p><p class="text-[9px] text-amber-300/80 font-bold">sem palpite</p></div>` : ''}
        </div>
      </div>
      ${ids.map(u => {
        const p = (perfis || []).find(q => q.id === u) || {};
        const palpite = mapa[u];
        const ehVoce = usuarioAtual && usuarioAtual.id === u;
        return `<div class="rounded-2xl bg-card-bg border border-white/5 p-3.5 mb-2 flex items-center gap-3">
          <img src="${p.avatar_url || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(p.full_name || '?') + '&background=27272a&color=fff')}" class="w-9 h-9 rounded-full object-cover">
          <div class="flex-1 min-w-0">
            <p class="font-bold text-[13px] truncate">${p.full_name || 'Participante'}${ehVoce ? ' <span class="text-brand-green text-[10px] font-black">(Você)</span>' : ''}</p>
            <p class="text-[11px] text-text-muted">${palpite ? (revela ? `palpitou <b class="text-white">${palpite.score_home} × ${palpite.score_away}</b>` : '✓ já palpitou') : '🕐 Ainda não palpitou'}</p>
          </div>
          ${palpite ? '<span class="text-brand-green font-black">✓</span>' : ''}
        </div>`;
      }).join('')}
      <div class="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-3.5 flex gap-2.5 mt-1">
        <span class="text-brand-green">🛡️</span>
        <p class="text-[12px] text-zinc-300">Os palpites são revelados quando o jogo começa. Essa é a proteção contra os <b>copiadores de palpite</b>. 😏</p>
      </div>`;
  } catch (e) { console.error('social:', e); }
}

// ---------- interações ----------
function palMAjusta(lado, d) {
  if (!_palM || _palM.locked) return;
  if (lado === 'h') _palM.h = Math.min(20, Math.max(0, _palM.h + d));
  else _palM.a = Math.min(20, Math.max(0, _palM.a + d));
  _palMRender();
}
function palMTab(t) {
  if (!_palM) return;
  _palM.tab = t; _palMRender();
  if (t === 'stats') { _palPreencherChances(); _palCarregarUltimos(_palM.jogo); _palCarregarClassif(_palM.jogo); }
  if (t === 'social') _palCarregarSocial(_palM.id);
}
function palMSelExtra(etapa, lado) { if (!_palM) return; if (etapa === 'prorrogacao') _palM.extra.prorrogacao = lado; else _palM.extra.penaltis = lado; _palMRender(); }
function palMVoltarEtapa() { if (!_palM) return; _palM.etapa = _palM.etapa === 'penaltis' ? 'prorrogacao' : 'placar'; _palMRender(); }
function palMContinuar() {
  if (!_palM) return;
  if (_palM.etapa === 'placar') {
    if (_palM.temExtras) { _palM.etapa = 'prorrogacao'; _palMRender(); return; }
    _palMSalvar(); return;
  }
  if (_palM.etapa === 'prorrogacao') {
    if (!_palM.extra.prorrogacao) return;
    _palM.etapa = 'penaltis'; _palMRender(); return;
  }
  if (_palM.etapa === 'penaltis') {
    if (!_palM.extra.penaltis) return;
    _palMSalvar();
  }
}
function palMDepois() { _palMProximo(false); }

async function _palMSalvar() {
  const m = _palM; if (!m) return;
  try {
    const { data: { user } } = await sbClient.auth.getUser();
    const j = m.jogo;
    // 1. garante o jogo em matches (FK) — mesmo shape do fluxo antigo
    await sbClient.from('matches').upsert([{
      id: j.fixture.id, league_id: j.league.id, season: j.league.season,
      home_team: j.teams.home.name, home_team_id: j.teams.home.id,
      home_logo: (typeof getFlagUrl === 'function' && getFlagUrl(j.teams.home.id)) || j.teams.home.logo || '',
      away_team: j.teams.away.name, away_team_id: j.teams.away.id,
      away_logo: (typeof getFlagUrl === 'function' && getFlagUrl(j.teams.away.id)) || j.teams.away.logo || '',
      kickoff: j.fixture.date, status: j.fixture.status.short,
      score_home: j.goals.home, score_away: j.goals.away,
      minute: j.fixture.status.elapsed != null ? String(j.fixture.status.elapsed) : null,
      round: j.league.round
    }], { onConflict: 'id' });

    // 2. o palpite (extras só entram se o usuário escolheu — à prova de coluna faltando)
    const row = { user_id: user.id, match_id: m.id, group_id: grupoAtual.id, score_home: m.h, score_away: m.a };
    if (m.extra.prorrogacao) row.palpite_prorrogacao = m.extra.prorrogacao;
    if (m.extra.penaltis) row.palpite_penaltis = m.extra.penaltis;
    const { error } = await sbClient.from('guesses').upsert([row], { onConflict: 'user_id,group_id,match_id' });
    if (error) throw error;

    // 3. estado local
    const idx = palpitesUsuario.findIndex(p => p.match_id === m.id);
    if (idx !== -1) { palpitesUsuario[idx].score_home = m.h; palpitesUsuario[idx].score_away = m.a; }
    else palpitesUsuario.push({ match_id: m.id, score_home: m.h, score_away: m.a });

    showToast(`✅ Palpite salvo: ${m.h} × ${m.a}`, 'success');
    _palMProximo(true);
  } catch (e) {
    console.error('salvar palpite v2:', e);
    showToast('Erro ao salvar o palpite: ' + (e.message || e), 'error');
  }
}

// pula pro PRÓXIMO jogo aberto sem palpite (o fluxo contínuo da referência)
function _palMProximo(salvou) {
  const atualId = _palM ? _palM.id : null;
  const agora = new Date();
  const candidatos = (todosOsJogos || [])
    .filter(j => j.fixture.id !== atualId)
    .filter(j => !_palJogoEncerrado(j) && !_palJogoAoVivo(j))
    .filter(j => agora < new Date(new Date(j.fixture.date).getTime() - 10 * 60 * 1000))
    .filter(j => !_palMeuPalpite(j.fixture.id))
    .sort((x, y) => new Date(x.fixture.date) - new Date(y.fixture.date));
  if (candidatos.length) {
    if (salvou) showToast('👉 Próximo jogo sem palpite', 'info');
    palAbrirPalpite(candidatos[0].fixture.id);
  } else {
    palFecharPalpite();
    if (salvou) showToast('🔥 Todos os palpites em dia!', 'success');
  }
}
