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
    if (sbClient && grupoAtual) {
      const { data: { user } } = await sbClient.auth.getUser();
      if (user) {
        const { data, error } = await sbClient
          .from('guesses')
          .select('match_id, score_home, score_away')
          .eq('user_id', user.id)
          .eq('group_id', grupoAtual.id);
        
        if (!error && data) {
          palpitesUsuario = data;
        }
      }
    }

    if (typeof gerarFiltrosRodadas === 'function') gerarFiltrosRodadas();
    if (typeof filtrarPorRodada === 'function') filtrarPorRodada(rodadaSelecionada);
    if (typeof atualizarDestaquesHomeGrupo === 'function') atualizarDestaquesHomeGrupo();
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

