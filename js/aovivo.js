// ============ MODO TV AO VIVO (LIVE DASHBOARD) ============

let tvIntervalo = null;
let tvDados = {
  membros: [],
  perfis: [],
  palpites: [],
  userDesafios: []
};
let tvUltimoEstadoJogos = null;

// Classificação (posição no grupo) — cache por liga, 5 min.
// mapa = oficial (rank/grupo); grupos = dados crus (pra recalcular ao vivo); liveMapa = posição recalculada com o placar rolando.
let tvStandings = { leagueId: null, mapa: {}, grupos: [], liveMapa: {}, ts: 0 };

async function _tvCarregarStandings(leagueId) {
  // Reusa cache recente da mesma liga.
  if (tvStandings.leagueId === leagueId && Object.keys(tvStandings.mapa).length && (Date.now() - tvStandings.ts < 5 * 60 * 1000)) {
    return tvStandings.mapa;
  }
  try {
    const resp = await fetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=2026`, {
      headers: { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5' }
    });
    const json = await resp.json();
    const mapa = {};
    let grupos = [];
    const liga = json.response && json.response[0] && json.response[0].league;
    if (liga && Array.isArray(liga.standings)) {
      grupos = liga.standings;
      grupos.forEach(grupo => {
        (grupo || []).forEach(reg => {
          const letra = (reg.group || '').replace(/group/i, '').trim().toUpperCase();
          mapa[reg.team.id] = { rank: reg.rank, grupo: letra };
        });
      });
    }
    tvStandings = { leagueId, mapa, grupos, liveMapa: {}, ts: Date.now() };
    return mapa;
  } catch (e) {
    console.error('[TV] Erro ao buscar classificação:', e);
    return tvStandings.mapa || {};
  }
}

// Recalcula a posição no grupo somando o placar dos jogos que estão rolando.
function _tvCalcPosLive(jogosAtivos) {
  const liveMapa = {};
  (tvStandings.grupos || []).forEach(grupo => {
    if (!grupo || !grupo.length) return;
    const letra = (grupo[0].group || '').replace(/group/i, '').trim().toUpperCase();
    const work = grupo.map(reg => ({
      id: reg.team.id,
      pts: reg.points,
      gd: reg.goalsDiff,
      gf: (reg.all && reg.all.goals && reg.all.goals.for) || 0,
      oficialRank: reg.rank,
      live: false
    }));
    const byId = {};
    work.forEach(w => { byId[w.id] = w; });

    (jogosAtivos || []).forEach(j => {
      const h = byId[j.teams.home.id], a = byId[j.teams.away.id];
      if (!h || !a) return; // jogo não é desse grupo
      const gh = j.goals.home ?? 0, ga = j.goals.away ?? 0;
      h.gf += gh; a.gf += ga;
      h.gd += (gh - ga); a.gd += (ga - gh);
      if (gh > ga) h.pts += 3; else if (ga > gh) a.pts += 3; else { h.pts += 1; a.pts += 1; }
      h.live = true; a.live = true;
    });

    work.sort((x, y) => (y.pts - x.pts) || (y.gd - x.gd) || (y.gf - x.gf));
    work.forEach((w, i) => {
      liveMapa[w.id] = { rank: i + 1, grupo: letra, delta: (w.oficialRank - (i + 1)), live: w.live };
    });
  });
  tvStandings.liveMapa = liveMapa;
  return liveMapa;
}

function _tvPosChip(teamId) {
  const p = tvStandings.liveMapa[teamId] || tvStandings.mapa[teamId];
  if (!p || !p.rank) return '';
  const base = p.grupo ? ('Grupo ' + p.grupo + ' · ' + p.rank + 'º') : (p.rank + 'º');
  let seta = '';
  if (p.delta > 0) seta = ` <span class="text-emerald-400 font-black">▲${p.delta}</span>`;
  else if (p.delta < 0) seta = ` <span class="text-red-400 font-black">▼${Math.abs(p.delta)}</span>`;
  return `<span class="block text-[9px] text-zinc-400 font-semibold truncate mt-0.5">${base}${seta}</span>`;
}

async function abrirTVAoVivo() {
  // Trava do Plano Free (limite <= 3)
  if (grupoAtual && grupoAtual.max_participants <= 3) {
    if (typeof abrirModalUpgrade === 'function') {
      abrirModalUpgrade();
      if (typeof showToast === 'function') {
        showToast("O Modo TV Ao Vivo é um recurso premium!", "error");
      }
    } else {
      alert("O Modo TV Ao Vivo é um recurso premium! Faça o upgrade do grupo.");
    }
    return;
  }

  if (typeof switchView === 'function') {
    switchView('view-ao-vivo');
  }

  // Preenche loaders temporários para feedback visual
  const jogosContainer = document.getElementById('lista-jogos-ao-vivo');
  const rankingContainer = document.getElementById('lista-ranking-ao-vivo');
  const palpitesContainer = document.getElementById('lista-palpites-ao-vivo');

  if (jogosContainer) jogosContainer.innerHTML = '<p class="text-text-muted text-[12px] text-center py-6">Carregando jogos...</p>';
  if (rankingContainer) rankingContainer.innerHTML = '<p class="text-text-muted text-[12px] text-center py-6">Carregando classificação parcial...</p>';
  if (palpitesContainer) palpitesContainer.innerHTML = '<p class="text-text-muted text-[12px] text-center py-6">Carregando palpites dos amigos...</p>';

  try {
    await carregarDadosBaseTVAoVivo();
    await atualizarTVAoVivo();

    // Inicia cronômetro a cada 60 segundos
    desativarTVAoVivo();
    tvIntervalo = setInterval(async () => {
      await atualizarTVAoVivo();
    }, 60000);
  } catch (e) {
    console.error("Erro ao iniciar Modo TV Ao Vivo:", e);
  }
}

function desativarTVAoVivo() {
  if (tvIntervalo) {
    console.log('[TV POLLING] Intervalo encerrado.');
    clearInterval(tvIntervalo);
    tvIntervalo = null;
  }
}

async function carregarDadosBaseTVAoVivo() {
  if (!sbClient || !grupoAtual) return;

  try {
    // 1. Busca membros do grupo
    const { data: members, error: errM } = await sbClient
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', grupoAtual.id);

    if (errM) throw errM;
    tvDados.membros = members || [];

    const userIds = tvDados.membros.map(m => m.user_id);
    if (userIds.length === 0) return;

    // Busca perfis, palpites e desafios em paralelo
    const [resPerfis, resPalpites, resDesafios] = await Promise.all([
      sbClient.from('profiles').select('id, full_name, avatar_url').in('id', userIds),
      sbClient.from('guesses').select('user_id, match_id, score_home, score_away').eq('group_id', grupoAtual.id).limit(2000),
      sbClient.from('user_desafios').select('user_id, points_awarded').eq('group_id', grupoAtual.id)
    ]);

    if (resPerfis.error) console.error(resPerfis.error);
    if (resPalpites.error) console.error(resPalpites.error);
    if (resDesafios.error) console.error(resDesafios.error);

    tvDados.perfis = resPerfis.data || [];
    tvDados.palpites = resPalpites.data || [];
    tvDados.userDesafios = resDesafios.data || [];

  } catch (e) {
    console.error("Erro ao carregar dados base do Supabase:", e);
  }
}

// Calcula a distribuição de palpites do grupo por jogo (Casa/Empate/Fora) e marca
// as zebras (time com < 15% dos palpites de vitória — só com a regra ligada).
// Retorna mapa match_id -> {homePct, empatePct, awayPct, total, homeZebra, awayZebra}.
function calcularZebrasTV() {
  const mapa = {};
  const regraOn = (grupoAtual && grupoAtual.regra_zebra_dinamica === true);
  const cont = {};
  (tvDados.palpites || []).forEach(g => {
    if (!cont[g.match_id]) cont[g.match_id] = { home: 0, away: 0, empate: 0, total: 0 };
    cont[g.match_id].total++;
    if (g.score_home > g.score_away) cont[g.match_id].home++;
    else if (g.score_away > g.score_home) cont[g.match_id].away++;
    else cont[g.match_id].empate++;
  });
  for (const mId in cont) {
    const c = cont[mId];
    if (c.total > 0) {
      const homePct = (c.home / c.total) * 100;
      const awayPct = (c.away / c.total) * 100;
      const empatePct = (c.empate / c.total) * 100;
      mapa[mId] = {
        homePct, empatePct, awayPct, total: c.total,
        homeZebra: regraOn && homePct < 15,
        awayZebra: regraOn && awayPct < 15,
        empateZebra: regraOn && empatePct < 15
      };
    }
  }
  return mapa;
}

async function atualizarTVAoVivo() {
  const leagueId = (grupoAtual && grupoAtual.league_id) ? grupoAtual.league_id : 1;
  const jogosContainer = document.getElementById('lista-jogos-ao-vivo');
  const rankingContainer = document.getElementById('lista-ranking-ao-vivo');
  const palpitesContainer = document.getElementById('lista-palpites-ao-vivo');

  if (!jogosContainer || !rankingContainer || !palpitesContainer) return;

  console.log('[TV POLLING] Buscando dados de partidas ao vivo...');
  let jogosAoVivoApi = null;
  
  try {
    if (typeof buscarDadosAoVivo === 'function') {
      jogosAoVivoApi = await buscarDadosAoVivo();
      // Salva para fallback caso a próxima falhe
      if (Array.isArray(jogosAoVivoApi) && jogosAoVivoApi.length > 0) {
        tvUltimoEstadoJogos = jogosAoVivoApi;
      }
    }
  } catch (e) {
    console.error("Erro ao buscar jogos ao vivo da API:", e);
  }

  // Se a chamada falhou (retornou null ou undefined), tenta usar o fallback
  if (jogosAoVivoApi === null || jogosAoVivoApi === undefined) {
    if (tvUltimoEstadoJogos) {
      console.log('[TV POLLING] Utilizando último estado conhecido (fallback)...');
      jogosAoVivoApi = tvUltimoEstadoJogos;
    } else {
      jogosAoVivoApi = [];
    }
  }

  // Filtra jogos ativos que pertencem à liga do bolão
  const statusAoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const jogosAtivosGrupo = jogosAoVivoApi.filter(j => {
    return j.league.id === leagueId && statusAoVivo.includes(j.fixture.status.short);
  });

  // Classificação (posição no grupo) das seleções — pra exibir no card ao vivo
  await _tvCarregarStandings(leagueId);
  _tvCalcPosLive(jogosAtivosGrupo); // recalcula a posição com o placar que está rolando

  // Mapa de zebras do grupo (time com <15% dos palpites de vitória)
  const zebrasTV = calcularZebrasTV();
  const zebraTagTV = `<span class="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wide flex-shrink-0" title="Time zebra — vale o dobro se vencer">🦓</span>`;

  // 1. RENDERIZA JOGOS AO VIVO
  if (jogosAtivosGrupo.length === 0) {
    const htmlSemJogos = renderEmptyState(
      '📺', 
      'Fora do Ar', 
      'A bola não está rolando agora. Aproveite para estudar as estatísticas e preparar seus próximos palpites.'
    );
    if (jogosContainer.innerHTML !== htmlSemJogos) {
      jogosContainer.innerHTML = htmlSemJogos;
    }
  } else {
    let htmlJogos = '';
    jogosAtivosGrupo.forEach(jogo => {
      const homeLogo = getFlagUrl(jogo.teams.home.id) || jogo.teams.home.logo || '';
      const awayLogo = getFlagUrl(jogo.teams.away.id) || jogo.teams.away.logo || '';
      const homeFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(jogo.teams.home.name) + '&background=047857&color=fff';
      const awayFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(jogo.teams.away.name) + '&background=b45309&color=fff';
      const elapsed = jogo.fixture.status.elapsed ? `${jogo.fixture.status.elapsed}'` : '';
      const zJogo = zebrasTV[jogo.fixture.id] || {};
      const footerLive = (typeof renderDistribuicaoZebra === 'function')
        ? renderDistribuicaoZebra(zJogo.homePct, zJogo.empatePct, zJogo.awayPct, zJogo.total, (grupoAtual && grupoAtual.regra_zebra_dinamica === true))
        : '';

      htmlJogos += `
        <div class="bg-zinc-900/90 p-5 rounded-2xl border border-red-500/25 shadow-[0_0_22px_rgba(239,68,68,0.07)] relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-red-500/10 via-transparent to-transparent pointer-events-none"></div>
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 w-[40%]">
              <img src="${homeLogo}" onerror="this.src='${homeFallback}'" class="w-8 h-8 rounded-lg object-cover flex-shrink-0">
              <div class="min-w-0">
                <span class="font-bold text-[12px] text-white truncate block">${jogo.teams.home.name}</span>
                ${_tvPosChip(jogo.teams.home.id)}
              </div>
              ${zJogo.homeZebra ? zebraTagTV : ''}
            </div>

            <div class="flex flex-col items-center justify-center w-[20%]">
              <span class="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-widest animate-pulse mb-1">${elapsed}</span>
              <div class="text-base font-black text-white tracking-widest">${jogo.goals.home ?? 0}x${jogo.goals.away ?? 0}</div>
            </div>

            <div class="flex items-center justify-end gap-3 w-[40%] text-right">
              ${zJogo.awayZebra ? zebraTagTV : ''}
              <div class="min-w-0">
                <span class="font-bold text-[12px] text-white truncate block">${jogo.teams.away.name}</span>
                ${_tvPosChip(jogo.teams.away.id)}
              </div>
              <img src="${awayLogo}" onerror="this.src='${awayFallback}'" class="w-8 h-8 rounded-lg object-cover flex-shrink-0">
            </div>
          </div>
          ${footerLive}
        </div>
      `;
    });
    if (jogosContainer.innerHTML !== htmlJogos) {
      jogosContainer.innerHTML = htmlJogos;
    }
  }

  // 2. CALCULA CLASSIFICAÇÃO PROVISÓRIA (BASE + PARCIAL DOS JOGOS AO VIVO)
  const scoresProvisorios = {};
  tvDados.membros.forEach(m => {
    const perfil = tvDados.perfis.find(p => p.id === m.user_id);
    scoresProvisorios[m.user_id] = {
      id: m.user_id,
      nome: perfil ? perfil.full_name : 'Participante',
      foto: perfil && perfil.avatar_url ? perfil.avatar_url : null,
      pontosConsolidados: 0,
      pontosParciaisAoVivo: 0,
      totalProvisorio: 0,
      acertosExatos: 0,
      isAdmin: m.role === 'owner'
    };
  });

  // Calcula pontos consolidados (jogos encerrados)
  const statusTerminado = ['FT', 'AET', 'PEN'];
  tvDados.palpites.forEach(g => {
    if (!scoresProvisorios[g.user_id]) return;

    const jogo = todosOsJogos.find(j => j.fixture.id === g.match_id);
    if (!jogo) return;

    if (statusTerminado.includes(jogo.fixture.status.short) && jogo.goals.home !== null && jogo.goals.away !== null) {
      // Pontos REAIS: mesmo motor do Ranking Oficial (aplica zebra dinâmica + mata-mata)
      const vencedorReal = jogo.goals.home > jogo.goals.away ? 'home' : (jogo.goals.home < jogo.goals.away ? 'away' : 'empate');
      const zc = zebrasTV[g.match_id];
      const pctVencedor = zc ? zc[vencedorReal + 'Pct'] : 100;
      const pts = calcularPontosPalpite(g.score_home, g.score_away, jogo.goals.home, jogo.goals.away, jogo.league.round, pctVencedor);
      scoresProvisorios[g.user_id].pontosConsolidados += pts;
      if (g.score_home === jogo.goals.home && g.score_away === jogo.goals.away) {
        scoresProvisorios[g.user_id].acertosExatos += 1;
      }
    }
  });

  // Adiciona pontos de desafios do GM
  tvDados.userDesafios.forEach(ud => {
    if (scoresProvisorios[ud.user_id]) {
      scoresProvisorios[ud.user_id].pontosConsolidados += ud.points_awarded || 0;
    }
  });

  // Calcula pontos provisórios dos jogos ao vivo ativos
  if (jogosAtivosGrupo.length > 0) {
    tvDados.palpites.forEach(g => {
      if (!scoresProvisorios[g.user_id]) return;

      const jogoAoVivo = jogosAtivosGrupo.find(j => j.fixture.id === g.match_id);
      if (!jogoAoVivo) return;

      const liveHome = jogoAoVivo.goals.home ?? 0;
      const liveAway = jogoAoVivo.goals.away ?? 0;
      const vencedorLive = liveHome > liveAway ? 'home' : (liveHome < liveAway ? 'away' : 'empate');
      const zl = zebrasTV[g.match_id];
      const pctVencedorLive = zl ? zl[vencedorLive + 'Pct'] : 100;
      const ptsParciais = calcularPontosPalpite(g.score_home, g.score_away, liveHome, liveAway, jogoAoVivo.league.round, pctVencedorLive);

      scoresProvisorios[g.user_id].pontosParciaisAoVivo += ptsParciais;
      if (g.score_home === liveHome && g.score_away === liveAway) {
        scoresProvisorios[g.user_id].acertosExatos += 1;
      }
    });
  }

  // Calcula o total provisório geral
  tvDados.membros.forEach(m => {
    const sc = scoresProvisorios[m.user_id];
    if (sc) {
      sc.totalProvisorio = sc.pontosConsolidados + sc.pontosParciaisAoVivo;
    }
  });

  // Ordena a classificação provisória
  const rankingSorted = Object.values(scoresProvisorios).sort((a, b) => {
    if (b.totalProvisorio !== a.totalProvisorio) {
      return b.totalProvisorio - a.totalProvisorio;
    }
    return b.acertosExatos - a.acertosExatos;
  });

  // Rank FIXO (sem os pontos ao vivo) — pra saber quem subiu/desceu com os jogos rolando
  const rankFixoMap = {};
  Object.values(scoresProvisorios)
    .slice()
    .sort((a, b) => (b.pontosConsolidados - a.pontosConsolidados) || (b.acertosExatos - a.acertosExatos))
    .forEach((u, i) => { rankFixoMap[u.id] = i + 1; });

  // Card fixo "Sua posição" (você no meio da galera)
  const suaPosEl = document.getElementById('tv-sua-posicao');
  if (suaPosEl) {
    const meuIdx = (typeof usuarioAtual !== 'undefined' && usuarioAtual)
      ? rankingSorted.findIndex(u => String(u.id) === String(usuarioAtual.id)) : -1;
    if (meuIdx >= 0) {
      const eu = rankingSorted[meuIdx];
      const minhaPos = meuIdx + 1;
      const delta = (rankFixoMap[eu.id] || minhaPos) - minhaPos;
      let setaTxt = '<span class="text-zinc-500 text-[11px] font-bold">—</span>';
      if (delta > 0) setaTxt = `<span class="text-emerald-400 text-[12px] font-black">▲ ${delta}</span>`;
      else if (delta < 0) setaTxt = `<span class="text-red-400 text-[12px] font-black">▼ ${Math.abs(delta)}</span>`;
      const liveTxt = eu.pontosParciaisAoVivo > 0 ? `<span class="text-red-400 text-[10px] font-black ml-1">● +${eu.pontosParciaisAoVivo}</span>` : '';
      suaPosEl.className = 'mb-3';
      suaPosEl.innerHTML = `
        <div class="bg-gradient-to-r from-brand-green/15 to-transparent border border-brand-green/30 rounded-2xl p-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-center">
              <span class="block text-[8px] font-black uppercase tracking-widest text-brand-green/80">Você</span>
              <span class="block text-xl font-black text-white leading-none">${minhaPos}º</span>
            </div>
            <img src="${eu.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(eu.nome) + '&background=10b981&color=fff'}" class="w-9 h-9 rounded-full border border-brand-green/40 object-cover">
            <div>
              <p class="text-[13px] font-bold text-white">${eu.nome}</p>
              <p class="text-[10px] text-text-muted">Movimento: ${setaTxt}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-base font-black text-white font-mono">${eu.totalProvisorio}</span>${liveTxt}
            <span class="block text-[9px] text-text-muted font-bold uppercase">pts</span>
          </div>
        </div>`;
    } else {
      suaPosEl.className = 'hidden mb-3';
      suaPosEl.innerHTML = '';
    }
  }

  // Remove loaders/mensagens estáticas se houver ranking válido
  const pMsg = rankingContainer.querySelector('p');
  if (pMsg) {
    rankingContainer.innerHTML = '';
  }

  // Atualização Seletiva do DOM para o Ranking (Flicker-Reduction)
  rankingSorted.forEach((user, index) => {
    const posicao = index + 1;
    let cardClasses = ['bg-card-bg', 'p-3.5', 'flex', 'items-center', 'justify-between', 'relative', 'overflow-hidden', 'border', 'rounded-2xl', 'transition-all'];
    let rankClasses = ['w-5', 'text-center', 'font-black'];
    let glowBgClass = '';

    // Movimento no ranking (posição fixa -> provisória): + subiu, - desceu
    const deltaPos = (rankFixoMap[user.id] || posicao) - posicao;
    let movBadge = '';
    if (deltaPos > 0) {
      cardClasses.push(deltaPos >= 3 ? 'tv-rank-up-strong' : 'tv-rank-up');
      movBadge = `<span class="tv-mov text-emerald-400 text-[10px] font-black leading-none flex flex-col items-center">▲<span class="text-[9px]">${deltaPos}</span></span>`;
    } else if (deltaPos < 0) {
      const d = Math.abs(deltaPos);
      cardClasses.push(d >= 3 ? 'tv-rank-down-strong' : 'tv-rank-down');
      movBadge = `<span class="tv-mov text-red-400 text-[10px] font-black leading-none flex flex-col items-center">▼<span class="text-[9px]">${d}</span></span>`;
    }

    if (posicao === 1) {
      cardClasses.push('border-gold/30', 'glow-gold');
      rankClasses.push('text-gold', 'text-[15px]');
      glowBgClass = 'bg-gold';
    } else if (posicao === 2) {
      cardClasses.push('border-silver/20');
      rankClasses.push('text-silver', 'text-[14px]', 'font-bold');
      glowBgClass = 'bg-silver';
    } else if (posicao === 3) {
      cardClasses.push('border-bronze/20');
      rankClasses.push('text-bronze', 'text-[14px]', 'font-bold');
      glowBgClass = 'bg-bronze';
    } else {
      cardClasses.push('border-white/5');
      rankClasses.push('text-white/60');
    }

    // Destaca VOCÊ (jogador logado) no meio da galera
    const ehVoce = (typeof usuarioAtual !== 'undefined' && usuarioAtual && String(user.id) === String(usuarioAtual.id));
    if (ehVoce) {
      const bi = cardClasses.indexOf('bg-card-bg'); if (bi >= 0) cardClasses[bi] = 'bg-brand-green/10';
      const wi = cardClasses.indexOf('border-white/5'); if (wi >= 0) cardClasses[wi] = 'border-brand-green/50';
    }
    const voceBadge = ehVoce ? `<span class="tv-voce-badge bg-brand-green text-black text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide">Você</span>` : '';

    const fotoUrl = user.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nome) + '&background=random&color=fff';
    let rowEl = rankingContainer.querySelector(`[data-user-id="${user.id}"]`);

    if (!rowEl) {
      rowEl = document.createElement('div');
      rowEl.setAttribute('data-user-id', user.id);
      rowEl.className = cardClasses.join(' ');
      rowEl.innerHTML = `
        <div class="tv-glow-bar absolute left-0 top-0 bottom-0 w-1 ${glowBgClass}"></div>
        <div class="flex items-center gap-3 pl-1.5">
          <span class="${rankClasses.join(' ')} tv-posicao">${posicao}º</span>
          <span class="tv-mov-wrap w-3 flex items-center justify-center">${movBadge}</span>
          <img src="${fotoUrl}" class="tv-avatar w-8 h-8 rounded-full border border-white/10 object-cover flex-shrink-0">
          <div class="min-w-0">
            <p class="font-bold text-[12px] text-white truncate flex items-center gap-1">
              <span class="tv-nome">${user.nome}</span>
              <span class="tv-voce-wrap">${voceBadge}</span>
              <span class="tv-admin-badge bg-gold/20 text-gold text-[8px] px-1 rounded font-bold uppercase ${user.isAdmin ? '' : 'hidden'}">ADMIN</span>
            </p>
            <p class="text-[10px] text-text-muted mt-0.5 tv-fixo">Fixo: ${user.pontosConsolidados} pts</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="tv-live-badge"></div>
          <div class="text-right">
            <span class="text-sm font-black text-white font-mono tv-total">${user.totalProvisorio}</span>
            <span class="text-[10px] text-text-muted font-bold block">pts</span>
          </div>
        </div>
      `;
      rankingContainer.appendChild(rowEl);
    } else {
      // Atualiza classes do container principal do item se necessário
      const expectedClass = cardClasses.join(' ');
      if (rowEl.className !== expectedClass) {
        rowEl.className = expectedClass;
      }

      // Atualiza a barra de brilho lateral (Glow Bar)
      const glowBar = rowEl.querySelector('.tv-glow-bar');
      if (glowBar) {
        if (glowBgClass) {
          glowBar.className = `tv-glow-bar absolute left-0 top-0 bottom-0 w-1 ${glowBgClass}`;
          glowBar.style.display = '';
        } else {
          glowBar.style.display = 'none';
        }
      }

      // Atualiza o texto e classes da posição
      const posEl = rowEl.querySelector('.tv-posicao');
      if (posEl) {
        const expectedPosText = `${posicao}º`;
        if (posEl.textContent !== expectedPosText) {
          posEl.textContent = expectedPosText;
        }
        const expectedPosClass = `${rankClasses.join(' ')} tv-posicao`;
        if (posEl.className !== expectedPosClass) {
          posEl.className = expectedPosClass;
        }
      }

      // Atualiza o indicador de movimento (subiu/desceu)
      const movEl = rowEl.querySelector('.tv-mov-wrap');
      if (movEl && movEl.innerHTML !== movBadge) {
        movEl.innerHTML = movBadge;
      }

      // Atualiza o selo "Você"
      const voceEl = rowEl.querySelector('.tv-voce-wrap');
      if (voceEl && voceEl.innerHTML !== voceBadge) {
        voceEl.innerHTML = voceBadge;
      }

      // Atualiza o nome se necessário
      const nameEl = rowEl.querySelector('.tv-nome');
      if (nameEl && nameEl.textContent !== user.nome) {
        nameEl.textContent = user.nome;
      }

      // Atualiza avatar se necessário
      const avatarEl = rowEl.querySelector('.tv-avatar');
      if (avatarEl && avatarEl.getAttribute('src') !== fotoUrl) {
        avatarEl.setAttribute('src', fotoUrl);
      }

      // Atualiza badge de ADMIN
      const adminEl = rowEl.querySelector('.tv-admin-badge');
      if (adminEl) {
        if (user.isAdmin) {
          adminEl.classList.remove('hidden');
        } else {
          adminEl.classList.add('hidden');
        }
      }

      // Atualiza pontos consolidados (fixos)
      const fixoEl = rowEl.querySelector('.tv-fixo');
      if (fixoEl) {
        const expectedFixoText = `Fixo: ${user.pontosConsolidados} pts`;
        if (fixoEl.textContent !== expectedFixoText) {
          fixoEl.textContent = expectedFixoText;
        }
      }

      // Atualiza pontos totais
      const totalEl = rowEl.querySelector('.tv-total');
      if (totalEl) {
        const expectedTotalText = String(user.totalProvisorio);
        if (totalEl.textContent !== expectedTotalText) {
          totalEl.textContent = expectedTotalText;
        }
      }
    }

    // Atualiza badge live da pontuação provisória
    const liveBadgeEl = rowEl.querySelector('.tv-live-badge');
    if (liveBadgeEl) {
      if (user.pontosParciaisAoVivo > 0) {
        const badgeContent = `<span class="bg-red-500/15 text-red-400 border border-red-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 font-black">● +${user.pontosParciaisAoVivo}</span>`;
        if (liveBadgeEl.innerHTML !== badgeContent) {
          liveBadgeEl.innerHTML = badgeContent;
        }
      } else {
        if (liveBadgeEl.innerHTML !== '') {
          liveBadgeEl.innerHTML = '';
        }
      }
    }
  });

  // Reordena elementos existentes no DOM sem recriar
  rankingSorted.forEach(user => {
    const rowEl = rankingContainer.querySelector(`[data-user-id="${user.id}"]`);
    if (rowEl) {
      rankingContainer.appendChild(rowEl);
    }
  });

  // Remove qualquer membro que saiu
  const currentMemberIds = rankingSorted.map(u => String(u.id));
  const existingRows = rankingContainer.querySelectorAll('[data-user-id]');
  existingRows.forEach(row => {
    const uid = row.getAttribute('data-user-id');
    if (!currentMemberIds.includes(uid)) {
      row.remove();
    }
  });

  // 3. RENDERIZA PALPITES DOS AMIGOS NOS JOGOS AO VIVO
  if (jogosAtivosGrupo.length === 0) {
    const htmlSemPalpites = `
      <div class="bg-card-bg p-6 rounded-2xl border border-white/5 text-center text-text-muted text-[12px] font-semibold flex flex-col items-center justify-center gap-2">
        <span>⚽</span>
        <span>Os palpites serão exibidos aqui em tempo real assim que os jogos começarem.</span>
      </div>
    `;
    if (palpitesContainer.innerHTML !== htmlSemPalpites) {
      palpitesContainer.innerHTML = htmlSemPalpites;
    }
  } else {
    let htmlPalpitesGeral = '';

    jogosAtivosGrupo.forEach(jogo => {
      const matchGuesses = tvDados.palpites.filter(g => g.match_id === jogo.fixture.id);
      const zJogoP = zebrasTV[jogo.fixture.id] || {};

      let htmlGuessesList = '';
      if (matchGuesses.length === 0) {
        htmlGuessesList = '<p class="text-text-muted text-[11px] py-3 text-center">Ninguém palpitou nessa partida.</p>';
      } else {
        matchGuesses.forEach(g => {
          const perfil = tvDados.perfis.find(p => p.id === g.user_id);
          const fotoUrl = perfil?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(perfil?.full_name || 'U') + '&background=random&color=fff';

          const foiNaZebra = (g.score_home > g.score_away && zJogoP.homeZebra) || (g.score_away > g.score_home && zJogoP.awayZebra) || (g.score_home === g.score_away && zJogoP.empateZebra);
          const zebraPlayerTag = foiNaZebra ? '<span class="text-[11px] flex-shrink-0" title="Foi na zebra! Coragem.">🦓</span>' : '';

          const liveHome = jogo.goals.home ?? 0;
          const liveAway = jogo.goals.away ?? 0;
          const vencedorLiveP = liveHome > liveAway ? 'home' : (liveHome < liveAway ? 'away' : 'empate');
          const pctVencedorP = (zJogoP[vencedorLiveP + 'Pct'] !== undefined) ? zJogoP[vencedorLiveP + 'Pct'] : 100;
          const ptsParciais = calcularPontosPalpite(g.score_home, g.score_away, liveHome, liveAway, jogo.league.round, pctVencedorP);
          const ehExato = (g.score_home === liveHome && g.score_away === liveAway);

          let ptsBadge = '';
          if (ehExato && ptsParciais > 0) {
            ptsBadge = `<span class="bg-gold/20 text-gold text-[9px] font-black px-2 py-0.5 rounded border border-gold/30 uppercase tracking-wide">+${ptsParciais} PTS (Exato)</span>`;
          } else if (ptsParciais > 0) {
            ptsBadge = `<span class="bg-brand-green/20 text-brand-green text-[9px] font-black px-2 py-0.5 rounded border border-brand-green/30 uppercase tracking-wide">+${ptsParciais} PTS</span>`;
          } else {
            ptsBadge = '<span class="bg-zinc-800 text-zinc-500 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide">0 PTS</span>';
          }

          htmlGuessesList += `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div class="flex items-center gap-2 min-w-0">
                <img src="${fotoUrl}" class="w-6 h-6 rounded-full border border-white/10 object-cover flex-shrink-0">
                <span class="text-[12px] font-bold text-zinc-300 truncate">${perfil?.full_name || 'Participante'}</span>
                ${zebraPlayerTag}
              </div>
              <div class="flex items-center gap-3 flex-shrink-0">
                <span class="text-[12px] font-black font-mono text-white">${g.score_home} x ${g.score_away}</span>
                ${ptsBadge}
              </div>
            </div>
          `;
        });
      }

      htmlPalpitesGeral += `
        <div class="bg-zinc-900/85 p-5 rounded-2xl border border-purple-500/20 shadow-[0_0_18px_rgba(168,85,247,0.08)] mb-3 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent pointer-events-none"></div>
          <div class="relative">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
              <h4 class="font-black text-[12px] text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <span>${jogo.teams.home.name} vs ${jogo.teams.away.name}</span>
              </h4>
              <span class="text-[10px] text-red-400 animate-pulse font-black bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">${jogo.fixture.status.elapsed}' AO VIVO</span>
            </div>
            <div class="space-y-2">
              ${htmlGuessesList}
            </div>
          </div>
        </div>
      `;
    });

    if (palpitesContainer.innerHTML !== htmlPalpitesGeral) {
      palpitesContainer.innerHTML = htmlPalpitesGeral;
    }
  }
}
