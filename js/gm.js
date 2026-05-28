// ============ GAME MASTER (GM) ENGINE ============

// Verifica se o usuário atual é o Game Master
function verificarUsuarioGM() {
  const container = document.getElementById('gm-panel-button-container');
  if (!container) return;

  if (usuarioAtual && usuarioAtual.email === 'worldkkevin@gmail.com') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

// Direciona para a view do GM
function abrirPainelGM() {
  if (typeof switchView === 'function') {
    switchView('view-gm-panel');
    switchGMTab('desafios');
  }
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

// Carrega os dados da tela do GM
async function carregarGMView() {
  const selectJogo = document.getElementById('select-gm-jogo');
  const listaDesafios = document.getElementById('lista-desafios-gm');

  if (selectJogo) {
    selectJogo.innerHTML = '<option value="">Selecione uma partida...</option>';
    // Filtra jogos que ainda não terminaram ou estão ao vivo
    const statusTerminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];
    const jogosAtivos = todosOsJogos.filter(j => !statusTerminados.includes(j.fixture.status.short));
    
    // Ordena por data
    jogosAtivos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    jogosAtivos.forEach(j => {
      const dataStr = new Date(j.fixture.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      selectJogo.innerHTML += `<option value="${j.fixture.id}">${j.teams.home.name} x ${j.teams.away.name} (${dataStr})</option>`;
    });
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

      listaDesafios.innerHTML = '';
      desafios.forEach(d => {
        const statusClass = d.status === 'active' ? 'bg-brand-green/20 text-brand-green border-brand-green/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700';
        const labelStatus = d.status === 'active' ? 'Ativo' : 'Resolvido';

        listaDesafios.innerHTML += `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h4 class="font-black text-[14px] text-white">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5">Regra: <strong>${d.event_type === 'Goal' ? 'Fazer Gol' : 'Dar Assistência'}</strong> (+${d.points} pts)</p>
              </div>
              <span class="text-[9px] font-black px-2 py-0.5 rounded-full border ${statusClass}">${labelStatus}</span>
            </div>
            <p class="text-[11px] text-text-muted">Opções: <span class="text-white">${d.players.join(', ')}</span></p>
            
            <div class="flex gap-2 mt-4">
              ${d.status === 'active' ? `
                <button onclick="resolverDesafioReal('${d.id}', ${d.fixture_id}, '${d.event_type}', ${JSON.stringify(d.players).replace(/"/g, '&quot;')})" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                  Resolver com API
                </button>
              ` : ''}
              <button onclick="excluirDesafioReal('${d.id}')" class="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95">
                Excluir
              </button>
            </div>
          </div>
        `;
      });
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
  
  if (!selectJogo || !selectEvento || !inputPontos) return;

  const fixtureId = parseInt(selectJogo.value);
  const eventType = selectEvento.value;
  const points = parseInt(inputPontos.value) || 50;

  if (!fixtureId) { alert('Selecione uma partida!'); return; }
  if (!eventType) { alert('Selecione o tipo de evento!'); return; }

  // Coleta jogadores
  const players = [];
  for (let i = 1; i <= 4; i++) {
    const val = document.getElementById(`input-gm-player-${i}`).value.trim();
    if (val) players.push(val);
  }

  if (players.length < 2) {
    alert('Insira pelo menos 2 opções de jogadores!');
    return;
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
        players: players,
        status: 'active'
      }]);

    if (btn) { btn.disabled = false; btn.innerText = 'Lançar Desafio'; }

    if (error) {
      alert('Erro ao criar desafio: ' + error.message);
      return;
    }

    // Limpa os inputs
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`input-gm-player-${i}`).value = '';
    }
    inputPontos.value = 50;
    selectJogo.value = '';

    alert('Desafio lançado com sucesso!');
    carregarGMView();

  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerText = 'Lançar Desafio'; }
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
      alert('Erro ao excluir: ' + error.message);
      return;
    }
    carregarGMView();
  } catch (e) {
    console.error(e);
  }
}

// Resolução de desafio com API de eventos
async function resolverDesafioReal(desafioId, fixtureId, eventType, players) {
  if (!confirm('Deseja realmente obter os dados de eventos da API para resolver este desafio?')) return;

  const url = `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`;
  
  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5"
      }
    });

    const dados = await resposta.json();
    const eventos = dados.response || [];

    // Filtra quem realizou a façanha
    const jogadoresVencedores = [];

    eventos.forEach(evt => {
      // Evento de Gol
      if (evt.type === 'Goal') {
        const autorGoal = evt.player ? evt.player.name : '';
        const autorAssist = evt.assist ? evt.assist.name : '';

        players.forEach(p => {
          if (eventType === 'Goal' && nomesCoincidem(autorGoal, p)) {
            if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
          } else if (eventType === 'Assist' && nomesCoincidem(autorAssist, p)) {
            if (!jogadoresVencedores.includes(p)) jogadoresVencedores.push(p);
          }
        });
      }
    });

    console.log("Jogadores do desafio que pontuaram:", jogadoresVencedores);

    // Carrega todos os votos dos usuários para esse desafio
    const { data: votos, error: errVotos } = await sbClient
      .from('user_desafios')
      .select('*')
      .eq('desafio_id', desafioId);

    if (errVotos) {
      alert('Erro ao carregar palpites dos usuários: ' + errVotos.message);
      return;
    }

    // Carrega os dados do próprio desafio para obter os pontos
    const { data: desafio, error: errDesafio } = await sbClient
      .from('desafios')
      .select('points')
      .eq('id', desafioId)
      .single();

    if (errDesafio || !desafio) {
      alert('Erro ao buscar pontos do desafio.');
      return;
    }

    const pontosPremio = desafio.points || 50;
    let totalPontuados = 0;

    // Atualiza os pontos de cada voto
    if (votos && votos.length > 0) {
      for (const voto of votos) {
        // Verifica se a escolha do usuário bate com algum vencedor
        const acertou = jogadoresVencedores.some(p => nomesCoincidem(p, voto.chosen_player));
        const pontosGanhos = acertou ? pontosPremio : 0;

        if (acertou) totalPontuados++;

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

    alert(`Desafio resolvido com sucesso!\n\nJogadores que pontuaram na vida real: ${jogadoresVencedores.join(', ') || 'Nenhum'}\nParticipantes premiados: ${totalPontuados}`);
    carregarGMView();

  } catch (e) {
    console.error(e);
    alert('Erro no processamento da resolução do desafio.');
  }
}

// ============ GERENCIAMENTO DE ABAS DO GM ============

function switchGMTab(tabId) {
  const sections = ['desafios', 'grupos', 'stats'];
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
  }
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
