// ============ API FOOTBALL (API-SPORTS) ============

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
    todosOsJogos = dados.response;

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
        const { data: allGroupGuesses, error: errAll } = await sbClient
          .from('guesses')
          .select('match_id, score_home, score_away')
          .eq('group_id', grupoAtual.id)
          .limit(2000);
        
        if (!errAll && allGroupGuesses) {
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

