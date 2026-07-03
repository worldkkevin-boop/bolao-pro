// ============ API FOOTBALL (API-SPORTS) ============

// Salva no banco (tabela matches) os jogos JÁ FINALIZADOS vindos da API. Vira a
// fonte de verdade durável dos resultados: se a API cair, o ranking continua
// pontuando por aqui em vez de zerar. Fire-and-forget (falha não trava o app).
async function _persistirResultadosFinalizados(jogos) {
  if (!sbClient || !Array.isArray(jogos)) return;
  const FINAL = ['FT', 'AET', 'PEN'];
  const flag = (id, fallback) => (typeof getFlagUrl === 'function' ? getFlagUrl(id) : null) || fallback || '';
  const rows = jogos
    .filter(j => j.fixture && FINAL.includes(j.fixture.status?.short) && j.goals?.home != null && j.goals?.away != null)
    .map(j => {
      // Salva o placar que VALE pro bolão (90'): em jogos AET/PEN, score.fulltime
      // é o resultado do tempo normal — não o total com prorrogação. Assim o cache
      // (usado quando a API cai) já guarda o placar correto pra pontuação.
      const vale = (typeof placarValido === 'function')
        ? placarValido(j)
        : { home: j.goals.home, away: j.goals.away };
      return {
        id:           j.fixture.id,
        league_id:    j.league.id,
        season:       j.league.season,
        home_team:    j.teams.home.name,
        home_team_id: j.teams.home.id,
        home_logo:    flag(j.teams.home.id, j.teams.home.logo),
        away_team:    j.teams.away.name,
        away_team_id: j.teams.away.id,
        away_logo:    flag(j.teams.away.id, j.teams.away.logo),
        kickoff:      j.fixture.date,
        status:       j.fixture.status.short,
        score_home:   vale.home,
        score_away:   vale.away,
        minute:       j.fixture.status.elapsed != null ? String(j.fixture.status.elapsed) : null,
        round:        j.league.round
      };
    });
  if (!rows.length) return;
  try {
    await sbClient.from('matches').upsert(rows, { onConflict: 'id' });
  } catch (e) {
    console.warn('Não consegui salvar resultados no cache:', e && e.message);
  }
}

// Reconstrói a lista de jogos a partir do banco (matches) no formato que o resto
// do app espera, pra usar quando a API estiver fora. season fixa 2026 (igual ao código).
async function _carregarJogosDoCache(leagueId) {
  if (!sbClient) return [];
  try {
    const { data, error } = await sbClient
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', 2026);
    if (error || !Array.isArray(data)) return [];
    return data.map(m => ({
      fixture: { id: m.id, date: m.kickoff, status: { short: m.status, elapsed: m.minute != null ? Number(m.minute) : null } },
      league:  { id: m.league_id, season: m.season, round: m.round },
      teams: {
        home: { id: m.home_team_id, name: m.home_team, logo: m.home_logo },
        away: { id: m.away_team_id, name: m.away_team, logo: m.away_logo }
      },
      goals: { home: m.score_home, away: m.score_away },
      _fromCache: true
    }));
  } catch (e) {
    console.warn('Cache de jogos (matches) falhou:', e && e.message);
    return [];
  }
}

async function carregarJogos() {
  const leagueId = (grupoAtual && grupoAtual.league_id) ? grupoAtual.league_id : 1;
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=2026`;
  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
      }
    });
    const dados = await resposta.json();
    const jogosAPI = Array.isArray(dados.response) ? dados.response : [];

    if (jogosAPI.length > 0) {
      // API OK: usa os dados frescos e SALVA os resultados finalizados no banco
      // (rede de segurança — se a API cair depois, o ranking não zera).
      todosOsJogos = jogosAPI;
      _persistirResultadosFinalizados(jogosAPI);
    } else {
      // API vazia/fora (ex.: plano vencido, cota estourada): cai pro CACHE do
      // banco (matches) pra manter o ranking/pontos de pé com o último resultado.
      const cache = await _carregarJogosDoCache(leagueId);
      todosOsJogos = cache;
      if (cache.length > 0 && typeof showToast === 'function') {
        showToast('⚠️ Dados ao vivo fora do ar — mostrando os últimos resultados salvos.', 'info');
      }
      if (dados.errors) console.warn('API-Football indisponível, usando cache:', dados.errors);
    }

    // Grupo "Apenas mata-mata": ignora a fase de grupos, só conta os jogos da eliminatória.
    if (grupoAtual && grupoAtual.apenas_mata_mata && Array.isArray(todosOsJogos)) {
      todosOsJogos = todosOsJogos.filter(j => {
        const r = (j.league && j.league.round) || '';
        return !/group stage/i.test(r);
      });
    }

    // Filtro específico para o grupo "Amistosos da Copa" (Apenas jogos de 06 a 11 de Junho de 2026)
    if (grupoAtual && grupoAtual.name === 'Amistosos da Copa' && Array.isArray(todosOsJogos)) {
      todosOsJogos = todosOsJogos.filter(j => {
        if (!j.fixture || !j.fixture.date) return false;
        const dateObj = new Date(j.fixture.date);
        const ano = dateObj.getUTCFullYear();
        const mes = dateObj.getUTCMonth(); // Junho é 5 (0-indexed)
        const dia = dateObj.getUTCDate();
        return ano === 2026 && mes === 5 && dia >= 6 && dia <= 11;
      });
    }

    // Busca palpites existentes do usuário para esse grupo
    palpitesUsuario = [];
    distribuicaoPalpitesGrupo = {};
    if (sbClient && grupoAtual) {
      const { data: { user } } = await sbClient.auth.getUser();
      if (user) {
        // 1. Busca palpites do usuário
        const { data, error } = await sbClient
          .from('guesses')
          .select('match_id, score_home, score_away')
          .eq('user_id', user.id)
          .eq('group_id', grupoAtual.id);
        
        if (!error && data) {
          palpitesUsuario = data;
        }

        // 2. Busca palpites de todos os usuários para calcular Zebra Dinâmica
        // (paginado — o teto fixo cortava palpites e bagunçava a % da zebra)
        const allGroupGuesses = await buscarTodosPalpitesGrupo(grupoAtual.id, 'match_id, score_home, score_away');

        if (allGroupGuesses && allGroupGuesses.length > 0) {
          const distribuicao = {};
          allGroupGuesses.forEach(g => {
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
          
          for (const mId in distribuicao) {
            const d = distribuicao[mId];
            distribuicaoPalpitesGrupo[mId] = {
              home: d.total > 0 ? (d.home / d.total) * 100 : 0,
              away: d.total > 0 ? (d.away / d.total) * 100 : 0,
              empate: d.total > 0 ? (d.empate / d.total) * 100 : 0,
              total: d.total
            };
          }
        }
      }
    }

    if (typeof gerarFiltrosRodadas === 'function') gerarFiltrosRodadas();
    if (typeof filtrarPorRodada === 'function') filtrarPorRodada(rodadaSelecionada);
    if (typeof atualizarDestaquesHomeGrupo === 'function') atualizarDestaquesHomeGrupo();
    if (typeof atualizarSeletorRanking === 'function') atualizarSeletorRanking();
    if (typeof exibirRankingSelecionado === 'function') exibirRankingSelecionado();

    // Restaura a tela de detalhes da partida se a página foi recarregada (F5) nela
    const lastActiveView = localStorage.getItem('last_active_view');
    const lastActiveMatchId = localStorage.getItem('last_active_match_id');
    if (lastActiveView === 'view-palpite' && lastActiveMatchId) {
      const matchId = parseInt(lastActiveMatchId);
      if (todosOsJogos && todosOsJogos.some(j => j.fixture.id === matchId)) {
        if (typeof abrirTelaPalpite === 'function') {
          abrirTelaPalpite(matchId);
        }
      }
    }

    // Redirecionamento automático para partida específica se solicitado (via link de desafio)
    const redirectMatch = localStorage.getItem('redirect_match');
    if (redirectMatch) {
      const matchId = parseInt(redirectMatch);
      localStorage.removeItem('redirect_match');
      if (todosOsJogos && todosOsJogos.some(j => j.fixture.id === matchId)) {
        if (typeof abrirTelaPalpite === 'function') {
          // Pequeno timeout para dar tempo da transição de telas/DOM assentar
          setTimeout(() => {
            abrirTelaPalpite(matchId);
          }, 300);
        }
      }
    }
  } catch (erro) {
    console.error("Erro ao puxar os jogos:", erro);
  }
}

// Jogos AO VIVO da liga do grupo, buscando NO FEED DA LIGA (/fixtures?league=&season=2026)
// em vez do /fixtures?live=all. Motivo: a API-Football às vezes NÃO inclui a Copa (league 1)
// no feed live=all (a cobertura "live" dela oscila), então o Modo TV mostrava "FORA DO AR"
// enquanto a aba Jogos (que lê do feed da liga) já mostrava o jogo AO VIVO. O feed da liga
// é superset do live=all pra aquela liga → pega todo jogo rolando sem depender da cobertura live.
// Custo: 1 request/ciclo (mesmo peso do live=all), mas com o placar/elapsed frescos.
async function buscarJogosAoVivoLiga(leagueId) {
  const statusAoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT', 'SUSP'];
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=2026`;
  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
      }
    });
    if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
    const dados = await resposta.json();
    if (dados.errors && (Array.isArray(dados.errors) ? dados.errors.length > 0 : Object.keys(dados.errors).length > 0)) {
      throw new Error(JSON.stringify(dados.errors));
    }
    const todos = dados.response || [];
    return todos.filter(j => statusAoVivo.includes(j.fixture.status.short));
  } catch (erro) {
    console.error("Erro na API-Football (Ao Vivo da liga):", erro);
    return null;
  }
}

async function buscarDadosAoVivo() {
  const url = 'https://v3.football.api-sports.io/fixtures?live=all';
  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
      }
    });
    if (!resposta.ok) {
      throw new Error(`Erro HTTP: ${resposta.status}`);
    }
    const dados = await resposta.json();
    if (dados.errors && (Array.isArray(dados.errors) ? dados.errors.length > 0 : Object.keys(dados.errors).length > 0)) {
      throw new Error(JSON.stringify(dados.errors));
    }
    return dados.response || [];
  } catch (erro) {
    console.error("Erro na API-Football (Ao Vivo):", erro);
    return null;
  }
}

