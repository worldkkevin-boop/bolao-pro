// ============================================================
//  COPA — Classificação dos grupos + Chaveamento do mata-mata
//  (Etapa 1: visualização com dados reais da API-Football.
//   O palpite no chaveamento vem na Etapa 2, quando os
//   confrontos do mata-mata existirem na API.)
// ============================================================

const COPA_API_HOST = 'v3.football.api-sports.io';
const COPA_API_KEY = '47ca2bb05eb5931347aca04964818eb5';
const COPA_SEASON = 2026;

// Cache simples por sessão pra não bater na API toda hora.
let _copaCache = { leagueId: null, standings: null, knockout: null, ts: 0 };

// Modo da aba Chaveamento: 'projecao' (parcial, da classificação) ou 'reais' (fixtures da API).
let _copaBracketModo = 'projecao';

// Template OFICIAL do Round of 32 da Copa 2026 (cruzamentos por posição no grupo).
// t: 'winner'=1º, 'runner'=2º, 'third'=melhor 3º (bolsão de grupos possíveis).
// Fonte: bracket oficial 2026 (Wikipedia/Sky Sports/ESPN). Os 8 jogos sem 3º
// são projetáveis com exatidão; os com 3º dependem da tabela Annex C (Etapa 2).
// kickoff em UTC (ET + 4h; em jun/jul o leste dos EUA é UTC-4). Exibido em horário de Brasília.
const COPA_R32_TEMPLATE = [
  { n: 73, a: { t: 'runner', g: 'A' }, b: { t: 'runner', g: 'B' }, kickoff: '2026-06-28T19:00:00Z' },
  { n: 74, a: { t: 'winner', g: 'E' }, b: { t: 'third', pool: ['A', 'B', 'C', 'D', 'F'] }, kickoff: '2026-06-29T20:30:00Z' },
  { n: 75, a: { t: 'winner', g: 'F' }, b: { t: 'runner', g: 'C' }, kickoff: '2026-06-30T01:00:00Z' },
  { n: 76, a: { t: 'winner', g: 'C' }, b: { t: 'runner', g: 'F' }, kickoff: '2026-06-29T17:00:00Z' },
  { n: 77, a: { t: 'winner', g: 'I' }, b: { t: 'third', pool: ['C', 'D', 'F', 'G', 'H'] }, kickoff: '2026-06-30T21:00:00Z' },
  { n: 78, a: { t: 'runner', g: 'E' }, b: { t: 'runner', g: 'I' }, kickoff: '2026-06-30T17:00:00Z' },
  { n: 79, a: { t: 'winner', g: 'A' }, b: { t: 'third', pool: ['C', 'E', 'F', 'H', 'I'] }, kickoff: '2026-07-01T01:00:00Z' },
  { n: 80, a: { t: 'winner', g: 'L' }, b: { t: 'third', pool: ['E', 'H', 'I', 'J', 'K'] }, kickoff: '2026-07-01T16:00:00Z' },
  { n: 81, a: { t: 'winner', g: 'D' }, b: { t: 'third', pool: ['B', 'E', 'F', 'I', 'J'] }, kickoff: '2026-07-02T00:00:00Z' },
  { n: 82, a: { t: 'winner', g: 'G' }, b: { t: 'third', pool: ['A', 'E', 'H', 'I', 'J'] }, kickoff: '2026-07-01T20:00:00Z' },
  { n: 83, a: { t: 'runner', g: 'K' }, b: { t: 'runner', g: 'L' }, kickoff: '2026-07-02T23:00:00Z' },
  { n: 84, a: { t: 'winner', g: 'H' }, b: { t: 'runner', g: 'J' }, kickoff: '2026-07-02T19:00:00Z' },
  { n: 85, a: { t: 'winner', g: 'B' }, b: { t: 'third', pool: ['E', 'F', 'G', 'I', 'J'] }, kickoff: '2026-07-03T03:00:00Z' },
  { n: 86, a: { t: 'winner', g: 'J' }, b: { t: 'runner', g: 'H' }, kickoff: '2026-07-03T22:00:00Z' },
  { n: 87, a: { t: 'winner', g: 'K' }, b: { t: 'third', pool: ['D', 'E', 'I', 'J', 'L'] }, kickoff: '2026-07-04T01:30:00Z' },
  { n: 88, a: { t: 'runner', g: 'D' }, b: { t: 'runner', g: 'G' }, kickoff: '2026-07-03T18:00:00Z' }
];

// Mapa "round da API" -> nome amigável (pt-BR) + ordem do chaveamento.
const COPA_ROUNDS = [
  { api: 'Round of 32',    nome: '16-avos de Final', slots: 16 },
  { api: 'Round of 16',    nome: 'Oitavas de Final', slots: 8 },
  { api: 'Quarter-finals', nome: 'Quartas de Final', slots: 4 },
  { api: 'Semi-finals',    nome: 'Semifinal',        slots: 2 },
  { api: '3rd Place Final', nome: 'Disputa de 3º',   slots: 1 },
  { api: 'Final',          nome: 'Final',            slots: 1 }
];

function _copaFetch(path) {
  return fetch(`https://${COPA_API_HOST}/${path}`, {
    headers: { 'x-rapidapi-host': COPA_API_HOST, 'x-rapidapi-key': COPA_API_KEY }
  }).then(r => r.json());
}

// Formata uma data ISO no horário de Brasília (independe do fuso do aparelho).
function _copaDataBR(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }) + 'h';
  } catch (e) { return ''; }
}

function _copaLogoTime(team) {
  // Prefere a bandeira local (mesma usada no resto do app); cai pro logo da API.
  const flag = (typeof getFlagUrl === 'function') ? getFlagUrl(team.id) : null;
  return flag || team.logo || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(team.name) + '&background=222&color=fff');
}

function switchCopaTab(tab) {
  const paneGrupos = document.getElementById('copa-pane-grupos');
  const paneChave = document.getElementById('copa-pane-chave');
  const tabGrupos = document.getElementById('copa-tab-grupos');
  const tabChave = document.getElementById('copa-tab-chave');
  if (!paneGrupos || !paneChave) return;

  const ativo = ['bg-brand-green', 'text-black'];
  const inativo = ['text-text-muted'];

  if (tab === 'chave') {
    paneGrupos.classList.add('hidden');
    paneChave.classList.remove('hidden');
    tabChave.classList.add(...ativo); tabChave.classList.remove(...inativo);
    tabGrupos.classList.remove(...ativo); tabGrupos.classList.add(...inativo);
  } else {
    paneChave.classList.add('hidden');
    paneGrupos.classList.remove('hidden');
    tabGrupos.classList.add(...ativo); tabGrupos.classList.remove(...inativo);
    tabChave.classList.remove(...ativo); tabChave.classList.add(...inativo);
  }
}

async function carregarViewCopa(forcar = false) {
  const elStandings = document.getElementById('copa-standings');
  const elBracket = document.getElementById('copa-bracket');
  if (!elStandings || !elBracket) return;

  const ligaId = (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.league_id) ? grupoAtual.league_id : 1;

  // Usa cache se for a mesma liga e tiver < 5 min (a não ser que forcem refresh).
  const cacheValido = !forcar && _copaCache.standings && _copaCache.leagueId === ligaId && (Date.now() - _copaCache.ts < 5 * 60 * 1000);
  if (cacheValido) {
    renderCopaStandings(_copaCache.standings);
    renderCopaBracket();
    return;
  }

  elStandings.innerHTML = '<div class="bg-card-bg p-6 rounded-2xl border border-white/5 text-center text-text-muted text-[12px] font-semibold animate-pulse">Carregando classificação...</div>';
  elBracket.innerHTML = '';

  try {
    const [standingsJson, fixturesJson] = await Promise.all([
      _copaFetch(`standings?league=${ligaId}&season=${COPA_SEASON}`),
      _copaFetch(`fixtures?league=${ligaId}&season=${COPA_SEASON}`)
    ]);

    // ----- Standings: a API devolve response[0].league.standings = [ [grupo], [grupo]... ]
    let grupos = [];
    const liga = standingsJson.response && standingsJson.response[0] && standingsJson.response[0].league;
    if (liga && Array.isArray(liga.standings)) grupos = liga.standings;

    // ----- Fixtures do mata-mata: tudo que NÃO é "Group Stage".
    const fixtures = (fixturesJson.response || []).filter(f => {
      const r = (f.league && f.league.round) || '';
      return !/group stage/i.test(r);
    });

    _copaCache = { leagueId: ligaId, standings: grupos, knockout: fixtures, ts: Date.now() };

    renderCopaStandings(grupos);
    renderCopaBracket();
  } catch (err) {
    console.error('Erro ao carregar Copa:', err);
    elStandings.innerHTML = '<div class="bg-card-bg p-6 rounded-2xl border border-red-500/20 text-center text-red-400 text-[12px] font-semibold">Erro ao carregar a classificação. Tente atualizar.</div>';
  }
}

function renderCopaStandings(grupos) {
  const el = document.getElementById('copa-standings');
  if (!el) return;

  if (!grupos || grupos.length === 0) {
    el.innerHTML = '<div class="bg-card-bg p-6 rounded-2xl border border-white/5 text-center text-text-muted text-[12px] font-semibold">Classificação ainda não disponível para esta liga.</div>';
    return;
  }

  let html = '';
  grupos.forEach(grupo => {
    if (!grupo || grupo.length === 0) return;
    const nomeGrupo = (grupo[0].group || 'Grupo').replace('Group', 'Grupo');

    let linhas = '';
    grupo.forEach((time, i) => {
      const classificando = i < 2; // top 2 avançam (regra base; melhores 3ºs entram na Etapa 2)
      const corPos = classificando ? 'bg-brand-green text-black' : 'bg-zinc-800 text-zinc-400';
      linhas += `
        <tr class="border-t border-white/5 ${classificando ? 'bg-brand-green/[0.04]' : ''}">
          <td class="py-2.5 pl-3 pr-1">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${corPos}">${time.rank}</span>
          </td>
          <td class="py-2.5 px-1">
            <div class="flex items-center gap-2 min-w-0">
              <img src="${_copaLogoTime(time.team)}" class="w-5 h-5 rounded-sm object-cover flex-shrink-0" onerror="this.style.display='none'">
              <span class="text-[12px] font-bold text-white truncate">${time.team.name}</span>
            </div>
          </td>
          <td class="py-2.5 px-1 text-center text-[11px] text-text-muted">${time.all.played}</td>
          <td class="py-2.5 px-1 text-center text-[11px] text-text-muted">${time.goalsDiff > 0 ? '+' : ''}${time.goalsDiff}</td>
          <td class="py-2.5 pr-3 pl-1 text-center text-[12px] font-black text-white">${time.points}</td>
        </tr>`;
    });

    html += `
      <div class="bg-card-bg rounded-2xl border border-white/5 overflow-hidden">
        <div class="px-3 py-2.5 bg-white/[0.03] border-b border-white/5">
          <h3 class="text-[12px] font-black uppercase tracking-wider text-brand-green">${nomeGrupo}</h3>
        </div>
        <table class="w-full">
          <thead>
            <tr class="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">
              <th class="py-1.5 pl-3 pr-1 text-left">#</th>
              <th class="py-1.5 px-1 text-left">Seleção</th>
              <th class="py-1.5 px-1 text-center">J</th>
              <th class="py-1.5 px-1 text-center">SG</th>
              <th class="py-1.5 pr-3 pl-1 text-center">P</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  });

  el.innerHTML = html;
}

function setCopaBracketModo(modo) {
  _copaBracketModo = modo;
  renderCopaBracket();
}

function renderCopaBracket() {
  const el = document.getElementById('copa-bracket');
  if (!el) return;

  const fixtures = _copaCache.knockout || [];
  const grupos = _copaCache.standings || [];
  const temReais = fixtures.length > 0;
  // Sem confrontos reais ainda → força projeção.
  const modo = temReais ? _copaBracketModo : 'projecao';

  let html = '';

  // Toggle Projeção / Confrontos reais (só quando já existem jogos reais)
  if (temReais) {
    const btn = (m, txt) => `<button onclick="setCopaBracketModo('${m}')" class="flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${modo === m ? 'bg-brand-green text-black' : 'text-text-muted'}">${txt}</button>`;
    html += `<div class="flex gap-2 mb-4 bg-card-bg p-1 rounded-xl border border-white/5">${btn('projecao', 'Projeção')}${btn('reais', 'Confrontos reais')}</div>`;
  }

  html += (modo === 'reais') ? _copaRenderReais(fixtures) : _copaRenderProjecao(grupos);
  el.innerHTML = html;
}

// --------- Modo PROJEÇÃO (parcial, da classificação atual) ---------

function _copaMapaGrupos(grupos) {
  const mapa = {};
  (grupos || []).forEach(g => {
    if (!g || !g.length) return;
    const letra = (g[0].group || '').replace(/group/i, '').trim().toUpperCase();
    if (letra) mapa[letra] = g;
  });
  return mapa;
}

function _copaResolverSlot(slot, mapa) {
  if (slot.t === 'third') {
    return { team: null, third: true, pool: slot.pool, label: '3º [' + slot.pool.join('/') + ']', sub: 'Melhor 3º lugar' };
  }
  const arr = mapa[slot.g] || [];
  const idx = slot.t === 'winner' ? 0 : 1;
  const reg = arr[idx] || null;
  const pos = slot.t === 'winner' ? '1º' : '2º';
  return { team: reg ? reg.team : null, label: pos + ' Grupo ' + slot.g, sub: pos + ' do Grupo ' + slot.g };
}

// Ranking dos 3º colocados (critérios FIFA: pts, saldo, gols pró). Top 8 classificam.
function _copaMelhores3(grupos) {
  const lista = [];
  (grupos || []).forEach(g => {
    if (!g || g.length < 3) return;
    const letra = (g[0].group || '').replace(/group/i, '').trim().toUpperCase();
    const reg = g[2]; // 3º colocado (rank 3)
    if (!reg) return;
    lista.push({
      letra, team: reg.team,
      pts: reg.points, gd: reg.goalsDiff,
      gf: (reg.all && reg.all.goals && reg.all.goals.for) || 0,
      jogos: (reg.all && reg.all.played) || 0
    });
  });
  lista.sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf));
  const qualifSet = new Set(lista.slice(0, 8).map(t => t.letra));
  return { ranked: lista, qualifSet };
}

function _copaThirdSlotHTML(pool, qualifSet, alignRight) {
  // Mostra o bolsão de 3º, destacando os grupos que estão classificando agora.
  const chips = pool.map(letra => {
    const on = qualifSet.has(letra);
    return `<span class="text-[10px] font-black px-1 rounded ${on ? 'bg-brand-green/20 text-brand-green' : 'text-zinc-600 line-through'}">${letra}</span>`;
  }).join('');
  const align = alignRight ? 'justify-end text-right' : '';
  return `<div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 ${align}">
        <span class="text-[11px] font-semibold text-zinc-400">3º lugar</span>
      </div>
      <div class="flex items-center gap-0.5 flex-wrap mt-0.5 ${align}">${chips}</div>
    </div>`;
}

function _copaSlotProjHTML(s, alignRight) {
  const align = alignRight ? 'justify-end text-right' : '';
  if (s.team) {
    const nomeBloco = `<div class="min-w-0 ${alignRight ? 'text-right' : ''}">
        <span class="block text-[12px] font-bold text-white truncate">${s.team.name}</span>
        <span class="block text-[9px] text-zinc-500 truncate">${s.sub}</span>
      </div>`;
    const img = `<img src="${_copaLogoTime(s.team)}" class="w-5 h-5 rounded-sm object-cover flex-shrink-0" onerror="this.style.display='none'">`;
    return `<div class="flex items-center gap-2 flex-1 min-w-0 ${align}">${alignRight ? nomeBloco + img : img + nomeBloco}</div>`;
  }
  // Sem time definido: mostra só o rótulo (posição ou bolsão de 3º)
  return `<div class="flex items-center flex-1 min-w-0 ${align}">
      <span class="text-[11px] font-semibold text-zinc-400 truncate">${s.label}</span>
    </div>`;
}

function _copaRenderProjecao(grupos) {
  const mapa = _copaMapaGrupos(grupos);
  if (Object.keys(mapa).length === 0) {
    return '<div class="bg-card-bg p-6 rounded-2xl border border-white/5 text-center text-text-muted text-[12px] font-semibold">Classificação ainda não disponível pra projetar o chaveamento.</div>';
  }

  const m3 = _copaMelhores3(grupos);

  let html = `
    <div class="bg-indigo-500/[0.07] border border-indigo-500/20 rounded-2xl p-4 mb-4">
      <p class="text-[12px] text-indigo-300 font-bold">📐 Projeção (parcial)</p>
      <p class="text-[11px] text-indigo-200/70 mt-1">Confrontos das <b>16-avos</b> montados pela classificação de agora. Muda conforme os grupos mexem. Nos jogos contra 3º lugar, os grupos <span class="text-brand-green font-bold">em verde</span> são os que estão classificando o 3º; qual deles cai em cada jogo só fecha no fim da fase de grupos.</p>
    </div>`;

  // Tabela dos melhores 3º lugares (dados reais, critérios FIFA)
  if (m3.ranked.length) {
    html += `<div class="mb-4">
      <h3 class="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2 flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-green"></span> Melhores 3º lugares (8 classificam)
      </h3>
      <div class="bg-card-bg rounded-2xl border border-white/5 overflow-hidden">
        <table class="w-full">
          <thead><tr class="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">
            <th class="py-1.5 pl-3 pr-1 text-left">#</th><th class="py-1.5 px-1 text-left">Seleção</th>
            <th class="py-1.5 px-1 text-center">Gr</th><th class="py-1.5 px-1 text-center">SG</th><th class="py-1.5 pr-3 pl-1 text-center">P</th>
          </tr></thead><tbody>`;
    m3.ranked.forEach((t, i) => {
      const classif = i < 8;
      html += `<tr class="border-t border-white/5 ${classif ? 'bg-brand-green/[0.04]' : 'opacity-50'}">
          <td class="py-2 pl-3 pr-1"><span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${classif ? 'bg-brand-green text-black' : 'bg-zinc-800 text-zinc-400'}">${i + 1}</span></td>
          <td class="py-2 px-1"><div class="flex items-center gap-2 min-w-0"><img src="${_copaLogoTime(t.team)}" class="w-5 h-5 rounded-sm object-cover flex-shrink-0" onerror="this.style.display='none'"><span class="text-[12px] font-bold text-white truncate">${t.team.name}</span></div></td>
          <td class="py-2 px-1 text-center text-[11px] text-text-muted">${t.letra}</td>
          <td class="py-2 px-1 text-center text-[11px] text-text-muted">${t.gd > 0 ? '+' : ''}${t.gd}</td>
          <td class="py-2 pr-3 pl-1 text-center text-[12px] font-black text-white">${t.pts}</td>
        </tr>`;
    });
    html += `</tbody></table></div></div>`;
  }

  html += `<div class="mb-4">
      <h3 class="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2 flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-green"></span> 16-avos de Final (Round of 32)
      </h3>`;

  COPA_R32_TEMPLATE.forEach(m => {
    const A = _copaResolverSlot(m.a, mapa);
    const B = _copaResolverSlot(m.b, mapa);
    const aHTML = A.third ? _copaThirdSlotHTML(A.pool, m3.qualifSet, false) : _copaSlotProjHTML(A, false);
    const bHTML = B.third ? _copaThirdSlotHTML(B.pool, m3.qualifSet, true) : _copaSlotProjHTML(B, true);
    const dataBR = _copaDataBR(m.kickoff);
    html += `
      <div class="bg-card-bg border border-white/5 rounded-xl px-3 py-2.5 mb-2">
        <div class="flex items-center justify-between gap-2">
          ${aHTML}
          <span class="text-[12px] font-black text-zinc-600 px-1 flex-shrink-0">×</span>
          ${bHTML}
        </div>
        ${dataBR ? `<p class="text-[10px] text-zinc-500 text-center mt-1.5">📅 ${dataBR} <span class="text-zinc-600">(Brasília)</span></p>` : ''}
      </div>`;
  });

  html += `</div>
    <p class="text-[10px] text-zinc-600 text-center px-4">As fases seguintes (Oitavas → Final) aparecem quando os confrontos das 16-avos estiverem definidos.</p>`;
  return html;
}

// --------- Modo CONFRONTOS REAIS (fixtures da API) ---------

function _copaRenderReais(fixtures) {
  const porRound = {};
  (fixtures || []).forEach(f => {
    const r = (f.league && f.league.round) || '';
    if (!porRound[r]) porRound[r] = [];
    porRound[r].push(f);
  });

  let html = '';
  COPA_ROUNDS.forEach(def => {
    const jogos = porRound[def.api];
    if (!jogos) return;
    html += `<div class="mb-4">
      <h3 class="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2 flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-green"></span> ${def.nome}
      </h3>`;
    jogos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    jogos.forEach(j => { html += _copaCardConfronto(j); });
    html += '</div>';
  });
  return html;
}

function _copaCardConfronto(j) {
  const h = j.teams.home, a = j.teams.away;
  const gh = j.goals.home, ga = j.goals.away;
  const temPlacar = gh !== null && ga !== null;
  const data = _copaDataBR(j.fixture.date) + ' (Brasília)';
  const hVenceu = temPlacar && gh > ga, aVenceu = temPlacar && ga > gh;
  return `
    <div class="bg-card-bg border border-white/5 rounded-xl px-3 py-2.5 mb-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1 min-w-0 ${aVenceu ? 'opacity-50' : ''}">
          <img src="${_copaLogoTime(h)}" class="w-5 h-5 rounded-sm object-cover flex-shrink-0" onerror="this.style.display='none'">
          <span class="text-[12px] font-bold text-white truncate">${h.name}</span>
        </div>
        <span class="text-[13px] font-black text-white px-2 flex-shrink-0">${temPlacar ? (gh + ' × ' + ga) : '×'}</span>
        <div class="flex items-center gap-2 flex-1 min-w-0 justify-end ${hVenceu ? 'opacity-50' : ''}">
          <span class="text-[12px] font-bold text-white truncate text-right">${a.name}</span>
          <img src="${_copaLogoTime(a)}" class="w-5 h-5 rounded-sm object-cover flex-shrink-0" onerror="this.style.display='none'">
        </div>
      </div>
      <p class="text-[10px] text-zinc-500 text-center mt-1.5">${data}</p>
    </div>`;
}
