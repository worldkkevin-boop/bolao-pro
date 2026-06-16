// ============ GAME MASTER (GM) ENGINE ============

let jogosLigaGM = [];

// Verifica se o usuário atual é o Game Master
function verificarUsuarioGM() {
  const container = document.getElementById('gm-panel-button-container');
  if (!container) return;

  console.log("[GM CHECK] Usuario atual logado:", usuarioAtual);

  if (usuarioAtual && usuarioAtual.email === 'worldkkevin@gmail.com') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

// Direciona para a view do GM
function abrirPainelGM() {
  window.location.href = '/gm';
}

// Normaliza strings para busca/comparação insensível a acentos e maiúsculas
function normalizarNome(str) {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Verifica se dois nomes de jogadores coincidem (por exemplo, "Pedro" e "Pedro Guilherme" ou "Arrascaeta" e "G. de Arrascaeta")
function nomesCoincidem(nomeCompleto, nomeBusca) {
  if (!nomeCompleto || !nomeBusca) return false;
  const comp = normalizarNome(nomeCompleto);
  const busca = normalizarNome(nomeBusca);
  return comp.includes(busca) || busca.includes(comp);
}

// Carrega as partidas de uma liga específica no painel do GM
async function carregarJogosLigaGM() {
  const selectLiga = document.getElementById('select-gm-liga');
  const selectJogo = document.getElementById('select-gm-jogo');
  if (!selectLiga || !selectJogo) return;

  const leagueId = selectLiga.value;
  selectJogo.innerHTML = '<option value="">Carregando partidas...</option>';

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
    jogosLigaGM = dados.response || [];

    selectJogo.innerHTML = '<option value="">Selecione uma partida...</option>';
    
    // Filtra jogos que ainda não terminaram ou estão ao vivo
    const statusTerminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];
    const jogosAtivos = jogosLigaGM.filter(j => j.fixture && j.fixture.status && !statusTerminados.includes(j.fixture.status.short));
    
    // Ordena por data
    jogosAtivos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    jogosAtivos.forEach(j => {
      const dataStr = new Date(j.fixture.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      selectJogo.innerHTML += `<option value="${j.fixture.id}">${j.teams.home.name} x ${j.teams.away.name} (${dataStr})</option>`;
    });
  } catch (erro) {
    console.error("Erro ao puxar os jogos da liga do GM:", erro);
    selectJogo.innerHTML = '<option value="">Erro ao carregar partidas</option>';
  }
}

// Carrega os dados da tela do GM
async function carregarGMView() {
  const selectJogo = document.getElementById('select-gm-jogo');
  const listaDesafios = document.getElementById('lista-desafios-gm');

  if (selectJogo) {
    if (!jogosLigaGM || jogosLigaGM.length === 0) {
      await carregarJogosLigaGM();
    } else {
      selectJogo.innerHTML = '<option value="">Selecione uma partida...</option>';
      // Filtra jogos que ainda não terminaram ou estão ao vivo
      const statusTerminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];
      const jogosAtivos = jogosLigaGM.filter(j => j.fixture && j.fixture.status && !statusTerminados.includes(j.fixture.status.short));
      
      // Ordena por data
      jogosAtivos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

      jogosAtivos.forEach(j => {
        const dataStr = new Date(j.fixture.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        selectJogo.innerHTML += `<option value="${j.fixture.id}">${j.teams.home.name} x ${j.teams.away.name} (${dataStr})</option>`;
      });
    }
  }

  if (listaDesafios && sbClient) {
    listaDesafios.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Carregando desafios...</p>';
    try {
      const { data: desafios, error } = await sbClient
        .from('desafios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        listaDesafios.innerHTML = `<p class="text-red-400 text-[13px] text-center py-6">Erro: ${error.message}</p>`;
        return;
      }

      if (!desafios || desafios.length === 0) {
        listaDesafios.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Nenhum desafio lançado ainda.</p>';
        return;
      }

      let gmListHtml = '';
      desafios.forEach(d => {
        const statusClass = d.status === 'active' ? 'bg-brand-green/20 text-brand-green border-brand-green/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700';
        const labelStatus = d.status === 'active' ? 'Ativo' : 'Resolvido';
        const custoBadge = d.custo_fichas > 0
          ? `<span class="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">🎫 ${d.custo_fichas}</span>`
          : '';

        gmListHtml += `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div class="min-w-0 flex-1">
                <h4 class="font-black text-[14px] text-white truncate">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5 flex items-center gap-2">
                  Regra: <strong>${traduzirRegraDesafio(d.event_type)}</strong> · +${d.points} pts ${custoBadge}
                </p>
              </div>
              <span class="text-[9px] font-black px-2 py-0.5 rounded-full border ${statusClass} ml-2 flex-shrink-0">${labelStatus}</span>
            </div>
            <p class="text-[11px] text-text-muted">Opções: <span class="text-white">${d.players.join(', ')}</span></p>

            <div class="flex gap-2 mt-4">
              ${d.status === 'active' ? `
                <button onclick="resolverDesafioReal('${d.id}', ${d.fixture_id}, '${d.event_type}', ${JSON.stringify(d.players).replace(/"/g, '&quot;')})" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                  Resolver com API
                </button>
                <button onclick="compartilharDesafioGM('${d.match_name.replace(/'/g, "\\'")}', '${d.event_type}', ${d.points}, ${JSON.stringify(d.players).replace(/"/g, '&quot;')}, ${d.fixture_id})" class="px-3 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-1">
                  📲
                </button>
              ` : ''}
              <button onclick="excluirDesafioReal('${d.id}')" class="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                Excluir
              </button>
            </div>
          </div>
        `;
      });
      listaDesafios.innerHTML = gmListHtml;
    } catch (e) {
      console.error(e);
      listaDesafios.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro no processamento.</p>';
    }
  }
}

// Criação de desafio no banco
async function criarDesafioReal() {
  const selectJogo = document.getElementById('select-gm-jogo');
  const selectEvento = document.getElementById('select-gm-evento');
  const inputPontos = document.getElementById('input-gm-pontos');
  const checkboxPenalty = document.getElementById('checkbox-gm-penalty');
  const inputFichas = document.getElementById('input-gm-fichas');

  if (!selectJogo || !selectEvento || !inputPontos) return;

  const fixtureId = parseInt(selectJogo.value);
  let eventType = selectEvento.value;
  const points = parseInt(inputPontos.value) || 50;
  const custoFichas = parseInt(inputFichas?.value) || 0;
  const hasPenalty = checkboxPenalty ? checkboxPenalty.checked : false;

  if (!fixtureId) { showToast('Selecione uma partida!', 'error'); return; }
  if (!eventType) { showToast('Selecione o tipo de evento!', 'error'); return; }

  // Coleta jogadores/opções
  const players = [];
  for (let i = 1; i <= 4; i++) {
    const val = document.getElementById(`input-gm-player-${i}`).value.trim();
    if (val) players.push(val);
  }

  if (players.length < 2) {
    showToast('Insira pelo menos 2 opções para o desafio!', 'error');
    return;
  }

  // Se tiver penalidade, anexa sufixo para controle no banco
  if (hasPenalty) {
    eventType += '_penalty';
  }

  const selectedOptionText = selectJogo.options[selectJogo.selectedIndex].text;
  const matchName = selectedOptionText.substring(0, selectedOptionText.lastIndexOf(' ('));

  const btn = document.getElementById('btn-gm-criar-desafio');
  if (btn) { btn.disabled = true; btn.innerText = 'Lançando...'; }

  try {
    const { error } = await sbClient
      .from('desafios')
      .insert([{
        fixture_id: fixtureId,
        match_name: matchName,
        event_type: eventType,
        points: points,
        custo_fichas: custoFichas,
        players: players,
        status: 'active'
      }]);

    if (btn) { btn.disabled = false; btn.innerText = 'Lançar Desafio'; }

    if (error) {
      showToast('Erro ao criar desafio: ' + error.message, 'error');
      return;
    }

    // Dispara notificação push para o grupo sobre o Desafio Relâmpago
    if (typeof grupoAtual !== 'undefined' && grupoAtual) {
      if (typeof dispararNotificacaoPush === 'function') {
        let tipoTexto = 'Próximo Gol';
        if (eventType.startsWith('card_red')) tipoTexto = 'Cartão Vermelho';
        else if (eventType.startsWith('card_yellow')) tipoTexto = 'Cartão Amarelo';
        else if (eventType.startsWith('penalty')) tipoTexto = 'Próximo Pênalti';
        
        dispararNotificacaoPush({
          groupId: grupoAtual.id,
          title: '⚡ Desafio Relâmpago!',
          body: `O Mago lançou um desafio de ${tipoTexto} valendo ${points} pts no jogo ${matchName}! Responda rápido!`,
          url: '/'
        });
      }
    }

    // Limpa os inputs e redefine permissões de escrita
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`input-gm-player-${i}`);
      el.value = '';
      el.readOnly = false;
      el.disabled = false;
      el.disabled = false;
    }
    inputPontos.value = 50;
    selectJogo.value = '';
    if (checkboxPenalty) checkboxPenalty.checked = false;

    showToast("Aposta tirada da cartola! Desafio lançado.", "mago");
    carregarGMView();

  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerText = 'Lançar Desafio'; }
  }
}

// Preenche e bloqueia os campos de opções baseado no tipo de desafio
function ajustarCamposDesafioGM() {
  const evento = document.getElementById('select-gm-evento').value;
  const p1 = document.getElementById('input-gm-player-1');
  const p2 = document.getElementById('input-gm-player-2');
  const p3 = document.getElementById('input-gm-player-3');
  const p4 = document.getElementById('input-gm-player-4');

  if (!p1 || !p2 || !p3 || !p4) return;

  if (evento.startsWith('CornersOver') || evento.startsWith('CardsOver')) {
    const isCorner = evento.startsWith('CornersOver');
    const limit = isCorner ? evento.replace('CornersOver', '') : evento.replace('CardsOver', '');
    p1.value = `Mais de ${limit}`;
    p2.value = `Menos de ${limit}`;
    p1.readOnly = true;
    p2.readOnly = true;
    p3.value = '';
    p4.value = '';
    p3.disabled = true;
    p4.disabled = true;
  } else if (evento === 'BTTS') {
    p1.value = 'Sim';
    p2.value = 'Não';
    p1.readOnly = true;
    p2.readOnly = true;
    p3.value = '';
    p4.value = '';
    p3.disabled = true;
    p4.disabled = true;
  } else {
    p1.readOnly = false;
    p2.readOnly = false;
    p3.disabled = false;
    p4.disabled = false;
    
    // Limpa apenas se eram valores automatizados
    if (p1.value === 'Sim' || p1.value.startsWith('Mais de ')) {
      p1.value = '';
      p2.value = '';
    }
  }
}

// Exclusão de desafio
async function excluirDesafioReal(id) {
  if (!confirm('Deseja realmente excluir este desafio? Os palpites dos usuários também serão apagados.')) return;
  try {
    const { error } = await sbClient
      .from('desafios')
      .delete()
      .eq('id', id);

    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'error');
      return;
    }
    carregarGMView();
  } catch (e) {
    console.error(e);
  }
}

// Resolução de desafio com API de eventos
async function resolverDesafioReal(desafioId, fixtureId, eventType, players) {
  if (!confirm('Deseja realmente obter os dados da API para resolver este desafio?')) return;

  const hasPenalty = eventType.endsWith('_penalty');
  const cleanEventType = eventType.replace('_penalty', '');
  
  try {
    let jogadoresVencedores = [];

    if (cleanEventType.startsWith('CornersOver')) {
      // 1. Escanteios (estatísticas da partida)
      const url = `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`;
      const resposta = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "v3.football.api-sports.io",
          "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
        }
      });
      const dados = await resposta.json();
      const statsResponse = dados.response || [];

      let totalCorners = 0;
      statsResponse.forEach(teamData => {
        const cornerStat = teamData.statistics.find(s => s.type === 'Corner Kicks');
        if (cornerStat && cornerStat.value !== null) {
          totalCorners += parseInt(cornerStat.value) || 0;
        }
      });

      const limit = parseFloat(cleanEventType.replace("CornersOver", "")) || 9.5;
      const resultText = totalCorners > limit ? `Mais de ${limit}` : `Menos de ${limit}`;
      jogadoresVencedores = [resultText];
      
      console.log(`[RESOLVER DESAFIO] Escanteios: ${totalCorners}, Limite: ${limit}, Vencedor: ${resultText}`);

    } else if (cleanEventType.startsWith('CardsOver')) {
      // 1b. Cartões (estatísticas da partida)
      const url = `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`;
      const resposta = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "v3.football.api-sports.io",
          "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
        }
      });
      const dados = await resposta.json();
      const statsResponse = dados.response || [];

      let totalCards = 0;
      statsResponse.forEach(teamData => {
        const yellowStat = teamData.statistics.find(s => s.type === 'Yellow Cards');
        const redStat = teamData.statistics.find(s => s.type === 'Red Cards');
        if (yellowStat && yellowStat.value !== null) {
          totalCards += parseInt(yellowStat.value) || 0;
        }
        if (redStat && redStat.value !== null) {
          totalCards += parseInt(redStat.value) || 0;
        }
      });

      const limit = parseFloat(cleanEventType.replace("CardsOver", "")) || 4.5;
      const resultText = totalCards > limit ? `Mais de ${limit}` : `Menos de ${limit}`;
      jogadoresVencedores = [resultText];
      
      console.log(`[RESOLVER DESAFIO] Cartões: ${totalCards}, Limite: ${limit}, Vencedor: ${resultText}`);

    } else if (cleanEventType === 'BTTS') {
      // 2. Ambos Marcam (BTTS)
      const url = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
      const resposta = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "v3.football.api-sports.io",
          "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
        }
      });
      const dados = await resposta.json();
      const fixtureData = dados.response && dados.response[0] ? dados.response[0] : null;
      
      if (!fixtureData) {
        throw new Error("Não foi possível carregar os dados da partida para Ambos Marcam.");
      }

      const goalsHome = fixtureData.goals.home;
      const goalsAway = fixtureData.goals.away;
      const bttsSim = (goalsHome > 0 && goalsAway > 0);
      const resultText = bttsSim ? 'Sim' : 'Não';
      jogadoresVencedores = [resultText];
      
      console.log(`[RESOLVER DESAFIO] Ambos Marcam: Placar ${goalsHome}x${goalsAway}, Vencedor: ${resultText}`);

    } else {
      // 3. Gols, Assistências ou Cartões (usa eventos)
      const url = `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`;
      const resposta = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "v3.football.api-sports.io",
          "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
        }
      });

      const dados = await resposta.json();
      const eventos = dados.response || [];

      eventos.forEach(evt => {
        if (evt.type === 'Goal') {
          const autorGoal = evt.player ? evt.player.name : '';
          const autorAssist = evt.assist ? evt.assist.name : '';

          players.forEach(p => {
            if (cleanEventType === 'Goal' && nomesCoincidem(autorGoal, p)) {
              if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
            } else if (cleanEventType === 'Assist' && nomesCoincidem(autorAssist, p)) {
              if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
            }
          });
        }

        if (evt.type === 'Card') {
          const playerCard = evt.player ? evt.player.name : '';
          const detail = evt.detail || '';

          players.forEach(p => {
            if (cleanEventType === 'CardYellow' && detail.toLowerCase().includes('yellow') && nomesCoincidem(playerCard, p)) {
              if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
            } else if (cleanEventType === 'CardRed' && detail.toLowerCase().includes('red') && nomesCoincidem(playerCard, p)) {
              if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
            }
          });
        }
      });
    }

    console.log("Opções vencedoras encontradas:", jogadoresVencedores);

    // Carrega todos os votos dos usuários para esse desafio
    const { data: votos, error: errVotos } = await sbClient
      .from('user_desafios')
      .select('*')
      .eq('desafio_id', desafioId);

    if (errVotos) {
      showToast('Erro ao carregar palpites dos usuários: ' + errVotos.message, 'error');
      return;
    }

    // Carrega os dados do próprio desafio para obter os pontos
    const { data: desafio, error: errDesafio } = await sbClient
      .from('desafios')
      .select('points')
      .eq('id', desafioId)
      .single();

    if (errDesafio || !desafio) {
      showToast('Erro ao buscar pontos do desafio.', 'error');
      return;
    }

    const pontosPremio = desafio.points || 50;
    let totalPontuados = 0;
    let totalPerdedores = 0;

    // Atualiza os pontos de cada voto
    if (votos && votos.length > 0) {
      for (const voto of votos) {
        const acertou = jogadoresVencedores.some(p => nomesCoincidem(p, voto.chosen_player));
        const pontosGanhos = acertou ? pontosPremio : (hasPenalty ? -pontosPremio : 0);

        if (acertou) {
          totalPontuados++;
        } else {
          totalPerdedores++;
        }

        await sbClient
          .from('user_desafios')
          .update({ points_awarded: pontosGanhos })
          .eq('id', voto.id);
      }
    }

    // Marca o desafio como resolvido
    await sbClient
      .from('desafios')
      .update({ status: 'resolved' })
      .eq('id', desafioId);

    const msgPenalidade = hasPenalty 
      ? `\nErros com penalidade aplicados: ${totalPerdedores} participantes perderam -${pontosPremio} pts.`
      : '';

    showToast(`Desafio resolvido! Vencedor: ${jogadoresVencedores.join(', ') || 'Nenhum'}. Premiados: ${totalPontuados} (+${pontosPremio} pts).`, 'success');
    carregarGMView();

  } catch (e) {
    console.error(e);
    showToast('Erro no processamento da resolução do desafio.', 'error');
  }
}

// ============ GERENCIAMENTO DE ABAS DO GM ============

function switchGMTab(tabId) {
  const sections = ['desafios', 'grupos', 'stats', 'estrategia'];
  sections.forEach(sec => {
    const el = document.getElementById('gm-section-' + sec);
    const navBtn = document.getElementById('nav-gm-' + sec);
    if (el) {
      if (sec === tabId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
    if (navBtn) {
      if (sec === tabId) {
        navBtn.className = 'flex flex-col items-center justify-center gap-1 text-purple-400 bg-purple-500/10 px-4 py-2 rounded-xl transition-all';
      } else {
        navBtn.className = 'flex flex-col items-center justify-center gap-1 text-text-muted hover:text-white transition-all';
      }
    }
  });

  if (tabId === 'grupos') {
    carregarGMGrupos();
  } else if (tabId === 'stats') {
    carregarGMMetricas();
  } else if (tabId === 'desafios') {
    carregarGMView();
  } else if (tabId === 'estrategia') {
    carregarGMEstrategia();
  }
}

// ============ ESTRATÉGIA DO MAGO (apoio à decisão de palpites) ============
// Usa estatísticas da API-Football (predictions + odds) pra sugerir placares
// pras duas contas (Você + Gaby), cobrindo mais cenários. É só apoio.
const ESTRATEGIA_API_HOST = 'v3.football.api-sports.io';
const ESTRATEGIA_API_KEY  = '47ca2bb05eb5931347aca04964818eb5';
const ESTRATEGIA_SEASON   = 2026;
let estrategiaJogosMap = {};

async function carregarGMEstrategia() {
  const cont = document.getElementById('estrategia-jogos');
  if (!cont) return;
  cont.innerHTML = '<p class="text-text-muted text-[12px] text-center py-6 animate-pulse">Carregando próximos jogos...</p>';
  const leagueId = (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.league_id) ? grupoAtual.league_id : 1;
  try {
    const resp = await fetch(`https://${ESTRATEGIA_API_HOST}/fixtures?league=${leagueId}&season=${ESTRATEGIA_SEASON}&next=8`, {
      headers: { 'x-rapidapi-host': ESTRATEGIA_API_HOST, 'x-rapidapi-key': ESTRATEGIA_API_KEY }
    });
    const dados = await resp.json();
    const jogos = Array.isArray(dados.response) ? dados.response : [];
    if (jogos.length === 0) {
      cont.innerHTML = '<p class="text-text-muted text-[12px] text-center py-6">Nenhum jogo próximo encontrado nessa liga.</p>';
      return;
    }
    estrategiaJogosMap = {};
    cont.innerHTML = jogos.map(j => {
      estrategiaJogosMap[j.fixture.id] = { home: j.teams.home.name, away: j.teams.away.name };
      const data = new Date(j.fixture.date).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="bg-card-bg border border-white/5 rounded-2xl p-4">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[10px] text-text-muted font-bold mb-0.5">${data}</p>
              <p class="text-[13px] font-bold text-white truncate">${j.teams.home.name} <span class="text-text-muted">x</span> ${j.teams.away.name}</p>
            </div>
            <button onclick="analisarJogoEstrategia(${j.fixture.id}, this)" class="flex-shrink-0 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-black uppercase tracking-wide px-3 py-2 rounded-xl active:scale-95 transition-all">Analisar</button>
          </div>
          <div id="estrategia-result-${j.fixture.id}" class="mt-3 hidden"></div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar jogos da estratégia:', e);
    cont.innerHTML = '<p class="text-red-400 text-[12px] text-center py-6">Erro ao carregar jogos.</p>';
  }
}

async function analisarJogoEstrategia(fixtureId, btn) {
  const box = document.getElementById('estrategia-result-' + fixtureId);
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = '<p class="text-text-muted text-[11px] py-3 animate-pulse">🔮 Consultando as estatísticas...</p>';
  if (btn) btn.disabled = true;
  try {
    const h = { 'x-rapidapi-host': ESTRATEGIA_API_HOST, 'x-rapidapi-key': ESTRATEGIA_API_KEY };
    const [predR, oddsR] = await Promise.all([
      fetch(`https://${ESTRATEGIA_API_HOST}/predictions?fixture=${fixtureId}`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`https://${ESTRATEGIA_API_HOST}/odds?fixture=${fixtureId}`, { headers: h }).then(r => r.json()).catch(() => null)
    ]);
    const pred = (predR && predR.response && predR.response[0]) ? predR.response[0] : null;
    const oddsAvg = extrairOdds1x2Media(oddsR);
    const nomes = estrategiaJogosMap[fixtureId] || { home: (pred && pred.teams && pred.teams.home ? pred.teams.home.name : 'Casa'), away: (pred && pred.teams && pred.teams.away ? pred.teams.away.name : 'Fora') };
    const est = gerarEstrategiaPlacar(pred, oddsAvg, fixtureId);
    box.innerHTML = renderEstrategiaHTML(est, pred, oddsAvg, nomes);
  } catch (e) {
    console.error('Erro ao analisar jogo:', e);
    box.innerHTML = '<p class="text-red-400 text-[11px] py-3">Erro ao analisar. Tenta de novo.</p>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Reanalisar'; }
  }
}

function extrairOdds1x2Media(oddsR) {
  try {
    const bks = (oddsR && oddsR.response && oddsR.response[0] && oddsR.response[0].bookmakers) ? oddsR.response[0].bookmakers : [];
    let sh=0, sd=0, sa=0, n=0;
    bks.forEach(bk => {
      const mw = (bk.bets || []).find(b => b.name === 'Match Winner');
      if (!mw) return;
      const get = v => { const o = (mw.values || []).find(x => x.value === v); return o ? parseFloat(o.odd) : null; };
      const hh = get('Home'), dd = get('Draw'), aa = get('Away');
      if (hh && dd && aa) { sh+=hh; sd+=dd; sa+=aa; n++; }
    });
    if (n === 0) return null;
    return { home: sh/n, draw: sd/n, away: sa/n, casas: n };
  } catch (e) { return null; }
}

// Decide os 2 placares a partir das probabilidades (odds têm prioridade; senão a prediction).
function gerarEstrategiaPlacar(pred, oddsAvg, fixtureId) {
  let pH=null, pD=null, pA=null, fonte='';
  if (oddsAvg) {
    const iH=1/oddsAvg.home, iD=1/oddsAvg.draw, iA=1/oddsAvg.away, s=iH+iD+iA;
    pH=iH/s; pD=iD/s; pA=iA/s; fonte='odds';
  } else if (pred && pred.predictions && pred.predictions.percent) {
    const num = x => (x ? parseFloat(String(x).replace('%','')) / 100 : 0);
    pH=num(pred.predictions.percent.home); pD=num(pred.predictions.percent.draw); pA=num(pred.predictions.percent.away);
    const s=(pH+pD+pA) || 1; pH/=s; pD/=s; pA/=s; fonte='prediction';
  }
  if (pH === null) return { ok:false };

  const favSide = pH >= pA ? 'home' : 'away';
  const favProb = Math.max(pH, pA);
  const placar = (hg, ag) => `${hg}-${ag}`;
  // hg = gols do favorito; mapeia pra casa/fora conforme quem é o favorito
  const winScore = (side, fg, og) => side === 'home' ? placar(fg, og) : placar(og, fg);

  let conta1, conta2, confianca, resumo;
  if (favProb >= 0.55) {
    confianca = 'alta';
    conta1 = winScore(favSide, 2, 0);
    conta2 = winScore(favSide, 2, 1);
    resumo = `Favorito forte (${Math.round(favProb*100)}%). As duas contas cravam a vitória dele em placares diferentes (2-0 e 2-1): aumenta a chance de uma bater o placar exato, e qualquer vitória já garante os pontos de vencedor nas duas.`;
  } else if (favProb >= 0.45 && pD >= 0.27) {
    confianca = 'média';
    conta1 = winScore(favSide, 2, 1);
    conta2 = '1-1';
    resumo = `Equilibrado, favorito leve (${Math.round(favProb*100)}%) e empate provável (${Math.round(pD*100)}%). Uma conta vai na vitória do favorito (2-1) e a outra cobre o empate (1-1).`;
  } else {
    confianca = 'baixa';
    conta1 = '1-1';
    conta2 = winScore(favSide, 2, 1);
    resumo = `Jogo muito aberto, sem favorito claro. Cobrimos o empate (1-1) numa conta e a vitória magra do leve favorito (2-1) na outra.`;
  }

  // Nota de zebra (se a distribuição do grupo estiver carregada e a regra ligada)
  let zebraNote = '';
  try {
    const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[fixtureId] : null;
    const regraOn = (typeof grupoAtual !== 'undefined' && grupoAtual && grupoAtual.regra_zebra_dinamica === true);
    if (dist && regraOn && dist.total > 0) {
      const favPctGrupo = favSide === 'home' ? dist.home : dist.away;
      if (favPctGrupo < 15 && favProb >= 0.40) {
        zebraNote = `O grupo quase não cravou o favorito (${Math.round(favPctGrupo)}% dos palpites). Se ele vencer, é ZEBRA (vale 2x). Vale uma conta arriscar com tudo na vitória dele.`;
      }
    }
  } catch (e) {}

  return { ok:true, favSide, favProb, probs:{home:pH,draw:pD,away:pA}, fonte, conta1, conta2, confianca, resumo, zebraNote };
}

function renderEstrategiaHTML(est, pred, oddsAvg, nomes) {
  if (!est || !est.ok) {
    return '<p class="text-text-muted text-[11px] py-3">Sem estatísticas suficientes pra esse jogo ainda (as odds/predições costumam aparecer perto da data do jogo).</p>';
  }
  const pct = x => Math.round(x*100);
  const advice = (pred && pred.predictions && pred.predictions.advice) ? pred.predictions.advice : null;
  const corConf = est.confianca === 'alta' ? 'text-brand-green' : (est.confianca === 'média' ? 'text-amber-400' : 'text-zinc-400');
  const oddsLine = oddsAvg ? `<span class="text-text-muted">Odds (méd. ${oddsAvg.casas} casas): <span class="text-white/80">${oddsAvg.home.toFixed(2)} · ${oddsAvg.draw.toFixed(2)} · ${oddsAvg.away.toFixed(2)}</span></span>` : '';
  return `
    <div class="border-t border-white/5 pt-3 space-y-3">
      <div class="text-[11px] font-bold flex flex-wrap gap-x-3 gap-y-1">
        <span class="text-text-muted">Prob: <span class="text-white/80">Casa ${pct(est.probs.home)}% · Emp ${pct(est.probs.draw)}% · Fora ${pct(est.probs.away)}%</span></span>
        ${oddsLine}
      </div>
      ${advice ? `<p class="text-[11px] text-text-muted">📊 Leitura da API: <span class="text-white/80">${advice}</span></p>` : ''}
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-purple-500/10 border border-purple-500/25 rounded-xl p-3 text-center">
          <p class="text-[10px] font-black uppercase tracking-wide text-purple-300 mb-1">🎩 Você</p>
          <p class="text-2xl font-black text-white font-mono">${est.conta1}</p>
          <p class="text-[9px] text-text-muted mt-0.5 truncate">${nomes.home} x ${nomes.away}</p>
        </div>
        <div class="bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-xl p-3 text-center">
          <p class="text-[10px] font-black uppercase tracking-wide text-fuchsia-300 mb-1">💜 Gaby</p>
          <p class="text-2xl font-black text-white font-mono">${est.conta2}</p>
          <p class="text-[9px] text-text-muted mt-0.5 truncate">${nomes.home} x ${nomes.away}</p>
        </div>
      </div>
      <p class="text-[11px] text-zinc-300 leading-relaxed"><span class="${corConf} font-black uppercase text-[9px] tracking-wide">Confiança ${est.confianca}</span> · ${est.resumo}</p>
      ${est.zebraNote ? `<p class="text-[11px] text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg p-2">🦓 ${est.zebraNote}</p>` : ''}
      <p class="text-[9px] text-text-muted italic">Sugestão baseada em estatística — a decisão final é sua. Lembra que o palpite trava 10 min antes.</p>
    </div>`;
}

async function carregarGMGrupos() {
  const container = document.getElementById('lista-grupos-gm');
  if (!container || !sbClient) return;

  container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Carregando grupos...</p>';

  try {
    const { data: grupos, error: errG } = await sbClient
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (errG) {
      container.innerHTML = `<p class="text-red-400 text-[13px] text-center py-6">Erro: ${errG.message}</p>`;
      return;
    }

    if (!grupos || grupos.length === 0) {
      container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Nenhum grupo encontrado.</p>';
      return;
    }

    const { data: membros, error: errM } = await sbClient
      .from('group_members')
      .select('group_id');

    if (errM) console.error("Erro ao buscar membros dos grupos:", errM);

    container.innerHTML = '';
    
    grupos.forEach(g => {
      const numMembros = membros ? membros.filter(m => m.group_id === g.id).length : 0;
      const dataCriacao = new Date(g.created_at).toLocaleDateString('pt-BR');
      
      container.innerHTML += `
        <div class="bg-card-bg border border-white/5 rounded-2xl p-4 hover:border-purple-500/20 transition-all mb-3">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-bold text-[15px] text-white truncate max-w-[200px]">${g.name}</h4>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">${numMembros} membros</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-text-muted">
            <span>Código: <strong class="text-white select-all font-mono font-black">${g.invite_code}</strong></span>
            <span>Criado em: ${dataCriacao}</span>
          </div>
        </div>
      `;
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro ao carregar dados.</p>';
  }
}

async function carregarGMMetricas() {
  if (!sbClient) return;

  try {
    const [resGrupos, resMembros, resPerfis, resGuesses] = await Promise.all([
      sbClient.from('groups').select('id', { count: 'exact', head: true }),
      sbClient.from('group_members').select('group_id', { count: 'exact', head: true }),
      sbClient.from('profiles').select('id', { count: 'exact', head: true }),
      sbClient.from('guesses').select('id', { count: 'exact', head: true })
    ]);

    document.getElementById('stat-total-grupos').innerText = resGrupos.count !== null ? resGrupos.count : '0';
    document.getElementById('stat-total-membros').innerText = resMembros.count !== null ? resMembros.count : '0';
    document.getElementById('stat-total-perfis').innerText = resPerfis.count !== null ? resPerfis.count : '0';
    document.getElementById('stat-total-palpites').innerText = resGuesses.count !== null ? resGuesses.count : '0';

    const containerPerfis = document.getElementById('lista-perfis-gm');
    if (containerPerfis) {
      containerPerfis.innerHTML = '<p class="text-text-muted text-[11px] text-center py-3">Carregando usuários...</p>';
      
      const { data: perfis, error: errP } = await sbClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (errP) {
        console.error(errP);
        const { data: perfisFallback } = await sbClient
          .from('profiles')
          .select('*')
          .limit(5);
        renderPerfisGM(perfisFallback || []);
      } else {
        renderPerfisGM(perfis || []);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function renderPerfisGM(perfis) {
  const containerPerfis = document.getElementById('lista-perfis-gm');
  if (!containerPerfis) return;
  containerPerfis.innerHTML = '';
  if (perfis.length === 0) {
    containerPerfis.innerHTML = '<p class="text-text-muted text-[11px] text-center py-3">Nenhum perfil encontrado.</p>';
    return;
  }
  perfis.forEach(p => {
    const foto = p.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.full_name || 'U') + '&background=8b5cf6&color=fff';
    const dataReg = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—';
    containerPerfis.innerHTML += `
      <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${foto}" class="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-[12px] text-white truncate">${p.full_name || 'Sem nome'}</p>
            <p class="text-[10px] text-text-muted truncate">${p.email || 'Sem email'}</p>
          </div>
        </div>
        <span class="text-[9px] text-text-muted bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">${dataReg}</span>
      </div>
    `;
  });
}

// Traduz o tipo de evento do desafio para exibição amigável
function traduzirRegraDesafio(eventType) {
  const hasPenalty = eventType.endsWith('_penalty');
  const clean = eventType.replace('_penalty', '');
  let trad = clean;
  
  if (clean === 'Goal') trad = 'Time a marcar primeiro ⚽';
  else if (clean === 'Card') trad = 'Time a levar cartão primeiro 🟨';
  else if (clean === 'Assist') trad = 'Dar Assistência 🎯';
  else if (clean === 'CardYellow') trad = 'Receber Cartão Amarelo 🟨';
  else if (clean === 'CardRed') trad = 'Receber Cartão Vermelho 🟥';
  else if (clean.startsWith('CornersOver')) {
    const limit = clean.replace('CornersOver', '');
    trad = `Mais/Menos de ${limit} Escanteios 🚩`;
  }
  else if (clean.startsWith('CardsOver')) {
    const limit = clean.replace('CardsOver', '');
    trad = `Mais/Menos de ${limit} Cartões 🟨🟥`;
  }
  else if (clean === 'BTTS') trad = 'Ambos Marcam ⚽';
  
  return trad + (hasPenalty ? ' (Com Penalidade ⚠️)' : '');
}

// Compartilha os dados do desafio no WhatsApp
async function compartilharDesafioGM(matchName, eventType, points, playersArray, fixtureId) {
  let gAtual = grupoAtual;
  
  if (!gAtual && sbClient) {
    try {
      const { data: grupos } = await sbClient
        .from('groups')
        .select('*')
        .limit(1);
      if (grupos && grupos.length > 0) {
        gAtual = {
          nome: grupos[0].name,
          invite_code: grupos[0].invite_code
        };
      }
    } catch (e) {
      console.error("Erro ao buscar grupo padrão para compartilhamento:", e);
    }
  }

  const hasPenalty = eventType.endsWith('_penalty');
  const cleanEventType = eventType.replace('_penalty', '');
  
  let acaoTexto = '';
  if (cleanEventType === 'Goal') acaoTexto = 'fará um Gol';
  else if (cleanEventType === 'Assist') acaoTexto = 'dará uma Assistência';
  else if (cleanEventType === 'CardYellow') acaoTexto = 'receberá Cartão Amarelo';
  else if (cleanEventType === 'CardRed') acaoTexto = 'receberá Cartão Vermelho';
  else if (cleanEventType.startsWith('CornersOver')) {
    const limit = cleanEventType.replace('CornersOver', '');
    acaoTexto = `Mais/Menos de ${limit} Escanteios`;
  } else if (cleanEventType.startsWith('CardsOver')) {
    const limit = cleanEventType.replace('CardsOver', '');
    acaoTexto = `Mais/Menos de ${limit} Cartões`;
  } else if (cleanEventType === 'BTTS') acaoTexto = 'Ambos Marcam (Sim/Não)';
  else acaoTexto = cleanEventType;

  const avisoPenalidade = hasPenalty 
    ? `\n⚠️ *Atenção:* Se você errar, perderá -${points} pontos!` 
    : '';

  const nomeBolao = gAtual ? ` - Bolão ${gAtual.nome}` : '';
  let msg = `🏆 *DESAFIO ESPECIAL DO GM${nomeBolao}* 🏆\n\n`;
  msg += `🏟️ *Jogo:* ${matchName}\n`;
  msg += `🔥 *Desafio:* ${acaoTexto}\n`;
  msg += `💰 *Prêmio:* +${points} pontos extras!${avisoPenalidade}\n\n`;
  msg += `*Opções para votar:*\n`;
  
  playersArray.forEach(p => {
    msg += `👉 ${p}\n`;
  });

  const origin = window.location.origin + window.location.pathname;
  const codeParam = gAtual ? `&code=${gAtual.invite_code}` : '';
  const linkApp = origin.startsWith("file://")
    ? `https://bolao-pro-six.vercel.app/?match=${fixtureId}${codeParam}`
    : `${origin}?match=${fixtureId}${codeParam}`;

  msg += `\n🔗 *Participe e dê seu palpite:* ${linkApp}`;

  const urlUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(msg);
  // Redireciona a janela para abrir diretamente o WhatsApp no mobile/PWA (evita bloqueador de popups)
  window.location.href = urlUrl;
}

// Executa na carga do script para garantir que o botão apareça se a sessão já estiver recuperada
verificarUsuarioGM();

// ==================== DISPAROS DE ALERTAS DE JOGOS (GM) ====================

function obterJogoSelecionadoGM() {
  const selectJogo = document.getElementById('select-gm-jogo');
  if (!selectJogo || !selectJogo.value) {
    showToast('Selecione uma partida primeiro!', 'error');
    return null;
  }
  const selectedOptionText = selectJogo.options[selectJogo.selectedIndex].text;
  // Limpa o "(30/05 21:00)" do final do nome se existir
  const indexParentese = selectedOptionText.lastIndexOf(' (');
  const matchName = indexParentese !== -1 ? selectedOptionText.substring(0, indexParentese) : selectedOptionText;
  return { id: selectJogo.value, name: matchName };
}

async function alertarInicioJogo() {
  const jogo = obterJogoSelecionadoGM();
  if (!jogo) return;

  if (confirm(`Deseja enviar o alerta de Aquecimento para a partida: ${jogo.name}?`)) {
    showToast("Enviando alerta...", "success");
    if (typeof dispararNotificacaoPush === 'function') {
      const gId = (typeof grupoAtual !== 'undefined' && grupoAtual) ? grupoAtual.id : null;
      await dispararNotificacaoPush({
        groupId: gId,
        title: '⏰ O aquecimento começou!',
        body: `${jogo.name} começa em breve. Já enviou seu palpite na aba de jogos?`,
        url: '/'
      });
      showToast("Alerta Pré-Jogo disparado!", "success");
    }
  }
}

async function alertarGolJogo() {
  const jogo = obterJogoSelecionadoGM();
  if (!jogo) return;

  const timeGol = prompt(`Qual time fez o gol na partida ${jogo.name}? (Ex: Flamengo, Vasco, etc. ou deixe em branco para gol geral)`);
  if (timeGol === null) return;

  let corpoMensagem = `Saiu um gol na partida ${jogo.name}! Será que o seu placar exato ainda tá vivo? Abra o app e confira!`;
  let titulo = '⚽ GOL!';
  if (timeGol.trim() !== "") {
    titulo = `⚽ GOL do ${timeGol.trim()}!`;
    corpoMensagem = `GOL do ${timeGol.trim()} em ${jogo.name}! Seu palpite ainda tá vivo? Confira a resenha no app!`;
  }

  showToast("Enviando alerta de Gol...", "success");
  if (typeof dispararNotificacaoPush === 'function') {
    const gId = (typeof grupoAtual !== 'undefined' && grupoAtual) ? grupoAtual.id : null;
    await dispararNotificacaoPush({
      groupId: gId,
      title: titulo,
      body: corpoMensagem,
      url: '/'
    });
    showToast("Alerta de Gol disparado!", "success");
  }
}

async function alertarFimJogo() {
  const jogo = obterJogoSelecionadoGM();
  if (!jogo) return;

  const placar = prompt(`Qual foi o placar final de ${jogo.name}? (Ex: 2x1, 1x0, etc.)`);
  if (placar === null) return;

  let corpoMensagem = `Fim de Papo em ${jogo.name}. A tabela atualizou! Veja quantos pontos você somou no Ranking.`;
  if (placar.trim() !== "") {
    corpoMensagem = `Fim de Papo! ${jogo.name} terminou em ${placar.trim()}. A tabela atualizou! Veja seu Ranking.`;
  }

  showToast("Enviando alerta de Fim de Jogo...", "success");
  if (typeof dispararNotificacaoPush === 'function') {
    const gId = (typeof grupoAtual !== 'undefined' && grupoAtual) ? grupoAtual.id : null;
    await dispararNotificacaoPush({
      groupId: gId,
      title: '🏁 Apito Final!',
      body: corpoMensagem,
      url: '/'
    });
    showToast("Alerta de Apito Final disparado!", "success");
  }
}
