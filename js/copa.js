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
    renderCopaBracket(_copaCache.knockout);
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
    renderCopaBracket(fixtures);
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

function renderCopaBracket(fixtures) {
  const el = document.getElementById('copa-bracket');
  if (!el) return;

  // Agrupa os fixtures do mata-mata por round.
  const porRound = {};
  (fixtures || []).forEach(f => {
    const r = (f.league && f.league.round) || '';
    if (!porRound[r]) porRound[r] = [];
    porRound[r].push(f);
  });

  const temAlgum = Object.keys(porRound).length > 0;

  let html = '';
  if (!temAlgum) {
    html += `
      <div class="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-4 mb-4">
        <p class="text-[12px] text-amber-300 font-semibold">⏳ O mata-mata ainda não foi sorteado.</p>
        <p class="text-[11px] text-amber-200/70 mt-1">Os confrontos aparecem aqui automaticamente quando a fase de grupos terminar.</p>
      </div>`;
  }

  COPA_ROUNDS.forEach(def => {
    const jogos = porRound[def.api];
    if (!jogos && temAlgum) return; // se já tem mata-mata, só mostra os rounds existentes
    html += `<div class="mb-4">
      <h3 class="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2 flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-green"></span> ${def.nome}
      </h3>`;

    if (jogos && jogos.length) {
      jogos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
      jogos.forEach(j => { html += _copaCardConfronto(j); });
    } else {
      // Scaffold: slots "a definir"
      for (let i = 0; i < def.slots; i++) {
        html += `
          <div class="bg-card-bg/50 border border-dashed border-white/10 rounded-xl px-3 py-2.5 mb-2 flex items-center justify-between">
            <span class="text-[12px] text-zinc-500 font-semibold">A definir</span>
            <span class="text-[10px] text-zinc-600 font-black">×</span>
            <span class="text-[12px] text-zinc-500 font-semibold">A definir</span>
          </div>`;
      }
    }
    html += '</div>';
  });

  el.innerHTML = html;
}

function _copaCardConfronto(j) {
  const h = j.teams.home, a = j.teams.away;
  const gh = j.goals.home, ga = j.goals.away;
  const temPlacar = gh !== null && ga !== null;
  const data = new Date(j.fixture.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
