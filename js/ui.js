// ============ INTERFACE DO USUÁRIO (UI) ============

let intervaloAoVivo = null;

// Função para renderizar Telas Vazias (Empty States) com padrão Premium
function renderEmptyState(icone, titulo, descricao) {
  return `
    <div class="flex flex-col items-center justify-center py-16 text-center px-4 animate-fade-in">
      <div class="w-20 h-20 bg-card-bg rounded-full flex items-center justify-center mb-5 border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
        <span class="text-4xl opacity-80 drop-shadow-md">${icone}</span>
      </div>
      <h3 class="text-white font-black text-[15px] mb-2 tracking-wide uppercase">${titulo}</h3>
      <p class="text-text-muted text-[12px] max-w-[260px] mx-auto leading-relaxed">${descricao}</p>
    </div>
  `;
}


function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function fecharModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function switchView(targetViewId) {
  const views = ['view-inicio', 'view-grupo-home', 'view-jogos', 'view-palpite', 'view-ranking', 'view-painel', 'view-regras', 'view-gm-panel', 'view-ao-vivo', 'view-desafios'];
  const navBar = document.getElementById('bottom-nav');
  const gmNavBar = document.getElementById('gm-bottom-nav');

  if (targetViewId !== 'view-grupo-home' && countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (targetViewId !== 'view-palpite') {
    desativarTelaAoVivo();
  }

  if (targetViewId !== 'view-ao-vivo') {
    if (typeof desativarTVAoVivo === 'function') {
      desativarTVAoVivo();
    }
  }

  views.forEach(vId => {
    document.getElementById(vId).classList.add('hidden');
    if (document.getElementById('nav-' + vId)) {
      document.getElementById('nav-' + vId).classList.remove('text-brand-green', 'bg-brand-green/10', 'px-3', 'py-2', 'rounded-xl');
      document.getElementById('nav-' + vId).classList.add('text-text-muted');
    }
  });

  document.getElementById(targetViewId).classList.remove('hidden');

  // Controle de menus inferiores (Navegação)
  if (targetViewId === 'view-gm-panel') {
    if (navBar) navBar.classList.add('hidden');
    if (gmNavBar) gmNavBar.classList.remove('hidden');
  } else {
    if (gmNavBar) gmNavBar.classList.add('hidden');
    
    if (targetViewId === 'view-inicio' || targetViewId === 'view-palpite' || targetViewId === 'view-ao-vivo') {
      if (navBar) navBar.classList.add('hidden');
    } else {
      if (navBar) navBar.classList.remove('hidden');
    }
  }

  if (document.getElementById('nav-' + targetViewId)) {
    document.getElementById('nav-' + targetViewId).classList.add('text-brand-green', 'bg-brand-green/10', 'px-3', 'py-2', 'rounded-xl');
    document.getElementById('nav-' + targetViewId).classList.remove('text-text-muted');
  }

  if (targetViewId === 'view-grupo-home') {
    if (todosOsJogos.length === 0) {
      if (typeof carregarJogos === 'function') carregarJogos();
    } else {
      if (typeof atualizarDestaquesHomeGrupo === 'function') atualizarDestaquesHomeGrupo();
    }
  } else if (targetViewId === 'view-jogos' && todosOsJogos.length === 0) {
    if (typeof carregarJogos === 'function') carregarJogos();
  } else if (targetViewId === 'view-jogos' && todosOsJogos.length > 0) {
    gerarFiltrosRodadas();
    filtrarPorRodada(rodadaSelecionada);
  } else if (targetViewId === 'view-ranking') {
    if (grupoAtual) {
      document.getElementById('nome-grupo-ranking').innerText = grupoAtual.nome;
      atualizarSeletorRanking();
      exibirRankingSelecionado();
    } else {
      document.getElementById('nome-grupo-ranking').innerText = '—';
      document.getElementById('lista-ranking').innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Selecione um grupo para ver o ranking...</p>';
    }
  } else if (targetViewId === 'view-desafios') {
    if (typeof carregarDesafiosUsuarioView === 'function') carregarDesafiosUsuarioView();
  } else if (targetViewId === 'view-painel') {
    const adminSettings = document.getElementById('admin-settings-section');
    const isOwner = grupoAtual && usuarioAtual && usuarioAtual.id === grupoAtual.owner_id;
    
    const badgeAdmin = document.getElementById('painel-badge-admin');
    if (badgeAdmin) {
      if (isOwner) {
        badgeAdmin.classList.remove('hidden');
      } else {
        badgeAdmin.classList.add('hidden');
      }
    }

    if (adminSettings) {
      if (isOwner) {
        adminSettings.classList.remove('hidden');
        const nameInput = document.getElementById('input-novo-nome-grupo');
        if (nameInput) {
          nameInput.value = grupoAtual.nome || '';
        }
      } else {
        adminSettings.classList.add('hidden');
      }
    }

    if (typeof carregarParticipantesGrupo === 'function') {
      carregarParticipantesGrupo();
    }
  }
}

function formatarData(dateStr) {
  const data = new Date(dateStr);
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const dia  = data.getDate();
  const mes  = meses[data.getMonth()];
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return dia + ' de ' + mes + ' às ' + hora;
}

function desenharCardsNaTela(jogos, palpitesDoUsuario = palpitesUsuario) {
  const container = document.getElementById('lista-jogos');
  container.innerHTML = '';

  if (jogos.length === 0) {
    container.innerHTML = renderEmptyState(
      '⚽', 
      'Fim de Jogo', 
      'Não há partidas agendadas para esta rodada no momento.'
    );
    return;
  }


  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const terminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];

  function obterStatusAgrupado(statusShort) {
    if (aoVivo.includes(statusShort)) return 'LIVE';
    if (terminados.includes(statusShort)) return 'MATCH_FINISHED';
    return 'NOT_STARTED';
  }

  const ordemStatus = { 'LIVE': 1, 'NOT_STARTED': 2, 'MATCH_FINISHED': 3 };

  // Ordena: LIVE primeiro, depois NOT_STARTED, por fim MATCH_FINISHED. Subordenados por data.
  const jogosOrdenados = [...jogos].sort((a, b) => {
    const statusA = obterStatusAgrupado(a.fixture.status.short);
    const statusB = obterStatusAgrupado(b.fixture.status.short);
    
    const diffStatus = ordemStatus[statusA] - ordemStatus[statusB];
    if (diffStatus !== 0) return diffStatus;
    
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  jogosOrdenados.forEach(function(jogo) {
    const id          = jogo.fixture.id;
    const data        = formatarData(jogo.fixture.date);
    const homeNome    = jogo.teams.home.name;
    const awayNome    = jogo.teams.away.name;
    const homeLogo    = getFlagUrl(jogo.teams.home.id) || jogo.teams.home.logo || '';
    const awayLogo    = getFlagUrl(jogo.teams.away.id) || jogo.teams.away.logo || '';
    const homeFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(homeNome) + '&background=047857&color=fff';
    const awayFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(awayNome) + '&background=b45309&color=fff';

    const kickoff = new Date(jogo.fixture.date);
    const agora = new Date();
    const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
    const isLocked = agora > dezMinutosAntes;

    const statusShort = jogo.fixture.status.short;
    const isLive = aoVivo.includes(statusShort);
    const isFinished = terminados.includes(statusShort);

    // Verifica se o usuário já tem palpite para essa partida
    const meuPalpite = palpitesDoUsuario.find(p => p.match_id === id);

    let centerHtml = '';
    let cardBorderClass = 'border-white/5';
    let cardBgClass = '';
    let cardOpacityClass = '';

    if (isFinished) {
      const realHome = jogo.goals.home ?? 0;
      const realAway = jogo.goals.away ?? 0;
      let guessText = '';
      let ptsHtml = '';

      if (meuPalpite) {
        const pts = calcularPontosPalpite(meuPalpite.score_home, meuPalpite.score_away, realHome, realAway);
        guessText = `Seu palpite: ${meuPalpite.score_home}x${meuPalpite.score_away}`;
        if (pts > 0) {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-gold/20 text-gold mt-1 tracking-wide uppercase">+${pts} PTS</span>`;
        } else {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500 mt-1 tracking-wide uppercase">0 PTS</span>`;
        }
        cardBorderClass = 'border-white/10';
      } else {
        guessText = 'Sem palpite';
        ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-600 mt-1 tracking-wide uppercase">0 PTS</span>`;
        cardBorderClass = 'border-red-500/10';
      }

      centerHtml = `
        <div class="flex flex-col items-center justify-center">
          <span class="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider mb-1 border border-white/5">ENCERRADO</span>
          <div class="text-xl font-black tracking-widest text-white/80">${realHome} x ${realAway}</div>
          <div class="text-[11px] text-text-muted mt-1 font-semibold">${guessText}</div>
          ${ptsHtml}
        </div>
      `;
      cardOpacityClass = 'opacity-70';

    } else if (isLive) {
      const realHome = jogo.goals.home ?? 0;
      const realAway = jogo.goals.away ?? 0;
      const elapsed = jogo.fixture.status.elapsed ? `${jogo.fixture.status.elapsed}'` : '';
      let guessText = '';
      let ptsHtml = '';

      if (meuPalpite) {
        const pts = calcularPontosPalpite(meuPalpite.score_home, meuPalpite.score_away, realHome, realAway);
        guessText = `Seu palpite: ${meuPalpite.score_home}x${meuPalpite.score_away}`;
        if (pts > 0) {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-green/20 text-brand-green mt-1 tracking-wide uppercase animate-pulse">Parcial: +${pts} pts</span>`;
        } else {
          ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 mt-1 tracking-wide uppercase">Parcial: 0 pts</span>`;
        }
        cardBorderClass = 'border-brand-green/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
        cardBgClass = 'bg-brand-green/5';
      } else {
        guessText = 'Sem palpite';
        ptsHtml = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-500 mt-1 tracking-wide uppercase">0 PTS</span>`;
      }

      centerHtml = `
        <div class="flex flex-col items-center justify-center">
          <span class="inline-flex items-center gap-1 bg-red-500/15 text-red-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider mb-1 animate-pulse border border-red-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            AO VIVO ${elapsed}
          </span>
          <div class="text-xl font-black tracking-widest text-white">${realHome} x ${realAway}</div>
          <div class="text-[11px] text-text-muted mt-1 font-semibold">${guessText}</div>
          ${ptsHtml}
        </div>
      `;

    } else {
      // NÃO INICIADO
      if (meuPalpite) {
        centerHtml = `
          <div id="placar-salvo-${id}" class="flex flex-col items-center">
            <div class="text-xl font-black tracking-widest text-white" id="lbl-placar-${id}">${meuPalpite.score_home} x ${meuPalpite.score_away}</div>
            <span class="text-brand-green text-[11px] font-bold mt-1">Palpitado</span>
          </div>
        `;
        cardBorderClass = 'border-brand-green/40';
        cardBgClass = 'bg-brand-green/5';
        cardOpacityClass = 'opacity-90';
      } else if (isLocked) {
        centerHtml = `
          <button id="btn-palpite-${id}" disabled class="border border-zinc-700 text-zinc-500 px-4 py-1.5 rounded-xl text-[13px] font-bold cursor-not-allowed bg-zinc-800/10">
            Bloqueado
          </button>
        `;
      } else {
        centerHtml = `
          <button id="btn-palpite-${id}" class="border border-brand-green text-brand-green px-4 py-1.5 rounded-xl text-[13px] font-bold hover:bg-brand-green hover:text-black transition-all">
            Palpitar
          </button>
        `;
      }
    }

    container.innerHTML += `
      <div id="card-jogo-${id}" onclick="abrirTelaPalpite(${id})" class="app-card bg-card-bg w-full p-4 border ${cardBorderClass} ${cardBgClass} ${cardOpacityClass} mb-4 transition-all cursor-pointer hover:border-brand-green/30">
        <div class="text-text-muted text-xs font-semibold tracking-wide mb-4">${data}</div>
        <div class="flex items-center justify-between">
          <div class="flex flex-col items-center w-1/3">
            <div class="w-11 h-11 rounded-lg overflow-hidden mb-2">
              <img src="${homeLogo}" onerror="this.onerror=null; this.src='${homeFallback}'" class="w-full h-full object-cover">
            </div>
            <span class="text-[13px] font-bold text-center">${homeNome}</span>
          </div>
          <div class="w-1/3 flex flex-col items-center justify-center min-h-[60px]">
            ${centerHtml}
          </div>
          <div class="flex flex-col items-center w-1/3">
            <div class="w-11 h-11 rounded-lg overflow-hidden mb-2">
              <img src="${awayLogo}" onerror="this.onerror=null; this.src='${awayFallback}'" class="w-full h-full object-cover">
            </div>
            <span class="text-[13px] font-bold text-center">${awayNome}</span>
          </div>
        </div>
      </div>`;
  });
}

function mudarGols(time, valor) {
  if (!jogoAtual) return;
  const id = jogoAtual.fixture.id;
  
  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = agora > dezMinutosAntes;
  
  if (isLocked) {
    return; // Não permite alterar gols se o jogo estiver bloqueado por tempo
  }

  if (time === 'd-home') {
    golsHome += valor;
    if (golsHome < 0) golsHome = 0;
    document.getElementById('d-home-score').innerText = golsHome;
  } else if (time === 'd-away') {
    golsAway += valor;
    if (golsAway < 0) golsAway = 0;
    document.getElementById('d-away-score').innerText = golsAway;
  }

  // Reage dinamicamente habilitando ou desabilitando o botão
  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const meuPalpiteLocal = palpitesUsuario.find(p => p.match_id === id);

  if (meuPalpiteLocal) {
    // Se já existe palpite anterior no banco/cache local
    const houveMudanca = (golsHome !== palpiteOriginal.home || golsAway !== palpiteOriginal.away);
    if (confirmBtn) {
      confirmBtn.disabled = !houveMudanca;
      confirmBtn.innerText = "ATUALIZAR PALPITE";
      if (houveMudanca) {
        confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
        confirmBtn.style.opacity = '1';
        confirmBtn.style.pointerEvents = 'auto';
      } else {
        confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl uppercase tracking-wide border border-white/5";
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.pointerEvents = 'none';
      }
    }
  } else {
    // Novo palpite
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerText = "CONFIRMAR PALPITE";
      confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'auto';
    }
  }
}

function atualizarInterfacePalpiteExistente(scoreHome, scoreAway, isTimeLocked) {
  golsHome = scoreHome;
  golsAway = scoreAway;
  document.getElementById('d-home-score').innerText = golsHome;
  document.getElementById('d-away-score').innerText = golsAway;

  // Define palpite original para controle de mudanças
  palpiteOriginal.home = scoreHome;
  palpiteOriginal.away = scoreAway;

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const scoreControlButtons = document.querySelectorAll("#view-palpite .bg-black\\/30 button");

  if (isTimeLocked) {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerText = "BLOQUEADO (PRAZO ENCERRADO)";
      confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl cursor-not-allowed uppercase tracking-wide border border-white/5";
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'auto';
    }
    scoreControlButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('opacity-30', 'cursor-not-allowed');
    });
  } else {
    // HABILITADO para edição mas o botão de salvar começa desabilitado/apagado até haver mudança!
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerText = "ATUALIZAR PALPITE";
      confirmBtn.className = "w-full bg-zinc-800 text-zinc-500 font-black text-[14px] py-4 rounded-2xl uppercase tracking-wide border border-white/5";
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.pointerEvents = 'none';
    }
    scoreControlButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('opacity-30', 'cursor-not-allowed');
    });
  }
}

function liberarInterfacePalpite() {
  // Como é novo palpite, o original é 0x0
  palpiteOriginal.home = 0;
  palpiteOriginal.away = 0;

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const scoreControlButtons = document.querySelectorAll("#view-palpite .bg-black\\/30 button");

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerText = "CONFIRMAR PALPITE";
    confirmBtn.className = "w-full bg-brand-green text-black font-black text-[14px] py-4 rounded-2xl shadow-lg shadow-brand-green/20 hover:opacity-90 active:scale-95 transition-all uppercase tracking-wide cursor-pointer";
    confirmBtn.style.opacity = '1';
    confirmBtn.style.pointerEvents = 'auto';
  }
  scoreControlButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('opacity-30', 'cursor-not-allowed');
  });
}

function calcularPontosPalpite(palpiteHome, palpiteAway, realHome, realAway) {
  const pHome = parseInt(palpiteHome);
  const pAway = parseInt(palpiteAway);
  const rHome = parseInt(realHome);
  const rAway = parseInt(realAway);

  if (isNaN(pHome) || isNaN(pAway) || isNaN(rHome) || isNaN(rAway)) {
    return 0;
  }

  if (pHome === rHome && pAway === rAway) {
    return 30; // Placar Exato
  }

  const vencedorPalpite = pHome > pAway ? 'home' : (pHome < pAway ? 'away' : 'empate');
  const vencedorReal = rHome > rAway ? 'home' : (rHome < rAway ? 'away' : 'empate');
  const acertouVencedor = vencedorPalpite === vencedorReal;

  if (acertouVencedor) {
    if (vencedorReal === 'empate') {
      return 18; // Empate
    }

    const saldoPalpite = pHome - pAway;
    const saldoReal = rHome - rAway;

    const acertouGolsHome = pHome === rHome;
    const acertouGolsAway = pAway === rAway;
    if (acertouGolsHome || acertouGolsAway) {
      return 18; // Vencedor e gols de um time
    }

    if (saldoPalpite === saldoReal) {
      return 15; // Vencedor e saldo
    }

    const golsPerdedorPalpite = vencedorReal === 'home' ? pAway : pHome;
    const golsPerdedorReal = vencedorReal === 'home' ? rAway : rHome;
    if (golsPerdedorPalpite === golsPerdedorReal) {
      return 12; // Vencedor e gols do perdedor
    }

    return 4; // Vencedor
  } else {
    const acertouGolsHome = pHome === rHome;
    const acertouGolsAway = pAway === rAway;
    if (acertouGolsHome || acertouGolsAway) {
      return 3; // Placar de algum time
    }
  }

  return 0;
}

function gerarFiltrosRodadas() {
  const container = document.getElementById('filtros-rodada');
  if (!container || todosOsJogos.length === 0) return;
  container.innerHTML = '';

  // Pega rodadas únicas de todosOsJogos
  const rodadas = [...new Set(todosOsJogos.map(j => j.league.round))];
  rodadas.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  if (!rodadaSelecionada && rodadas.length > 0) {
    // Detecta a rodada atual pelo PRÓXIMO JOGO cronologicamente (ignora adiados de rodadas antigas)
    const agora = new Date();

    // 1. Pega todos os jogos futuros e ordena por data
    const jogosFuturos = todosOsJogos
      .filter(j => new Date(j.fixture.date) > agora)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    if (jogosFuturos.length > 0) {
      // A rodada do próximo jogo mais perto de agora
      rodadaSelecionada = jogosFuturos[0].league.round;
    } else {
      // Se não tem jogos futuros, pega a última rodada que teve jogos finalizados
      const jogosFinalizados = todosOsJogos
        .filter(j => ['FT', 'AET', 'PEN'].includes(j.fixture.status.short))
        .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

      rodadaSelecionada = jogosFinalizados.length > 0
        ? jogosFinalizados[0].league.round
        : rodadas[rodadas.length - 1];
    }
  }

  rodadas.forEach(rodada => {
    let nomeExibido = rodada;
    
    // Mapeamento amigável para Copa do Mundo e ligas comuns
    if (rodada.includes('Group Stage - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Group Stage - ')[1];
    } else if (rodada.includes('Regular Season - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Regular Season - ')[1];
    } else if (rodada === 'Round of 32') {
      nomeExibido = '16 avos';
    } else if (rodada === 'Round of 16') {
      nomeExibido = 'Oitavas';
    } else if (rodada === 'Quarter-finals') {
      nomeExibido = 'Quartas';
    } else if (rodada === 'Semi-finals') {
      nomeExibido = 'Semifinal';
    } else if (rodada === 'Match for 3rd place') {
      nomeExibido = '3º Lugar';
    } else if (rodada === 'Final') {
      nomeExibido = 'Final';
    }

    const isActive = rodada === rodadaSelecionada;
    const btnClass = isActive 
      ? "px-4 py-2 bg-brand-green text-black font-bold rounded-lg text-sm whitespace-nowrap" 
      : "px-4 py-2 bg-card-bg text-white font-bold rounded-lg text-sm whitespace-nowrap border border-white/5";
    const activeId = isActive ? 'id="btn-rodada-ativa"' : '';

    container.innerHTML += `
      <button ${activeId} onclick="filtrarPorRodada('${rodada.replace(/'/g, "\\'")}')" class="${btnClass}">
        ${nomeExibido}
      </button>
    `;
  });

  // Scroll automático para a rodada ativa ficar visível
  setTimeout(() => {
    const btnAtivo = document.getElementById('btn-rodada-ativa');
    if (btnAtivo) {
      btnAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 50);
}

function filtrarPorRodada(rodadaName) {
  rodadaSelecionada = rodadaName;
  gerarFiltrosRodadas();
  
  const jogosFiltrados = todosOsJogos.filter(j => j.league.round === rodadaName);
  desenharCardsNaTela(jogosFiltrados);
}

function atualizarSeletorRanking() {
  const seletor = document.getElementById('seletor-ranking');
  if (!seletor || todosOsJogos.length === 0) return;
  
  const valorAtual = seletor.value; // Salva a rodada selecionada anteriormente para não resetar se trocar de tela
  
  seletor.innerHTML = '<option value="geral">Ranking Geral</option>';
  
  const rodadas = [...new Set(todosOsJogos.map(j => j.league.round))];
  rodadas.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  rodadas.forEach(rodada => {
    let nomeExibido = rodada;
    
    if (rodada.includes('Group Stage - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Group Stage - ')[1];
    } else if (rodada.includes('Regular Season - ')) {
      nomeExibido = 'Rodada ' + rodada.split('Regular Season - ')[1];
    } else if (rodada === 'Round of 32') {
      nomeExibido = '16 avos';
    } else if (rodada === 'Round of 16') {
      nomeExibido = 'Oitavas';
    } else if (rodada === 'Quarter-finals') {
      nomeExibido = 'Quartas';
    } else if (rodada === 'Semi-finals') {
      nomeExibido = 'Semifinal';
    } else if (rodada === 'Match for 3rd place') {
      nomeExibido = '3º Lugar';
    } else if (rodada === 'Final') {
      nomeExibido = 'Final';
    }
    
    seletor.innerHTML += `<option value="${rodada.replace(/"/g, '&quot;')}">Campeão da ${nomeExibido}</option>`;
  });
  
  // Restaura a seleção anterior se ela ainda for válida
  if (valorAtual && [...seletor.options].some(opt => opt.value === valorAtual)) {
    seletor.value = valorAtual;
  }
}

async function exibirRankingSelecionado() {
  const container = document.getElementById('lista-ranking');
  if (!container) return;
  
  const seletor = document.getElementById('seletor-ranking');
  const tipo = seletor ? seletor.value : 'geral';

  container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Carregando ranking...</p>';

  if (!sbClient || !grupoAtual) {
    container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Selecione um grupo para visualizar o ranking.</p>';
    return;
  }

  try {
    // 1. Busca todos os palpites do grupo ativo
    const { data: rawGuesses, error: errGuesses } = await sbClient
      .from('guesses')
      .select('user_id, match_id, score_home, score_away')
      .eq('group_id', grupoAtual.id);

    if (errGuesses) {
      console.error("Erro ao carregar palpites para ranking:", errGuesses.message);
      container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao buscar palpites.</p>';
      return;
    }

    // 2. Busca todos os membros do grupo
    const { data: members, error: errMembers } = await sbClient
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', grupoAtual.id);

    if (errMembers) {
      console.error("Erro ao carregar membros:", errMembers.message);
      container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao buscar participantes.</p>';
      return;
    }

    // 2b. Busca pontos extras de desafios (user_desafios)
    let userDesafiosData = [];
    const { data: udData, error: errUD } = await sbClient
      .from('user_desafios')
      .select('user_id, points_awarded')
      .eq('group_id', grupoAtual.id);

    if (!errUD && udData) {
      userDesafiosData = udData;
    } else if (errUD) {
      console.error("Erro ao buscar user_desafios para ranking:", errUD.message);
    }

    if (!members || members.length === 0) {
      container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Nenhum membro neste grupo.</p>';
      return;
    }

    const userIds = members.map(m => m.user_id);

    // 3. Busca perfis dos membros (nome, avatar)
    const { data: profiles, error: errProfiles } = await sbClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (errProfiles) console.error("Erro ao carregar perfis:", errProfiles.message);

    // 4. Estrutura o objeto de pontuação
    const scores = {};
    userIds.forEach(uid => {
      const profile = profiles ? profiles.find(p => p.id === uid) : null;
      const memberMeta = members.find(m => m.user_id === uid);
      scores[uid] = {
        id: uid,
        nome: profile ? profile.full_name : 'Participante',
        foto: profile && profile.avatar_url ? profile.avatar_url : null,
        pontos: 0,
        acertosExatos: 0,
        isAdmin: memberMeta && memberMeta.role === 'owner'
      };
    });

    // 5. Calcula os pontos
    if (rawGuesses && rawGuesses.length > 0) {
      rawGuesses.forEach(g => {
        // Ignora palpites de usuários que não estão no grupo
        if (!scores[g.user_id]) return;

        const jogo = todosOsJogos.find(j => j.fixture.id === g.match_id);
        if (!jogo) return;

        // Se for ranking de rodada específica, filtra pelo round correspondente
        if (tipo !== 'geral' && jogo.league.round !== tipo) {
          return;
        }

        // Apenas calcula jogos finalizados
        const statusTerminado = ['FT', 'AET', 'PEN'].includes(jogo.fixture.status.short);
        if (statusTerminado && jogo.goals.home !== null && jogo.goals.away !== null) {
          const pts = calcularPontosPalpite(g.score_home, g.score_away, jogo.goals.home, jogo.goals.away);
          scores[g.user_id].pontos += pts;
          if (pts === 30) {
            scores[g.user_id].acertosExatos += 1;
          }
        }
      });
    }

    // 5b. Adiciona pontos extras dos desafios do GM
    if (userDesafiosData && userDesafiosData.length > 0) {
      userDesafiosData.forEach(ud => {
        if (scores[ud.user_id]) {
          scores[ud.user_id].pontos += ud.points_awarded || 0;
        }
      });
    }

    // Ordena o ranking:
    // 1. Mais pontos descrescente.
    // 2. Critério de desempate: mais acertos exatos.
    const rankingList = Object.values(scores).sort((a, b) => {
      if (b.pontos !== a.pontos) {
        return b.pontos - a.pontos;
      }
      return b.acertosExatos - a.acertosExatos;
    });

    window.ultimoRankingCalculado = rankingList;

    // 6. Injeta na lista
    container.innerHTML = '';
    rankingList.forEach((user, index) => {
      const posicao = index + 1;
      
      let medalhaClass = 'text-white/60 text-sm font-bold';
      let borderGold = 'border-white/5';
      let bgGlow = '';
      let badgePosicao = `${posicao}º`;

      if (posicao === 1) {
        medalhaClass = 'text-gold text-lg font-black';
        borderGold = 'glow-gold border-gold/30';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-gold"></div>';
      } else if (posicao === 2) {
        medalhaClass = 'text-silver text-lg font-bold';
        borderGold = 'border-silver/20';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-silver"></div>';
      } else if (posicao === 3) {
        medalhaClass = 'text-bronze text-lg font-bold';
        borderGold = 'border-bronze/20';
        bgGlow = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-bronze"></div>';
      }

      const fotoUrl = user.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nome) + '&background=random&color=fff';
      const adminBadge = user.isAdmin ? '<span class="bg-gold/20 text-gold text-[9px] px-1 rounded ml-1 font-bold">ADMIN</span>' : '';

      container.innerHTML += `
        <div class="app-card bg-card-bg p-4 flex items-center justify-between relative overflow-hidden border ${borderGold} mb-3">
          ${bgGlow}
          <div class="flex items-center gap-4 pl-2">
            <div class="w-6 flex flex-col items-center"><span class="${medalhaClass}">${badgePosicao}</span></div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg overflow-hidden bg-[#2a2a35]">
                <img src="${fotoUrl}" class="w-full h-full object-cover">
              </div>
              <div>
                <h3 class="font-bold text-[14px] text-white">${user.nome} ${adminBadge}</h3>
                <p class="text-[10px] text-text-muted mt-0.5">${user.acertosExatos} placares exatos</p>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-black text-white">${user.pontos}</div>
            <div class="text-[9px] text-text-muted font-bold uppercase tracking-wider">Pts</div>
          </div>
        </div>
      `;
    });

  } catch (err) {
    console.error("Erro inesperado ao renderizar ranking:", err);
    container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar o ranking.</p>';
  }
}

function alternarAba(abaNome) {
  const btnDetalhes = document.getElementById('btn-aba-detalhes');
  const btnPalpites = document.getElementById('btn-aba-palpites');
  const contentDetalhes = document.getElementById('tab-content-detalhes');
  const contentPalpites = document.getElementById('tab-content-palpites');

  if (abaNome === 'palpites') {
    if (jogoAtual) {
      carregarPalpitesDosAmigos(jogoAtual.fixture.id);
    }
    btnPalpites.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all";
    btnDetalhes.className = "flex-1 py-3 text-text-muted hover:text-white transition-all";
    contentDetalhes.classList.add('hidden');
    contentDetalhes.classList.remove('block');
    contentPalpites.classList.remove('hidden');
    contentPalpites.classList.add('block');
  } else {
    btnDetalhes.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all";
    btnPalpites.className = "flex-1 py-3 text-text-muted hover:text-white transition-all";
    contentDetalhes.classList.remove('hidden');
    contentDetalhes.classList.add('block');
    contentPalpites.classList.add('hidden');
    contentPalpites.classList.remove('block');
  }
}

async function carregarPalpitesDosAmigos(matchId) {
  const listaContainer = document.getElementById('lista-palpites-amigos');
  if (!sbClient || !grupoAtual) return;

  listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Carregando palpites...</p>';

  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = agora > dezMinutosAntes;

  try {
    const { data: rawGuesses, error: errGuesses } = await sbClient
      .from('guesses')
      .select('user_id, score_home, score_away')
      .eq('match_id', matchId)
      .eq('group_id', grupoAtual.id);

    if (errGuesses) {
      console.error("Erro ao buscar palpites dos amigos:", errGuesses.message);
      listaContainer.innerHTML = '<p class="text-red-400 text-[13px] text-center py-4">Erro ao carregar palpites.</p>';
      return;
    }

    let guesses = [];
    if (rawGuesses && rawGuesses.length > 0) {
      const userIds = rawGuesses.map(g => g.user_id);
      const { data: profiles, error: errProfiles } = await sbClient
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (errProfiles) console.error("Erro ao buscar perfis:", errProfiles.message);

      guesses = rawGuesses.map(g => {
        const p = profiles ? profiles.find(prof => prof.id === g.user_id) : null;
        return {
          ...g,
          profiles: p
        };
      });
    }

    if (isLocked) {
      if (!guesses || guesses.length === 0) {
        listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Nenhum palpite enviado para este jogo.</p>';
        return;
      }

      listaContainer.innerHTML = '';
      guesses.forEach(guess => {
        const name = guess.profiles ? guess.profiles.full_name : 'Participante';
        const avatar = guess.profiles && guess.profiles.avatar_url 
          ? guess.profiles.avatar_url 
          : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
        
        listaContainer.innerHTML += `
          <div class="bg-zinc-800/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
            <div class="flex items-center gap-3">
              <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
              <span class="font-bold text-[14px] text-white">${name}</span>
            </div>
            <div class="bg-black/40 px-3 py-1 rounded-lg font-black text-brand-green text-[14px]">
              ${guess.score_home} x ${guess.score_away}
            </div>
          </div>
        `;
      });
    } else {
      // Jogo ativo: os palpites dos outros permanecem secretos por RLS
      listaContainer.innerHTML = `
        <div class="bg-zinc-800/20 p-5 rounded-2xl border border-white/5 text-center fade-in">
          <p class="text-brand-green font-bold text-[14px] mb-2">🔒 Palpites Ocultos</p>
          <p class="text-text-muted text-[12px] leading-relaxed">
            Para manter a disputa justa, os palpites dos outros participantes ficarão visíveis a partir de 10 minutos antes do início do jogo.
          </p>
        </div>
      `;

      // Listamos quem já palpitou para instigar a participação, mas sem revelar o placar!
      if (guesses && guesses.length > 0) {
        listaContainer.innerHTML += `
          <h3 class="text-[11px] font-bold text-text-muted uppercase tracking-widest mt-6 mb-3">Já participaram:</h3>
          <div class="space-y-2">
        `;
        guesses.forEach(guess => {
          const name = guess.profiles ? guess.profiles.full_name : 'Participante';
          const avatar = guess.profiles && guess.profiles.avatar_url 
            ? guess.profiles.avatar_url 
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
          
          listaContainer.innerHTML += `
            <div class="bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
              <div class="flex items-center gap-3">
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                <span class="font-bold text-[13px] text-white">${name}</span>
              </div>
              <span class="text-brand-green text-[11px] font-bold">Palpitou</span>
            </div>
          `;
        });
        listaContainer.innerHTML += `</div>`;
      }
    }
  } catch (err) {
    console.error("Erro inesperado ao carregar palpites:", err);
    listaContainer.innerHTML = '<p class="text-red-400 text-[13px] text-center py-4">Erro ao carregar palpites.</p>';
  }
}

async function abrirTelaPalpite(id) {
  jogoAtual = todosOsJogos.find(j => j.fixture.id === id);
  if (!jogoAtual) return;

  const homeNome     = jogoAtual.teams.home.name;
  const awayNome     = jogoAtual.teams.away.name;
  const homeLogo     = getFlagUrl(jogoAtual.teams.home.id) || jogoAtual.teams.home.logo || '';
  const awayLogo     = getFlagUrl(jogoAtual.teams.away.id) || jogoAtual.teams.away.logo || '';
  const homeFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(homeNome) + '&background=047857&color=fff';
  const awayFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(awayNome) + '&background=b45309&color=fff';

  // Reset tabs and set default view to 'detalhes'
  alternarAba('detalhes');

  // Preenche os detalhes da partida
  document.getElementById('d-home-nome').innerText = homeNome;
  document.getElementById('d-away-nome').innerText = awayNome;
  document.getElementById('d-home-logo').src       = homeLogo;
  document.getElementById('d-home-logo').onerror  = function() { this.src = homeFallback; };
  document.getElementById('d-away-logo').src       = awayLogo;
  document.getElementById('d-away-logo').onerror  = function() { this.src = awayFallback; };
  
  // Formata e exibe a data do jogo
  document.getElementById('d-jogo-data').innerText = formatarData(jogoAtual.fixture.date);

  // Define o placar real da partida ou "VS" na tela de detalhes
  const realScoreEl = document.getElementById('d-real-score');
  const statusShort = jogoAtual.fixture.status.short;
  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const terminados = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'WD'];
  const isLive = aoVivo.includes(statusShort);
  const isFinished = terminados.includes(statusShort);

  if (realScoreEl) {
    if (isLive || isFinished) {
      const realHome = jogoAtual.goals.home ?? 0;
      const realAway = jogoAtual.goals.away ?? 0;
      realScoreEl.innerHTML = `<span class="text-xl font-black text-white">${realHome} x ${realAway}</span>`;
      if (isLive) {
        const elapsed = jogoAtual.fixture.status.elapsed ? ` (${jogoAtual.fixture.status.elapsed}')` : '';
        document.getElementById('d-jogo-data').innerHTML = `<span class="text-red-500 font-bold animate-pulse">● AO VIVO${elapsed}</span>`;
      } else {
        document.getElementById('d-jogo-data').innerHTML = `<span class="text-zinc-400 font-bold">ENCERRADO</span>`;
      }
    } else {
      realScoreEl.innerText = 'VS';
    }
  }

  // Limpa dados de palpitadores anteriores antes de carregar os novos
  document.getElementById('d-contador-palpites').innerText = "Carregando...";
  document.getElementById('d-palpitadores-fotos').innerHTML = "";
  document.getElementById('lista-palpites-amigos').innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Carregando palpites...</p>';

  // Verifica bloqueio de tempo (10 minutos antes do kickoff) ou se o jogo já iniciou/terminou
  const kickoff = new Date(jogoAtual.fixture.date);
  const agora = new Date();
  const dezMinutosAntes = new Date(kickoff.getTime() - 10 * 60000);
  const isLocked = (agora > dezMinutosAntes) || isLive || isFinished;

  // 1. Verificação SÍNCRONA no cache local para evitar piscadas
  const meuPalpiteLocal = palpitesUsuario.find(p => p.match_id === id);

  if (meuPalpiteLocal) {
    atualizarInterfacePalpiteExistente(meuPalpiteLocal.score_home, meuPalpiteLocal.score_away, isLocked);
  } else {
    if (isLocked) {
      atualizarInterfacePalpiteExistente(0, 0, true);
    } else {
      golsHome = 0;
      golsAway = 0;
      document.getElementById('d-home-score').innerText = 0;
      document.getElementById('d-away-score').innerText = 0;
      liberarInterfacePalpite();
    }
  }

  // Abre a tela de palpites imediatamente com o layout correto
  switchView('view-palpite');

  // Ativa o monitoramento ao vivo caso a partida esteja rolando
  if (isLive) {
    ativarTelaAoVivo(id);
  }

  // 2. Consulta rápida silenciosa no Supabase para garantir consistência
  if (sbClient && grupoAtual) {
    sbClient.auth.getUser().then(function(result) {
      const user = result.data.user;
      if (user) {
        sbClient
          .from('guesses')
          .select('score_home, score_away')
          .eq('match_id', id)
          .eq('user_id', user.id)
          .eq('group_id', grupoAtual.id)
          .maybeSingle()
          .then(function(res) {
            if (res.data) {
              const dbPalpite = res.data;
              // Se o palpite local não existia ou difere do banco, atualiza
              if (!meuPalpiteLocal || meuPalpiteLocal.score_home !== dbPalpite.score_home || meuPalpiteLocal.score_away !== dbPalpite.score_away) {
                atualizarInterfacePalpiteExistente(dbPalpite.score_home, dbPalpite.score_away, isLocked);
                
                // Atualiza cache local
                const idx = palpitesUsuario.findIndex(p => p.match_id === id);
                if (idx !== -1) {
                  palpitesUsuario[idx].score_home = dbPalpite.score_home;
                  palpitesUsuario[idx].score_away = dbPalpite.score_away;
                } else {
                  palpitesUsuario.push({
                    match_id: id,
                    score_home: dbPalpite.score_home,
                    score_away: dbPalpite.score_away
                  });
                }
              }
            }
          });
      }
    });
  }

  // 3. Carrega informações dinâmicas do grupo (membros e palpites dos amigos)
  if (sbClient && grupoAtual) {
    try {
      // Busca total de membros do grupo
      const { count: totalMembers, error: errMembers } = await sbClient
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', grupoAtual.id);

      if (errMembers) console.error("Erro ao buscar membros:", errMembers.message);

      // Busca palpites deste jogo neste grupo
      const { data: rawGuesses, error: errGuesses } = await sbClient
        .from('guesses')
        .select('user_id, score_home, score_away')
        .eq('match_id', id)
        .eq('group_id', grupoAtual.id);

      if (errGuesses) console.error("Erro ao buscar palpites:", errGuesses.message);

      let guesses = [];
      if (rawGuesses && rawGuesses.length > 0) {
        const userIds = rawGuesses.map(g => g.user_id);
        const { data: profiles, error: errProfiles } = await sbClient
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (errProfiles) console.error("Erro ao buscar perfis:", errProfiles.message);

        guesses = rawGuesses.map(g => {
          const p = profiles ? profiles.find(prof => prof.id === g.user_id) : null;
          return {
            ...g,
            profiles: p
          };
        });
      }
      const totalGuesses = guesses.length;

      // ... e o resto de carregar dados dinâmicos da partida
      const countVal = totalGuesses || 0;
      const membersVal = totalMembers || 0;
      document.getElementById('d-contador-palpites').innerText = `${countVal} de ${membersVal} palpitaram`;

      const fotosContainer = document.getElementById('d-palpitadores-fotos');
      fotosContainer.innerHTML = "";
      
      if (guesses && guesses.length > 0) {
        guesses.slice(0, 5).forEach(guess => {
          const name = guess.profiles ? guess.profiles.full_name : 'Participante';
          const avatar = guess.profiles && guess.profiles.avatar_url 
            ? guess.profiles.avatar_url 
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
          
          fotosContainer.innerHTML += `
            <img src="${avatar}" title="${name}" class="w-6 h-6 rounded-full border border-card-bg object-cover flex-shrink-0">
          `;
        });
        if (guesses.length > 5) {
          fotosContainer.innerHTML += `
            <div class="w-6 h-6 rounded-full border border-card-bg bg-zinc-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 text-white">+${guesses.length - 5}</div>
          `;
        }
      }

      const listaContainer = document.getElementById('lista-palpites-amigos');
      if (isLocked) {
        if (!guesses || guesses.length === 0) {
          listaContainer.innerHTML = '<p class="text-text-muted text-[13px] text-center py-4">Nenhum palpite enviado ainda.</p>';
        } else {
          listaContainer.innerHTML = '';
          guesses.forEach(guess => {
            const name = guess.profiles ? guess.profiles.full_name : 'Participante';
            const avatar = guess.profiles && guess.profiles.avatar_url 
              ? guess.profiles.avatar_url 
              : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
            
            listaContainer.innerHTML += `
              <div class="bg-zinc-800/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
                <div class="flex items-center gap-3">
                  <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                  <span class="font-bold text-[14px] text-white">${name}</span>
                </div>
                <div class="bg-black/40 px-3 py-1 rounded-lg font-black text-brand-green text-[14px]">
                  ${guess.score_home} x ${guess.score_away}
                </div>
              </div>
            `;
          });
        }
      } else {
        listaContainer.innerHTML = `
          <div class="bg-zinc-800/20 p-5 rounded-2xl border border-white/5 text-center fade-in">
            <p class="text-brand-green font-bold text-[14px] mb-2">🔒 Palpites Ocultos</p>
            <p class="text-text-muted text-[12px] leading-relaxed">
              Para manter a disputa justa, os palpites dos outros participantes ficarão visíveis a partir de 10 minutos antes do início do jogo.
            </p>
          </div>
        `;

        if (guesses && guesses.length > 0) {
          listaContainer.innerHTML += `
            <h3 class="text-[11px] font-bold text-text-muted uppercase tracking-widest mt-6 mb-3">Já participaram:</h3>
            <div class="space-y-2">
          `;
          guesses.forEach(guess => {
            const name = guess.profiles ? guess.profiles.full_name : 'Participante';
            const avatar = guess.profiles && guess.profiles.avatar_url 
              ? guess.profiles.avatar_url 
              : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random&color=fff';
            
            listaContainer.innerHTML += `
              <div class="bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between border border-white/5 fade-in">
                <div class="flex items-center gap-3">
                  <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                  <span class="font-bold text-[13px] text-white">${name}</span>
                </div>
                <span class="text-brand-green text-[11px] font-bold">Palpitou</span>
              </div>
            `;
          });
          listaContainer.innerHTML += `</div>`;
        }
      }

    } catch (e) {
      console.error("Erro ao carregar dados dinâmicos da partida:", e);
    }
  }

  // 4. Carrega desafio do jogador (GM) para este jogo se houver
  if (typeof carregarDesafioPartida === 'function') {
    carregarDesafioPartida(id);
  }
}

async function salvarPalpite() {
  if (!sbClient) {
    alert("Supabase não está inicializado.");
    return;
  }
  if (!grupoAtual) {
    alert("Nenhum grupo ativo selecionado.");
    return;
  }

  const confirmBtn = document.getElementById("btn-confirmar-palpite");
  const originalText = confirmBtn ? confirmBtn.innerHTML : "Confirmar Palpite";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-black inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...';
  }

  try {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) {
      alert("Você precisa estar logado para palpitar!");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    const id = jogoAtual.fixture.id;

    // 1. Garante que o jogo existe na tabela matches (exigido pela FK constraint)
    const { error: matchError } = await sbClient.from('matches').upsert([{
      id:           jogoAtual.fixture.id,
      league_id:    jogoAtual.league.id,
      season:       jogoAtual.league.season,
      home_team:    jogoAtual.teams.home.name,
      home_team_id: jogoAtual.teams.home.id,
      home_logo:    getFlagUrl(jogoAtual.teams.home.id) || jogoAtual.teams.home.logo || '',
      away_team:    jogoAtual.teams.away.name,
      away_team_id: jogoAtual.teams.away.id,
      away_logo:    getFlagUrl(jogoAtual.teams.away.id) || jogoAtual.teams.away.logo || '',
      kickoff:      jogoAtual.fixture.date,
      status:       jogoAtual.fixture.status.short,
      score_home:   jogoAtual.goals.home,
      score_away:   jogoAtual.goals.away,
      minute:       jogoAtual.fixture.status.elapsed != null ? String(jogoAtual.fixture.status.elapsed) : null,
      round:        jogoAtual.league.round
    }], { onConflict: 'id' });

    if (matchError) {
      console.error("Erro ao salvar partida:", matchError.message);
      alert("Erro ao preparar dados da partida. Tente novamente.");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    // 2. Envia o palpite para o guesses (com group_id do grupo ativo)
    const { error: guessError } = await sbClient
      .from('guesses')
      .upsert([{
        user_id:    user.id,
        match_id:   id,
        score_home: golsHome,
        score_away: golsAway,
        group_id:   grupoAtual.id
      }], { onConflict: 'user_id,group_id,match_id' });

    if (guessError) {
      console.error("Erro ao salvar palpite:", guessError.message);
      alert("Não foi possível salvar seu palpite. Tente novamente.");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
      return;
    }

    // 3. Atualiza a UI se salvou com sucesso
    const idx = palpitesUsuario.findIndex(p => p.match_id === id);
    if (idx !== -1) {
      palpitesUsuario[idx].score_home = golsHome;
      palpitesUsuario[idx].score_away = golsAway;
    } else {
      palpitesUsuario.push({
        match_id: id,
        score_home: golsHome,
        score_away: golsAway
      });
    }

    // Redefine o original para que a interface reflita o estado salvo
    palpiteOriginal.home = golsHome;
    palpiteOriginal.away = golsAway;

    switchView('view-jogos');
    gerarFiltrosRodadas();
    filtrarPorRodada(rodadaSelecionada);

  } catch (e) {
    console.error("Erro inesperado:", e);
    alert("Ocorreu um erro inesperado. Tente novamente.");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  }
}

// ============ SIMULADOR DE PONTUAÇÃO (TESTE VIA CONSOLE) ============

/**
 * Uso no console do navegador (F12):
 *   simularPontuacaoLocal('2x1', '2x1')  → Placar Exato = 30 pts
 *   simularPontuacaoLocal('3x1', '2x0')  → Vencedor + saldo = 15 pts
 *   simularPontuacaoLocal('1x0', '3x2')  → Só vencedor = 4 pts
 *   simularPontuacaoLocal('0x0', '1x1')  → Empate (não exato) = 18 pts
 */
window.simularPontuacaoLocal = function(palpiteStr, resultadoStr) {
  const parsePlacar = (str) => {
    const partes = str.toLowerCase().split('x');
    return { home: parseInt(partes[0]), away: parseInt(partes[1]) };
  };

  const p = parsePlacar(palpiteStr);
  const r = parsePlacar(resultadoStr);

  if (isNaN(p.home) || isNaN(p.away) || isNaN(r.home) || isNaN(r.away)) {
    console.error('❌ Formato inválido. Use: simularPontuacaoLocal("2x1", "3x2")');
    return;
  }

  const pts = calcularPontosPalpite(p.home, p.away, r.home, r.away);

  const tabela = {
    30: '🏆 Placar Exato',
    18: '🎯 Empate / Vencedor + gols de um time',
    15: '📊 Vencedor + saldo de gols',
    12: '⚽ Vencedor + gols do perdedor',
    4:  '✅ Acertou o vencedor',
    3:  '🔢 Acertou placar de algum time',
    0:  '❌ Nenhum acerto'
  };

  console.log(`\n📋 SIMULAÇÃO DE PONTUAÇÃO`);
  console.log(`   Palpite:   ${p.home} x ${p.away}`);
  console.log(`   Resultado: ${r.home} x ${r.away}`);
  console.log(`   ─────────────────────`);
  console.log(`   Pontos: ${pts}  →  ${tabela[pts] || '?'}`);
  console.log(``);

  return pts;
};

function abrirSuporteWhatsapp() {
  if (typeof SUPORTE_WHATSAPP !== 'undefined' && SUPORTE_WHATSAPP && SUPORTE_WHATSAPP !== '5500000000000') {
    const url = `https://wa.me/${SUPORTE_WHATSAPP}`;
    window.open(url, '_blank');
  } else {
    alert("O administrador ainda não configurou o número de suporte!");
  }
}

function verificarBannerPWA() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  // Verifica se já está rodando standalone (salvo na tela inicial)
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  if (!isStandalone) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// Carrega e desenha o desafio do jogador (GM) se aplicável
async function carregarDesafioPartida(fixtureId) {
  const container = document.getElementById('desafio-jogo-container');
  if (!container) return;

  container.classList.add('hidden');
  container.innerHTML = '';

  if (!sbClient || !grupoAtual || !usuarioAtual) return;

  try {
    // 1. Busca se há um desafio ativo para a partida
    const { data: desafio, error: errDesafio } = await sbClient
      .from('desafios')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('status', 'active')
      .maybeSingle();

    if (errDesafio || !desafio) return;

    // 2. Busca se o usuário logado já votou nesse desafio
    const { data: meuVoto, error: errVoto } = await sbClient
      .from('user_desafios')
      .select('*')
      .eq('desafio_id', desafio.id)
      .eq('user_id', usuarioAtual.id)
      .eq('group_id', grupoAtual.id)
      .maybeSingle();

    container.classList.remove('hidden');

    const hasPenalty = desafio.event_type.endsWith('_penalty');
    const cleanEventType = desafio.event_type.replace('_penalty', '');

    let acaoTexto = '';
    let customQuestion = '';
    
    if (cleanEventType === 'Goal') {
      acaoTexto = 'fará um GOL';
      customQuestion = 'Quem fará um GOL nesta partida?';
    } else if (cleanEventType === 'Assist') {
      acaoTexto = 'dará uma ASSISTÊNCIA';
      customQuestion = 'Quem dará uma ASSISTÊNCIA nesta partida?';
    } else if (cleanEventType === 'CardYellow') {
      acaoTexto = 'receberá CARTÃO AMARELO';
      customQuestion = 'Quem receberá CARTÃO AMARELO nesta partida?';
    } else if (cleanEventType === 'CardRed') {
      acaoTexto = 'receberá CARTÃO VERMELHO';
      customQuestion = 'Quem receberá CARTÃO VERMELHO nesta partida?';
    } else if (cleanEventType.startsWith('CornersOver')) {
      const limit = cleanEventType.replace('CornersOver', '');
      acaoTexto = `Mais/Menos de ${limit} Escanteios`;
      customQuestion = `Teremos mais ou menos de ${limit} escanteios na partida?`;
    } else if (cleanEventType.startsWith('CardsOver')) {
      const limit = cleanEventType.replace('CardsOver', '');
      acaoTexto = `Mais/Menos de ${limit} Cartões`;
      customQuestion = `Teremos mais ou menos de ${limit} cartões na partida?`;
    } else if (cleanEventType === 'BTTS') {
      acaoTexto = 'Ambos Marcam';
      customQuestion = 'Ambos os times marcam gols nesta partida?';
    } else {
      acaoTexto = cleanEventType;
      customQuestion = `Qual opção vencerá o desafio especial?`;
    }

    const infoPontosText = hasPenalty 
      ? `(+${desafio.points} pts / -${desafio.points} pts se errar)`
      : `(+${desafio.points} pts)`;

    const subheaderText = hasPenalty
      ? `Acerte e ganhe +${desafio.points} pontos. Erre e perca -${desafio.points} pts! ⚠️`
      : `Acerte e ganhe +${desafio.points} pontos extras!`;

    if (meuVoto) {
      container.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/20 rounded-2xl p-5 border border-purple-500/30 shadow-lg relative overflow-hidden fade-in mt-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm flex-shrink-0">🏆</div>
            <div>
              <h4 class="font-black text-xs text-purple-400 uppercase tracking-widest">Desafio Aceito</h4>
              <p class="text-[12px] text-white font-medium mt-1">Você escolheu <span class="text-purple-300 font-bold">${meuVoto.chosen_player}</span> para acertar o desafio.</p>
              <p class="text-[10px] text-text-muted mt-2">Aguardando o encerramento do jogo para validação do prêmio ${infoPontosText}.</p>
            </div>
          </div>
        </div>
      `;
    } else {
      let buttonsHtml = '';
      desafio.players.forEach(player => {
        buttonsHtml += `
          <button onclick="responderDesafioReal('${desafio.id}', '${player.replace(/'/g, "\\'")}')" class="w-full bg-zinc-900 hover:bg-purple-900/40 border border-zinc-800 hover:border-purple-500/50 text-white hover:text-purple-300 font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 text-center truncate">
            ${player}
          </button>
        `;
      });

      container.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900/40 to-indigo-900/30 rounded-2xl p-5 border border-purple-500/40 shadow-lg relative overflow-hidden fade-in mt-4">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg flex-shrink-0">🏆</div>
            <div>
              <h4 class="font-black text-xs text-purple-300 uppercase tracking-widest">Desafio Especial do GM</h4>
              <p class="text-[13px] text-white/90 font-bold mt-1">${customQuestion}</p>
              <p class="text-[10px] text-purple-400 font-medium mt-0.5">${subheaderText}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${buttonsHtml}
          </div>
        </div>
      `;
    }

  } catch (e) {
    console.error("Erro ao carregar desafio da partida:", e);
  }
}

// Salva a resposta do usuário no desafio
async function responderDesafioReal(desafioId, jogadorEscolhido) {
  if (!sbClient || !grupoAtual || !usuarioAtual) return;

  try {
    const { error } = await sbClient
      .from('user_desafios')
      .insert([{
        user_id: usuarioAtual.id,
        desafio_id: desafioId,
        group_id: grupoAtual.id,
        chosen_player: jogadorEscolhido,
        points_awarded: 0
      }]);

    if (error) {
      alert("Erro ao aceitar desafio: " + error.message);
      return;
    }

    alert(`Desafio aceito! Você apostou em: ${jogadorEscolhido}`);
    if (jogoAtual) {
      carregarDesafioPartida(jogoAtual.fixture.id);
    }

  } catch (e) {
    console.error("Erro ao responder desafio:", e);
  }
}

// ============ MONITORAMENTO E POLLING AO VIVO ============

function ativarTelaAoVivo(fixtureId) {
  desativarTelaAoVivo();
  if (!jogoAtual) return;

  const aoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  if (!aoVivo.includes(jogoAtual.fixture.status.short)) return;

  console.log(`[LIVE POLLING] Iniciado para a partida ${fixtureId}`);

  intervaloAoVivo = setInterval(async () => {
    console.log(`[LIVE POLLING] Buscando dados...`);
    if (typeof buscarDadosAoVivo === 'function') {
      const jogosAoVivo = await buscarDadosAoVivo();
      if (Array.isArray(jogosAoVivo)) {
        const jogoEspecifico = jogosAoVivo.find(j => j.fixture.id === fixtureId);
        if (jogoEspecifico) {
          renderizarPlacarAoVivo(jogoEspecifico);
        }
      }
    }
  }, 60000); // 60 segundos
}

function desativarTelaAoVivo() {
  if (intervaloAoVivo) {
    console.log('[LIVE POLLING] Encerrado.');
    clearInterval(intervaloAoVivo);
    intervaloAoVivo = null;
  }
}

function renderizarPlacarAoVivo(jogo) {
  // Atualiza os dados locais na tabela global de jogos
  if (Array.isArray(todosOsJogos)) {
    const idx = todosOsJogos.findIndex(j => j.fixture.id === jogo.fixture.id);
    if (idx !== -1) {
      todosOsJogos[idx] = jogo;
    }
  }

  // Se o usuário ainda estiver olhando para este jogo, atualiza a tela
  if (jogoAtual && jogoAtual.fixture.id === jogo.fixture.id) {
    jogoAtual = jogo;
    const realHome = jogo.goals.home ?? 0;
    const realAway = jogo.goals.away ?? 0;

    const realScoreEl = document.getElementById('d-real-score');
    if (realScoreEl) {
      realScoreEl.innerHTML = `<span class="text-xl font-black text-white">${realHome} x ${realAway}</span>`;
    }

    const elapsed = jogo.fixture.status.elapsed ? ` (${jogo.fixture.status.elapsed}')` : '';
    document.getElementById('d-jogo-data').innerHTML = `<span class="text-red-500 font-bold animate-pulse">● AO VIVO${elapsed}</span>`;
  }

  // Atualiza a visualização principal em segundo plano se ela estiver visível
  const viewJogos = document.getElementById('view-jogos');
  if (viewJogos && !viewJogos.classList.contains('hidden')) {
    if (typeof filtrarPorRodada === 'function') {
      filtrarPorRodada(rodadaSelecionada);
    }
  }
}

async function compartilharRankingWhatsApp() {
  if (!grupoAtual) {
    alert("Selecione um grupo primeiro!");
    return;
  }

  const ranking = window.ultimoRankingCalculado;
  if (!ranking || ranking.length === 0) {
    alert("Nenhum ranking carregado para compartilhar!");
    return;
  }

  const seletor = document.getElementById('seletor-ranking');
  const tipoTexto = seletor ? seletor.options[seletor.selectedIndex].text : 'Ranking Geral';

  let msg = `🏆 *${tipoTexto} - Bolão ${grupoAtual.nome}* 🏆\n\n`;

  ranking.slice(0, 10).forEach((user, index) => {
    const posicao = index + 1;
    let emoji = '👤';
    if (posicao === 1) emoji = '🥇';
    else if (posicao === 2) emoji = '🥈';
    else if (posicao === 3) emoji = '🥉';

    msg += `${emoji} ${posicao}º ${user.nome} - *${user.pontos} Pts* (${user.acertosExatos} exatos)\n`;
  });

  if (ranking.length > 10) {
    msg += `\n...e mais ${ranking.length - 10} participantes!`;
  }

  const origin = window.location.origin + window.location.pathname;
  const linkApp = origin.startsWith("file://")
    ? "https://bolao-pro-six.vercel.app/?code=" + grupoAtual.invite_code
    : origin + "?code=" + grupoAtual.invite_code;

  msg += `\n\n👉 Jogue conosco! Código do grupo: *${grupoAtual.invite_code}*`;
  msg += `\n🔗 ${linkApp}`;

  const urlUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(msg);
  // Redireciona para abrir o WhatsApp diretamente (evita bloqueio de popup em PWAs mobile)
  window.location.href = urlUrl;
}

// Pull to Refresh para PWAs (arrastar para baixo e atualizar)
(function() {
  let touchStart = 0;
  let touchMove = 0;
  let pulling = false;
  const threshold = 70;
  const maxPull = 100;
  
  // Elementos do indicador
  const ptr = document.getElementById('pull-to-refresh');
  if (!ptr) return;
  const icon = document.getElementById('ptr-icon');
  const spinner = document.getElementById('ptr-spinner');
  const text = document.getElementById('ptr-text');

  document.addEventListener('touchstart', function(e) {
    // Só ativa quando o scroll está no topo absoluto
    if (window.scrollY === 0) {
      touchStart = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    
    touchMove = e.touches[0].clientY;
    const distance = touchMove - touchStart;
    
    // Puxando para baixo no topo
    if (distance > 0 && window.scrollY === 0) {
      if (e.cancelable) e.preventDefault();
      
      // Aplica resistência física no arrasto
      const pullDist = Math.min(maxPull, distance * 0.4);
      ptr.style.transform = `translateY(${pullDist - 60}px)`;
      
      // Atualiza estado do indicador
      if (pullDist >= threshold) {
        text.textContent = 'Solte para atualizar';
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        text.textContent = 'Puxe para atualizar';
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function() {
    if (!pulling) return;
    pulling = false;
    
    const distance = touchMove - touchStart;
    const pullDist = Math.min(maxPull, distance * 0.4);
    
    if (pullDist >= threshold) {
      // Ativa o estado de carregando e recarrega a página
      ptr.style.transform = 'translateY(15px)';
      if (icon) icon.classList.add('hidden');
      if (spinner) spinner.classList.remove('hidden');
      text.textContent = 'Atualizando...';
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      // Recolhe o indicador
      ptr.style.transform = 'translateY(-100%)';
    }
    
    touchStart = 0;
    touchMove = 0;
  });
})();

// ============ CORREÇÃO DO TECLADO MOBILE (FIXED NAV BARS) ============
(function() {
  if (window.visualViewport) {
    let maxVisualHeight = window.visualViewport.height;
    let lastWidth = window.visualViewport.width;
    
    window.visualViewport.addEventListener('resize', function() {
      const bottomNav = document.getElementById('bottom-nav');
      const gmBottomNav = document.getElementById('gm-bottom-nav');
      
      // Se a largura mudou, foi uma rotação. Atualiza referências e sai.
      if (window.visualViewport.width !== lastWidth) {
        lastWidth = window.visualViewport.width;
        maxVisualHeight = window.visualViewport.height;
        if (bottomNav) bottomNav.style.removeProperty('display');
        if (gmBottomNav) gmBottomNav.style.removeProperty('display');
        return;
      }
      
      if (window.visualViewport.height > maxVisualHeight) {
        maxVisualHeight = window.visualViewport.height;
      }
      
      // Se a altura do viewport visual encolheu mais de 150px em relação ao máximo
      if (window.visualViewport.height < maxVisualHeight - 150) {
        if (bottomNav) bottomNav.style.setProperty('display', 'none', 'important');
        if (gmBottomNav) gmBottomNav.style.setProperty('display', 'none', 'important');
      } else {
        if (bottomNav) bottomNav.style.removeProperty('display');
        if (gmBottomNav) gmBottomNav.style.removeProperty('display');
      }
    });
  }
})();

// ============ CONTROLE DE DESAFIOS DO USUÁRIO ============

let abaDesafiosAtiva = 'ativos';

function alternarAbaDesafios(aba) {
  abaDesafiosAtiva = aba;
  
  const btnAtivos = document.getElementById('btn-tab-desafios-ativos');
  const btnHistorico = document.getElementById('btn-tab-desafios-historico');
  const tabAtivos = document.getElementById('tab-desafios-ativos');
  const tabHistorico = document.getElementById('tab-desafios-historico');

  if (!btnAtivos || !btnHistorico || !tabAtivos || !tabHistorico) return;

  if (aba === 'ativos') {
    btnAtivos.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all text-xs uppercase tracking-wider";
    btnHistorico.className = "flex-1 py-3 text-text-muted hover:text-white transition-all text-xs uppercase tracking-wider font-bold";
    tabAtivos.classList.remove('hidden');
    tabHistorico.classList.add('hidden');
  } else {
    btnHistorico.className = "flex-1 py-3 border-b-2 border-brand-green font-bold text-brand-green transition-all text-xs uppercase tracking-wider";
    btnAtivos.className = "flex-1 py-3 text-text-muted hover:text-white transition-all text-xs uppercase tracking-wider font-bold";
    tabHistorico.classList.remove('hidden');
    tabAtivos.classList.add('hidden');
  }

  carregarDesafiosUsuarioView();
}

async function carregarDesafiosUsuarioView() {
  const listaAtivos = document.getElementById('lista-desafios-ativos-usuario');
  const listaHistorico = document.getElementById('lista-desafios-historico-usuario');

  if (!listaAtivos || !listaHistorico || !sbClient || !grupoAtual || !usuarioAtual) return;

  if (abaDesafiosAtiva === 'ativos') {
    listaAtivos.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Buscando desafios disponíveis...</p>';
    try {
      const { data: desafios, error } = await sbClient
        .from('desafios')
        .select('*')
        .eq('status', 'active');

      if (error) {
        listaAtivos.innerHTML = `<p class="text-red-400 text-[13px] text-center py-8">Erro: ${error.message}</p>`;
        return;
      }

      const desafiosGrupo = (desafios || []).filter(d => todosOsJogos.some(j => j.fixture.id === d.fixture_id));

      if (desafiosGrupo.length === 0) {
        listaAtivos.innerHTML = renderEmptyState(
          '🪄', 
          'Calmaria em Campo', 
          'Nenhum desafio ativo no momento. Fique ligado, O Mago pode tirar uma aposta da cartola a qualquer momento!'
        );
        return;
      }

      const desafioIds = desafiosGrupo.map(d => d.id);
      const { data: meusVotos } = await sbClient
        .from('user_desafios')
        .select('desafio_id, chosen_player')
        .in('desafio_id', desafioIds)
        .eq('user_id', usuarioAtual.id)
        .eq('group_id', grupoAtual.id);

      const votosMap = {};
      (meusVotos || []).forEach(v => {
        votosMap[v.desafio_id] = v.chosen_player;
      });

      listaAtivos.innerHTML = '';
      desafiosGrupo.forEach(d => {
        const jaVotou = !!votosMap[d.id];
        const votoUsuario = votosMap[d.id];
        
        const labelRegra = (typeof traduzirRegraDesafio === 'function') ? traduzirRegraDesafio(d.event_type) : d.event_type;
        const ptsInfo = `+${d.points} pts`;

        let cardHtml = `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-[14px] text-white truncate">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5">Regra: <strong>${labelRegra}</strong></p>
              </div>
              <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex-shrink-0 ml-3">${ptsInfo}</span>
            </div>
            
            ${jaVotou ? `
              <div class="mt-3 p-3 bg-purple-650/10 border border-purple-500/20 rounded-xl flex justify-between items-center">
                <span class="text-[11px] text-zinc-300">Seu palpite: <strong class="text-white">${votoUsuario}</strong></span>
                <span class="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">Aguardando</span>
              </div>
            ` : `
              <div class="flex gap-2 mt-4">
                <button onclick="if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(${d.fixture_id})" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 shadow-lg shadow-purple-650/20">
                  Participar do Desafio
                </button>
              </div>
            `}
          </div>
        `;
        listaAtivos.innerHTML += cardHtml;
      });

    } catch (e) {
      console.error(e);
      listaAtivos.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar desafios.</p>';
    }
  } else {
    listaHistorico.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Carregando histórico...</p>';
    try {
      const { data: votos, error } = await sbClient
        .from('user_desafios')
        .select(`
          id,
          chosen_player,
          points_awarded,
          desafio_id,
          desafios (
            match_name,
            event_type,
            points,
            status
          )
        `)
        .eq('user_id', usuarioAtual.id)
        .eq('group_id', grupoAtual.id);

      if (error) {
        listaHistorico.innerHTML = `<p class="text-red-400 text-[13px] text-center py-8">Erro: ${error.message}</p>`;
        return;
      }

      const historicoDesafios = (votos || []).filter(v => v.desafios && v.desafios.status === 'resolved');

      if (historicoDesafios.length === 0) {
        listaHistorico.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Nenhum palpite em desafios finalizados.</p>';
        return;
      }

      listaHistorico.innerHTML = '';
      historicoDesafios.forEach(v => {
        const d = v.desafios;
        const acertou = v.points_awarded > 0;
        const perdeu = v.points_awarded < 0;
        
        const labelRegra = (typeof traduzirRegraDesafio === 'function') ? traduzirRegraDesafio(d.event_type) : d.event_type;
        
        let statusBadge = '';
        if (acertou) {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">+${v.points_awarded} PTS</span>`;
        } else if (perdeu) {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">${v.points_awarded} PTS</span>`;
        } else {
          statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">0 PTS</span>`;
        }

        let cardHtml = `
          <div class="bg-card-bg border border-white/5 rounded-2xl p-4 mb-3">
            <div class="flex justify-between items-start mb-2">
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-[14px] text-white truncate">${d.match_name}</h4>
                <p class="text-[12px] text-text-muted mt-0.5">Regra: <strong>${labelRegra}</strong></p>
              </div>
              <div class="ml-3 flex-shrink-0">${statusBadge}</div>
            </div>
            <div class="mt-3 p-3 bg-black/30 border border-white/5 rounded-xl flex justify-between items-center">
              <span class="text-[11px] text-text-muted">Seu voto: <strong class="text-white">${v.chosen_player}</strong></span>
              <span class="text-[11px] font-bold ${acertou ? 'text-green-400' : (perdeu ? 'text-red-400' : 'text-zinc-400')} uppercase">${acertou ? 'Acertou' : (perdeu ? 'Errou' : 'Errou')}</span>
            </div>
          </div>
        `;
        listaHistorico.innerHTML += cardHtml;
      });

    } catch (e) {
      console.error(e);
      listaHistorico.innerHTML = '<p class="text-red-400 text-[13px] text-center py-8">Erro ao carregar histórico.</p>';
    }
  }
}


