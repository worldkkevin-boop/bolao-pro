// ============ GESTÃO DE GRUPOS ============

async function carregarGrupos() {
  if (!sbClient) return;
  let user = usuarioAtual;
  if (!user) {
    const { data: { session } } = await sbClient.auth.getSession();
    user = session ? session.user : null;
  }
  if (!user) return;

  // Pega os IDs de todos os grupos que o usuário é membro
  const { data: memberships, error: errM } = await sbClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .neq('role', 'pending');

  if (errM) { console.error('Erro ao carregar memberships:', errM.message); return; }
  if (!memberships || memberships.length === 0) { renderListaGrupos([]); return; }

  const groupIds = memberships.map(m => m.group_id);

  const { data: grupos, error: errG } = await sbClient
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (errG) { console.error('Erro ao carregar grupos:', errG.message); return; }
  renderListaGrupos(grupos || []);
}

function renderListaGrupos(grupos) {
  const container = document.getElementById('lista-grupos');
  if (grupos.length === 0) {
    container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Você ainda não tem grupos.<br>Crie um acima!</p>';
    return;
  }
  container.innerHTML = '';
  grupos.forEach(g => {
    container.innerHTML += `
      <div onclick="entrarNoGrupo('${g.id}', '${g.name.replace(/'/g,"&#39;")}', '${g.invite_code}', '${g.owner_id}', ${g.league_id || 1})" class="bg-card-bg rounded-[1.25rem] p-4 cursor-pointer hover:bg-card-hover transition-colors border border-white/5 relative overflow-hidden mb-3">
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-brand-green"></div>
        <div class="flex items-center gap-3 pl-2">
          <div class="w-11 h-11 rounded-xl bg-app-bg flex items-center justify-center text-brand-green border border-white/5 flex-shrink-0 overflow-hidden relative">
            <svg id="fallback-icon-${g.id}" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <img id="img-icon-${g.id}" src="https://hkiqozqqcymbhfobydoq.supabase.co/storage/v1/object/public/grupos-icons/${g.id}.jpg?t=${Date.now()}" class="w-full h-full object-cover absolute inset-0 hidden" onload="document.getElementById('fallback-icon-${g.id}').classList.add('hidden'); this.classList.remove('hidden');" onerror="this.src='';">
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[15px] truncate">${g.name}</h3>
            <p class="text-[12px] text-text-muted font-medium">#${g.invite_code}</p>
          </div>
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-text-muted flex-shrink-0"><path d="M9 5l7 7-7 7"></path></svg>
        </div>
      </div>`;
  });
}

async function entrarNoGrupo(grupoId, grupoNome, conviteCodigo, ownerId, leagueId = 1, targetView = null) {
  // Recupera o limite salvo em cache para evitar flashes na UI
  let savedLimit = null;
  const savedGroupStr = localStorage.getItem('last_active_group');
  if (savedGroupStr) {
    try {
      const sg = JSON.parse(savedGroupStr);
      if (sg && sg.id === grupoId && sg.max_participants !== undefined) {
        savedLimit = sg.max_participants;
      }
    } catch (e) {}
  }

  grupoAtual = { 
    id: grupoId, 
    nome: grupoNome, 
    invite_code: conviteCodigo, 
    owner_id: ownerId, 
    league_id: leagueId,
    max_participants: savedLimit !== null ? savedLimit : 3 // Padrão grátis
  };
  
  // Puxa a linha completa do banco para obter regras de pontuação atualizadas e se é privado
  if (sbClient) {
    try {
      const { data: grpFull } = await sbClient
        .from('groups')
        .select('*')
        .eq('id', grupoId)
        .single();
      if (grpFull) {
        grupoAtual = grpFull;
        grupoNome = grpFull.name;
        conviteCodigo = grpFull.invite_code;
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes completos do grupo:", err);
    }
  }

  localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));
  todosOsJogos = [];
  rodadaSelecionada = null; // Reseta para detectar a rodada atual ao carregar jogos

  document.getElementById('nome-grupo').innerText = grupoNome;
  document.getElementById('codigo-grupo').innerText = conviteCodigo || '—';

  const imgEl = document.getElementById('icone-grupo-header');
  const svgEl = document.getElementById('grupo-icon-fallback');
  
  if (imgEl && svgEl) {
    // Tenta carregar o ícone do Storage. Se falhar (404), o onerror exibe o fallback.
    imgEl.src = `https://hkiqozqqcymbhfobydoq.supabase.co/storage/v1/object/public/grupos-icons/${grupoId}.jpg?t=${Date.now()}`;
    imgEl.onload = function() {
      imgEl.classList.remove('hidden');
      svgEl.classList.add('hidden');
    };
    imgEl.onerror = function() {
      imgEl.src = '';
      imgEl.classList.add('hidden');
      svgEl.classList.remove('hidden');
    };
  }

  const finalView = targetView || 'view-grupo-home';
  if (typeof switchView === 'function') switchView(finalView);

  // Atualiza badge de vagas
  atualizarBadgeVagas(grupoId);
  carregarPoteBanner();
  
  if (typeof verificarExibicaoBotaoBonusJogador === 'function') {
    verificarExibicaoBotaoBonusJogador();
  }
}

async function atualizarBadgeVagas(grupoId) {
  const badge = document.getElementById('badge-vagas');
  if (!badge || !sbClient) return;

  try {
    const { count } = await sbClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', grupoId)
      .neq('role', 'pending');

    const { data: grp } = await sbClient
      .from('groups')
      .select('max_participants')
      .eq('id', grupoId)
      .single();

    const limite = (grp && grp.max_participants) ? grp.max_participants : 3;
    
    // Atualiza o limite no estado global e salva no cache local
    if (grupoAtual && grupoAtual.id === grupoId) {
      const limiteAntes = grupoAtual.max_participants;
      grupoAtual.max_participants = limite;
      localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));
      
      // Se o limite mudou ou foi resolvido agora, e a aba ativa for desafios ou ranking, re-renderiza para aplicar/retirar travas
      if (limiteAntes !== limite) {
        const savedView = localStorage.getItem('last_active_view');
        if (savedView === 'view-desafios' && typeof carregarDesafiosUsuarioView === 'function') {
          carregarDesafiosUsuarioView();
        } else if (savedView === 'view-ranking' && typeof exibirRankingSelecionado === 'function') {
          exibirRankingSelecionado();
        }
      }
    }

    const vagas = limite - count;

    badge.classList.remove('hidden');
    badge.innerText = `${count}/${limite}`;

    if (vagas <= 0) {
      badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400';
      badge.innerText = `LOTADO ${count}/${limite}`;
    } else if (vagas <= 3) {
      badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400';
      badge.innerText = `${count}/${limite} ⚡ ${vagas} vagas`;
    } else {
      badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-green/20 text-brand-green';
    }

    // Renderiza o botão de upgrade se for o dono e estiver no plano grátis (limite <= 3)
    const containerUpgrade = document.getElementById('container-upgrade-grupo');
    const containerTesouraria = document.getElementById('container-tesouraria-grupo');
    const ehDono = usuarioAtual && (usuarioAtual.id === (grupoAtual && grupoAtual.owner_id));

    if (containerUpgrade) {
      const precisaUpgrade = limite <= 3;
      
      if (ehDono && precisaUpgrade) {
        containerUpgrade.classList.remove('hidden');
        containerUpgrade.innerHTML = `
          <button onclick="abrirModalUpgrade()" class="mt-3 w-full bg-gradient-to-r from-purple-600 to-brand-green hover:opacity-90 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wide shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2">
            <span class="text-sm">⚡</span> Desbloquear 20 Vagas
          </button>
        `;
      } else {
        containerUpgrade.classList.add('hidden');
        containerUpgrade.innerHTML = '';
      }
    }

    if (containerTesouraria) {
      if (ehDono) {
        containerTesouraria.classList.remove('hidden');
        containerTesouraria.innerHTML = `
          <button onclick="abrirTesouraria()" class="w-full mt-2 bg-black/40 border border-brand-green/50 text-brand-green hover:bg-brand-green/10 font-black py-3 rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95">
            <span>💰</span> Abrir Tesouraria
          </button>
        `;
      } else {
        containerTesouraria.classList.add('hidden');
        containerTesouraria.innerHTML = '';
      }
    }
  } catch (e) {
    console.error('Erro ao buscar vagas:', e);
  }
}

async function criarGrupoReal() {
  const nome = document.getElementById('input-nome-grupo').value.trim();
  if (!nome) return;

  const btn = document.getElementById('btn-criar-grupo');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  // Trava de grupos por usuário (B2C Catraca)
  const limitePermitido = await checarLimiteGruposUsuario();
  if (!limitePermitido) {
    btn.disabled = false;
    btn.textContent = 'Criar';
    return;
  }

  const { data: { user } } = await sbClient.auth.getUser();
  const codigo = Math.random().toString(36).substring(2, 9).toUpperCase();
  const leagueId = parseInt(document.getElementById('select-liga-grupo').value) || 1;

  const { data: novoGrupo, error } = await sbClient
    .from('groups')
    .insert([{ name: nome, invite_code: codigo, owner_id: user.id, league_id: leagueId, max_participants: 3 }])
    .select()
    .single();

  btn.disabled = false;
  btn.textContent = 'Criar';

  if (error) { console.error('Erro ao criar grupo:', error.message); return; }

  // Adiciona o criador como membro (dono)
  await sbClient
    .from('group_members')
    .insert([{ group_id: novoGrupo.id, user_id: user.id, role: 'owner' }]);

  document.getElementById('input-nome-grupo').value = '';
  if (typeof fecharModal === 'function') fecharModal('modal-criar-grupo');
  carregarGrupos();
}

async function entrarPorCodigoApp() {
  const codigo = document.getElementById('input-codigo-entrar').value.trim().toUpperCase();
  if (!codigo) return;

  document.getElementById('entrar-grupo-error').classList.add('hidden');
  const btn = document.getElementById('btn-entrar-grupo');
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  const { data: grupo, error } = await sbClient
    .from('groups')
    .select('*')
    .eq('invite_code', codigo)
    .single();

  btn.disabled = false;
  btn.textContent = 'Buscar Grupo';

  if (error || !grupo) {
    document.getElementById('entrar-grupo-error').classList.remove('hidden');
    return;
  }

  const { data: { user } } = await sbClient.auth.getUser();

  // Verifica se o usuário já é membro (se for, só entra direto)
  const { data: jaEhMembro } = await sbClient
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', grupo.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (jaEhMembro) {
    if (jaEhMembro.role === 'pending') {
      showToast("Sua solicitação de entrada para este grupo está pendente de aprovação.", "error");
      const errorEl = document.getElementById('entrar-grupo-error');
      if (errorEl) {
        errorEl.innerText = "Solicitação pendente de aprovação pelo Administrador.";
        errorEl.classList.remove('hidden');
      }
      return;
    }
  } else {
    // Trava de grupos por usuário (B2C Catraca)
    const limitePermitido = await checarLimiteGruposUsuario();
    if (!limitePermitido) {
      if (typeof fecharModal === 'function') fecharModal('modal-entrar-grupo');
      return;
    }

    // 1. Conta quantos membros ativos o grupo já tem
    const { count: totalMembros, error: countError } = await sbClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', grupo.id)
      .neq('role', 'pending');

    if (countError) {
      console.error("Erro ao contar membros:", countError);
      return;
    }

    // 2. Descobre qual é o limite do grupo atual
    const limiteAtual = grupo.max_participants || 3; 

    // 3. A TRAVA! Se estiver lotado, barra a entrada.
    if (totalMembros >= limiteAtual) {
      showToast(`Ops! Este grupo atingiu o limite de ${limiteAtual} participantes.`, "error");
      const errorEl = document.getElementById('entrar-grupo-error');
      if (errorEl) {
        errorEl.innerText = `Ops! Este grupo atingiu o limite de ${limiteAtual} participantes.`;
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Se o grupo for privado, entra como 'pending'. Caso contrário, entra como 'member'.
    const isPrivate = grupo.privado === true;
    const insertRole = isPrivate ? 'pending' : 'member';

    const { error: insertError } = await sbClient
      .from('group_members')
      .insert([{ group_id: grupo.id, user_id: user.id, role: insertRole }]);

    if (insertError) {
      console.error("Erro ao adicionar membro:", insertError.message);
      showToast("Erro ao solicitar entrada no grupo.", "error");
      return;
    }

    if (isPrivate) {
      showToast("Solicitação de entrada enviada! Aguarde a aprovação do Administrador.", "success");
      document.getElementById('input-codigo-entrar').value = '';
      if (typeof fecharModal === 'function') fecharModal('modal-entrar-grupo');
      return;
    }
  }

  document.getElementById('input-codigo-entrar').value = '';
  if (typeof fecharModal === 'function') fecharModal('modal-entrar-grupo');
  entrarNoGrupo(grupo.id, grupo.name, grupo.invite_code, grupo.owner_id, grupo.league_id || 1);
}

function atualizarDestaquesHomeGrupo() {
  // Atualiza status do banner da TV Ao Vivo de forma segura
  try {
    const statusAoVivo = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
    const temJogoAoVivo = todosOsJogos && todosOsJogos.length > 0 && todosOsJogos.some(j => j && j.fixture && j.fixture.status && statusAoVivo.includes(j.fixture.status.short));
    if (typeof atualizarStatusBannerTV === 'function') {
      atualizarStatusBannerTV(temJogoAoVivo);
    }
  } catch (err) {
    console.error("Erro ao atualizar banner da TV:", err);
  }

  if (todosOsJogos.length === 0) return;

  const agora = new Date();

  // 1. Próximo Jogo (Kickoff futuro, o mais próximo do agora)
  const jogosFuturos = todosOsJogos.filter(j => new Date(j.fixture.date) > agora);
  
  // Ordena ascendente pela data
  jogosFuturos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

  const proximoJogo = jogosFuturos[0];
  const proxCard = document.getElementById('prox-jogo-card');
  const proxPalpiteEl = document.getElementById('prox-jogo-palpite');

  if (proximoJogo) {
    const homeNome = proximoJogo.teams.home.name;
    const awayNome = proximoJogo.teams.away.name;
    document.getElementById('prox-jogo-nome').innerText = `${homeNome} vs ${awayNome}`;

    // Adiciona interatividade: clique para ir direto palpitar
    if (proxCard) {
      proxCard.style.cursor = 'pointer';
      proxCard.onclick = () => {
        if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(proximoJogo.fixture.id);
      };
    }

    // Exibe se já palpitou ou pendente
    if (proxPalpiteEl) {
      const meuPalpiteProx = palpitesUsuario.find(p => p.match_id === proximoJogo.fixture.id);
      if (meuPalpiteProx) {
        proxPalpiteEl.innerText = `Palpite: ${meuPalpiteProx.score_home} x ${meuPalpiteProx.score_away}`;
        proxPalpiteEl.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green";
      } else {
        proxPalpiteEl.innerText = "⚠️ Você ainda não palpitou!";
        proxPalpiteEl.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 animate-pulse";
      }
    }

    // Função interna para atualizar contagem regressiva
    const atualizarTimer = () => {
      const kickoff = new Date(proximoJogo.fixture.date);
      const agoraTimer = new Date();
      const diff = kickoff - agoraTimer;

      if (diff <= 0) {
        document.getElementById('prox-jogo-tempo').innerText = 'Jogo em andamento!';
        clearInterval(countdownInterval);
        return;
      }

      const totalMinutos = Math.floor(diff / 60000);
      const totalHoras = Math.floor(totalMinutos / 60);
      const dias = Math.floor(totalHoras / 24);

      const horas = totalHoras % 24;
      const minutos = totalMinutos % 60;

      if (dias > 0) {
        document.getElementById('prox-jogo-tempo').innerText = `Inicia em: ${dias}d ${horas}h ${minutos}m`;
      } else if (horas > 0) {
        document.getElementById('prox-jogo-tempo').innerText = `Inicia em: ${horas}h ${minutos}m`;
      } else {
        document.getElementById('prox-jogo-tempo').innerText = `Inicia em: ${minutos}m`;
      }
    };

    if (countdownInterval) clearInterval(countdownInterval);
    atualizarTimer();
    countdownInterval = setInterval(atualizarTimer, 60000);
  } else {
    document.getElementById('prox-jogo-nome').innerText = 'Nenhum jogo agendado';
    document.getElementById('prox-jogo-tempo').innerText = '—';
    if (proxPalpiteEl) {
      proxPalpiteEl.innerText = '';
      proxPalpiteEl.className = 'hidden';
    }
    if (proxCard) {
      proxCard.style.cursor = 'default';
      proxCard.onclick = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // 2. Último Encerrado (Jogo finalizado, o mais recente do agora)
  const statusFinalizados = ['FT', 'AET', 'PEN'];
  const jogosEncerrados = todosOsJogos.filter(j => 
    statusFinalizados.includes(j.fixture.status.short) && 
    j.goals.home !== null && 
    j.goals.away !== null
  );

  // Ordena decrescente pela data (o mais recente primeiro)
  jogosEncerrados.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  const ultimoJogo = jogosEncerrados[0];
  const ultimoCard = document.getElementById('ultimo-jogo-card');
  const ultimoPalpiteEl = document.getElementById('ultimo-jogo-palpite');

  if (ultimoJogo) {
    const homeNome = ultimoJogo.teams.home.name;
    const awayNome = ultimoJogo.teams.away.name;
    const homeGols = ultimoJogo.goals.home;
    const awayGols = ultimoJogo.goals.away;
    document.getElementById('ultimo-jogo-nome').innerText = `${homeNome} ${homeGols} x ${awayGols} ${awayNome}`;

    // Adiciona interatividade: clique para ir direto ver os palpites dos amigos
    if (ultimoCard) {
      ultimoCard.style.cursor = 'pointer';
      ultimoCard.onclick = () => {
        if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(ultimoJogo.fixture.id);
      };
    }

    // Mapear rodada de forma amigável
    let rodada = ultimoJogo.league.round;
    let rodadaAmigavel = rodada;
    if (rodada.includes('Group Stage - ')) {
      rodadaAmigavel = 'Rodada ' + rodada.split('Group Stage - ')[1];
    } else if (rodada.includes('Regular Season - ')) {
      rodadaAmigavel = 'Rodada ' + rodada.split('Regular Season - ')[1];
    } else if (rodada === 'Round of 32') {
      rodadaAmigavel = '16 avos de Final';
    } else if (rodada === 'Round of 16') {
      rodadaAmigavel = 'Oitavas de Final';
    } else if (rodada === 'Quarter-finals') {
      rodadaAmigavel = 'Quartas de Final';
    } else if (rodada === 'Semi-finals') {
      rodadaAmigavel = 'Semifinal';
    } else if (rodada === 'Match for 3rd place') {
      rodadaAmigavel = 'Decisão do 3º Lugar';
    } else if (rodada === 'Final') {
      rodadaAmigavel = 'Grande Final';
    }

    document.getElementById('ultimo-jogo-placar').innerText = rodadaAmigavel;

    // Exibe palpite do último jogo e pontos conquistados
    if (ultimoPalpiteEl) {
      const meuPalpiteUltimo = palpitesUsuario.find(p => p.match_id === ultimoJogo.fixture.id);
      if (meuPalpiteUltimo) {
        const vencedorReal = ultimoJogo.goals.home > ultimoJogo.goals.away ? 'home' : (ultimoJogo.goals.home < ultimoJogo.goals.away ? 'away' : 'empate');
        const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined') ? distribuicaoPalpitesGrupo[ultimoJogo.fixture.id] : null;
        const pctVencedor = dist ? dist[vencedorReal] : 100;
        const pts = (typeof calcularPontosPalpite === 'function')
          ? calcularPontosPalpite(meuPalpiteUltimo.score_home, meuPalpiteUltimo.score_away, ultimoJogo.goals.home, ultimoJogo.goals.away, ultimoJogo.league.round, pctVencedor)
          : 0;
        ultimoPalpiteEl.innerText = `Palpite: ${meuPalpiteUltimo.score_home}x${meuPalpiteUltimo.score_away} (+${pts} pts)`;
        ultimoPalpiteEl.className = `text-[10px] font-bold px-2.5 py-0.5 rounded-full ${pts > 0 ? 'bg-gold/20 text-gold' : 'bg-zinc-800 text-zinc-500'}`;
      } else {
        ultimoPalpiteEl.innerText = "Sem palpite (0 pts)";
        ultimoPalpiteEl.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-600";
      }
    }
  } else {
    document.getElementById('ultimo-jogo-nome').innerText = 'Nenhum jogo encerrado';
    document.getElementById('ultimo-jogo-placar').innerText = '—';
    if (ultimoPalpiteEl) {
      ultimoPalpiteEl.innerText = '';
      ultimoPalpiteEl.className = 'hidden';
    }
    if (ultimoCard) {
      ultimoCard.style.cursor = 'default';
      ultimoCard.onclick = null;
    }
  }

  // 3. Desafio Ativo do GM
  buscarDesafioAtivoHome();

  // 4. Verifica notificações de desafios resolvidos
  verificarNotificacoesDesafios();
}

async function buscarDesafioAtivoHome() {
  const container = document.getElementById('container-desafios-ativos-gm');
  if (!container || !sbClient || !grupoAtual || !usuarioAtual) {
    if (container) container.classList.add('hidden');
    return;
  }

  try {
    const { data: desafios, error } = await sbClient
      .from('desafios')
      .select('*')
      .eq('status', 'active');

    if (error || !desafios || desafios.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }

    // Filtra desafios que pertencem às partidas carregadas para a liga do grupo atual
    const desafiosAtivosGrupo = desafios.filter(d => todosOsJogos.some(j => j.fixture.id === d.fixture_id));

    if (desafiosAtivosGrupo.length > 0) {
      container.innerHTML = ''; // Limpa o container

      // Busca os votos do usuário logado para todos os desafios ativos de uma vez
      const desafioIds = desafiosAtivosGrupo.map(d => d.id);
      const { data: meusVotos } = await sbClient
        .from('user_desafios')
        .select('desafio_id')
        .in('desafio_id', desafioIds)
        .eq('user_id', usuarioAtual.id)
        .eq('group_id', grupoAtual.id);

      const votosMap = new Set((meusVotos || []).map(v => v.desafio_id));

      desafiosAtivosGrupo.forEach(desafio => {
        const jaVotou = votosMap.has(desafio.id);
        const descTexto = jaVotou 
          ? `${desafio.match_name} - Seu palpite foi registrado!` 
          : `${desafio.match_name} - Participe e ganhe +${desafio.points} pts!`;
        
        const badgeTexto = jaVotou ? 'Ver' : 'Palpitar';
        const badgeClass = jaVotou 
          ? 'text-purple-400 text-[10px] font-black uppercase tracking-widest bg-purple-500/10 px-2.5 py-1.5 rounded-xl border border-purple-500/20' 
          : 'text-purple-400 text-[10px] font-black uppercase tracking-widest bg-purple-500/10 px-2.5 py-1.5 rounded-xl border border-purple-500/20 animate-pulse';

        const cardHtml = `
          <div onclick="if (typeof abrirTelaPalpite === 'function') abrirTelaPalpite(${desafio.fixture_id})" class="bg-gradient-to-r from-purple-650/40 via-purple-650/5 to-transparent p-5 rounded-2xl border border-purple-500/30 transition-all hover:border-purple-500/50 cursor-pointer flex items-center justify-between shadow-[0_0_20px_rgba(139,92,246,0.08)] active:scale-[0.98]">
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-black text-[13px] text-white flex items-center gap-1.5 uppercase tracking-wide truncate">
                  <span>🏆</span> DESAFIO DO GM NO AR!
                </h3>
                <p class="text-[10px] text-zinc-300 mt-0.5 truncate">${descTexto}</p>
              </div>
            </div>
            <span class="${badgeClass} flex-shrink-0 ml-3">${badgeTexto}</span>
          </div>
        `;
        container.innerHTML += cardHtml;
      });

      container.classList.remove('hidden');
    } else {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
  } catch (e) {
    console.error("Erro ao buscar desafios ativos na home do grupo:", e);
    container.innerHTML = '';
    container.classList.add('hidden');
  }
}

function copiarCodigo() {
  if (!grupoAtual || !grupoAtual.invite_code) return;
  const cod = grupoAtual.invite_code;
  navigator.clipboard.writeText(cod).then(() => {
    const btn = document.querySelector('button[onclick="copiarCodigo()"]');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copiado!';
      btn.classList.remove('text-brand-green');
      btn.classList.add('text-white');
      setTimeout(() => {
        btn.innerText = originalText;
        btn.classList.remove('text-white');
        btn.classList.add('text-brand-green');
      }, 2000);
    }
  }).catch(err => {
    console.error("Erro ao copiar código:", err);
  });
}

async function compartilharGrupo() {
  if (!grupoAtual || !grupoAtual.invite_code) return;
  
  const grupoNome = grupoAtual.name || grupoAtual.nome || 'Grupo';
  const codigo = grupoAtual.invite_code;
  
  // Pega dinamicamente a URL de onde o site está rodando
  const origin = window.location.origin + window.location.pathname;
  
  // Se estiver abrindo o arquivo local via file://, usa o domínio de produção como fallback, caso contrário usa a URL atual dinâmica do servidor/Vercel
  const linkApp = origin.startsWith("file://")
    ? "https://bolao-pro-six.vercel.app/?code=" + codigo
    : origin + "?code=" + codigo;

  const textoShare = `⚽ BOLÃO PRO - ${grupoNome} ⚽\n\nFala, craque! 🏟️\nCriei um bolão pra gente competir. Prova que você entende de futebol e entra no meu grupo!\n\n👉 Use o código: ${codigo}\n🔗 ${linkApp}\n\nBora ver quem manja mais? 😏`;

  if (navigator.share) {
    try {
      // NÃO passamos a propriedade 'url' aqui, pois o linkApp já está embutido no 'textoShare'.
      // Isso evita que navegadores (como Safari/Chrome no iOS) dupliquem o link no compartilhamento.
      await navigator.share({
        title: 'Bolão Pro',
        text: textoShare
      });
    } catch (err) {
      console.log('Erro ao compartilhar:', err);
    }
  } else {
    try {
      await navigator.clipboard.writeText(textoShare);
      showToast("Link de convite copiado!", "success");
    } catch (err) {
      console.error('Erro ao copiar:', err);
      showToast(`Código: ${codigo} | Link copiado para transferência!`, "success");
    }
  }
}

async function uploadIcone(event) {
  const file = event.target.files[0];
  if (!file || !grupoAtual) return;

  const spinner = document.getElementById('upload-spinner');
  if (spinner) spinner.classList.remove('hidden');

  const grupoId = grupoAtual.id;
  const filePath = `${grupoId}.jpg`;

  try {
    // 1. Faz o upload para o Storage (upsert para sobrescrever)
    const { error: uploadError } = await sbClient.storage
        .from('grupos-icons')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
      if (spinner) spinner.classList.add('hidden');
      showToast("Erro no upload: " + uploadError.message, "error");
      return;
    }

    // 2. Pega a URL pública
    const { data: { publicUrl } } = sbClient.storage
        .from('grupos-icons')
        .getPublicUrl(filePath);

    if (spinner) spinner.classList.add('hidden');

    showToast("Ícone atualizado com sucesso!", "success");
    
    // Atualiza na interface da Home do Grupo na hora (com cache-buster timestamp)
    const imgEl = document.getElementById('icone-grupo-header');
    const svgEl = document.getElementById('grupo-icon-fallback');
    if (imgEl && svgEl) {
      imgEl.src = publicUrl + "?t=" + Date.now();
      imgEl.onload = function() {
        imgEl.classList.remove('hidden');
        svgEl.classList.add('hidden');
      };
      imgEl.onerror = function() {
        imgEl.src = '';
        imgEl.classList.add('hidden');
        svgEl.classList.remove('hidden');
      };
    }
  } catch (e) {
    console.error("Erro no upload do ícone:", e);
    if (spinner) spinner.classList.add('hidden');
    showToast("Erro no processamento do upload.", "error");
  }
}

async function alterarNomeGrupoPrompt() {
  if (!grupoAtual || !sbClient) return;

  const novoNome = prompt("Digite o novo nome do grupo:", grupoAtual.name || grupoAtual.nome || 'Grupo');
  if (novoNome === null) return; // Clicou em Cancelar
  
  const novoNomeTrimmed = novoNome.trim();
  if (!novoNomeTrimmed) {
    showToast("O nome do grupo não pode ser vazio!", "error");
    return;
  }
  
  if (novoNomeTrimmed === (grupoAtual.name || grupoAtual.nome)) {
    return;
  }
  
  try {
    const { error } = await sbClient
      .from('groups')
      .update({ name: novoNomeTrimmed })
      .eq('id', grupoAtual.id);
      
    if (error) {
      console.error("Erro ao alterar nome do grupo:", error.message);
      showToast("Erro ao alterar nome do grupo. Tente novamente.", "error");
      return;
    }
    
    // Atualiza o estado local
    grupoAtual.name = novoNomeTrimmed;
    grupoAtual.nome = novoNomeTrimmed;
    
    // Atualiza a UI
    const txtNome = document.getElementById('txt-nome-grupo-atual');
    if (txtNome) txtNome.innerText = novoNomeTrimmed;
    
    document.getElementById('nome-grupo').innerText = novoNomeTrimmed;
    const rankingHeader = document.getElementById('nome-grupo-ranking');
    if (rankingHeader) rankingHeader.innerText = novoNomeTrimmed;
    
    showToast("Nome do grupo alterado com sucesso!", "success");
    
    // Atualiza a lista geral de grupos em background
    carregarGrupos();
  } catch (e) {
    console.error(e);
    showToast("Erro ao processar alteração de nome.", "error");
  }
}

async function excluirGrupoReal() {
  if (!grupoAtual || !sbClient) return;
  const isOwner = usuarioAtual && usuarioAtual.id === grupoAtual.owner_id;
  if (!isOwner) {
    showToast("Apenas o criador do grupo pode excluí-lo.", "error");
    return;
  }
  
  if (confirm("ALERTA DE PERIGO! 🚨\nVocê tem certeza que quer excluir o bolão \"" + (grupoAtual.name || grupoAtual.nome || 'Grupo') + "\"? Todos os palpites, pontuações e membros serão permanentemente apagados. ISSO NÃO TEM VOLTA!")) {
    try {
      showToast("Excluindo grupo...", "info");
      const { error } = await sbClient
        .from('groups')
        .delete()
        .eq('id', grupoAtual.id);
        
      if (error) {
        console.error("Erro ao deletar grupo:", error.message);
        showToast("Erro ao excluir o grupo. Tente novamente.", "error");
        return;
      }
      
      showToast("Grupo excluído com sucesso!", "success");
      
      // Reseta estado local
      grupoAtual = null;
      
      // Redireciona para a view de grupos
      switchView('view-grupos');
      carregarGrupos();
    } catch (e) {
      console.error(e);
      showToast("Erro ao processar a exclusão.", "error");
    }
  }
}

async function salvarRegrasGrupoReal() {
  if (!grupoAtual || !sbClient) return;

  const btn = document.getElementById('btn-salvar-regras-grupo');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "SALVANDO...";
  }

  // Captura os valores digitados nos inputs (ou 0 se o checkbox correspondente estiver desmarcado)
  const getRegraVal = (chkId, numId) => {
    const chk = document.getElementById(chkId);
    const num = document.getElementById(numId);
    if (!chk || !num) return 0;
    return chk.checked ? parseInt(num.value) : 0;
  };
  const pt_placar_exato = getRegraVal('chk-pt-placar-exato', 'num-pt-placar-exato');
  const pt_vencedor_gols_time = getRegraVal('chk-pt-vencedor-gols-time', 'num-pt-vencedor-gols-time');
  const pt_empate_nao_exato = getRegraVal('chk-pt-empate-nao-exato', 'num-pt-empate-nao-exato');
  const pt_vencedor_saldo = getRegraVal('chk-pt-vencedor-saldo', 'num-pt-vencedor-saldo');
  const pt_vencedor_gols_perdedor = getRegraVal('chk-pt-vencedor-gols-perdedor', 'num-pt-vencedor-gols-perdedor');
  const pt_apenas_vencedor = getRegraVal('chk-pt-apenas-vencedor', 'num-pt-apenas-vencedor');
  const pt_gols_um_time = getRegraVal('chk-pt-gols-um-time', 'num-pt-gols-um-time');

  // Validação simples
  if (
    isNaN(pt_placar_exato) || isNaN(pt_vencedor_gols_time) || isNaN(pt_empate_nao_exato) ||
    isNaN(pt_vencedor_saldo) || isNaN(pt_vencedor_gols_perdedor) || isNaN(pt_apenas_vencedor) ||
    isNaN(pt_gols_um_time)
  ) {
    showToast("Por favor, preencha todos os campos com números válidos!", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Salvar Regras de Pontuação";
    }
    return;
  }

  showToast("Atualizando regras de pontuação...", "success");

  try {
    const { error } = await sbClient
      .from('groups')
      .update({
        pt_placar_exato,
        pt_vencedor_gols_time,
        pt_empate_nao_exato,
        pt_vencedor_saldo,
        pt_vencedor_gols_perdedor,
        pt_apenas_vencedor,
        pt_gols_um_time
      })
      .eq('id', grupoAtual.id);

    if (error) throw error;

    // Atualiza o estado local em memória
    grupoAtual.pt_placar_exato = pt_placar_exato;
    grupoAtual.pt_vencedor_gols_time = pt_vencedor_gols_time;
    grupoAtual.pt_empate_nao_exato = pt_empate_nao_exato;
    grupoAtual.pt_vencedor_saldo = pt_vencedor_saldo;
    grupoAtual.pt_vencedor_gols_perdedor = pt_vencedor_gols_perdedor;
    grupoAtual.pt_apenas_vencedor = pt_apenas_vencedor;
    grupoAtual.pt_gols_um_time = pt_gols_um_time;

    // Atualiza a persistência local (localStorage) para manter sincronizado no reload
    localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));

    showToast("Regras de pontuação salvas com sucesso!", "success");
  } catch (err) {
    console.error("Erro ao salvar regras:", err.message);
    showToast("Erro ao salvar as regras. Verifique a tabela no Supabase.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Salvar Regras de Pontuação";
    }
  }
}

async function carregarParticipantesGrupo() {
  const container = document.getElementById('lista-participantes-grupo');
  if (!container) return;

  container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Carregando participantes...</p>';

  if (!sbClient || !grupoAtual) {
    container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Nenhum grupo ativo.</p>';
    return;
  }

  try {
    // 1. Busca todos os membros do grupo
    const { data: members, error: errMembers } = await sbClient
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', grupoAtual.id);

    if (errMembers) {
      console.error("Erro ao buscar membros:", errMembers.message);
      container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro ao carregar participantes.</p>';
      return;
    }

    if (!members || members.length === 0) {
      container.innerHTML = '<p class="text-text-muted text-[13px] text-center py-6">Nenhum participante encontrado.</p>';
      return;
    }

    const countTitleEl = document.getElementById('contador-participantes-titulo');
    const activeCount = members.filter(m => m.role !== 'pending').length;
    if (countTitleEl) {
      countTitleEl.innerText = `(${activeCount})`;
    }
    const configQtdUsers = document.getElementById('config-gm-qtd-users');
    if (configQtdUsers) {
      configQtdUsers.innerText = activeCount;
    }

    const userIds = members.map(m => m.user_id);

    // 2. Busca os perfis
    const { data: profiles, error: errProfiles } = await sbClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (errProfiles) {
      console.error("Erro ao buscar perfis:", errProfiles.message);
    }

    // Renderiza a lista
    container.innerHTML = '';
    
    // Ordena para que o dono/admin apareça primeiro
    members.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      return 0;
    });

    const souDono = usuarioAtual && grupoAtual && usuarioAtual.id === grupoAtual.owner_id;
    
    let htmlMembros = '';
    let htmlPendentes = '';
    let pendingCount = 0;

    members.forEach(member => {
      const profile = profiles ? profiles.find(p => p.id === member.user_id) : null;
      const nome = profile ? profile.full_name : 'Participante';
      const foto = (profile && profile.avatar_url) ? profile.avatar_url : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nome) + '&background=10b981&color=fff';
      const isAdmin = member.role === 'owner';
      const isPending = member.role === 'pending';

      if (isPending) {
        if (souDono) {
          pendingCount++;
          htmlPendentes += `
            <div class="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between mb-2">
              <div class="flex items-center gap-3 min-w-0">
                <img src="${foto}" class="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0">
                <div class="min-w-0">
                  <h4 class="font-bold text-[14px] text-white truncate">${nome}</h4>
                  <p class="text-[11px] text-purple-400 font-bold truncate">Solicitou entrar ⏳</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="responderSolicitacaoGrupo('${member.user_id}', true, '${nome.replace(/'/g,"\\'")}')" class="bg-brand-green text-black font-black text-[10px] px-3 py-1.5 rounded-lg active:scale-95 transition-all uppercase tracking-wide">Aceitar</button>
                <button onclick="responderSolicitacaoGrupo('${member.user_id}', false, '${nome.replace(/'/g,"\\'")}')" class="bg-zinc-800 text-red-500 font-black text-[10px] px-3 py-1.5 rounded-lg active:scale-95 transition-all uppercase tracking-wide border border-red-500/10">Recusar</button>
              </div>
            </div>
          `;
        }
      } else {
        const removeBtn = (souDono && !isAdmin) ? `
          <button onclick="removerMembroGrupo('${member.user_id}', '${nome.replace(/'/g,"\\'")}')" class="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 ml-2" title="Remover jogador">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        ` : '';

        htmlMembros += `
          <div class="bg-card-bg/60 rounded-xl p-3 flex items-center justify-between border border-white/5 mb-2">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${foto}" class="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0">
              <div class="min-w-0">
                <h4 class="font-bold text-[14px] text-white truncate">${nome}</h4>
                <p class="text-[11px] text-text-muted truncate">${isAdmin ? 'Organizador do Bolão' : 'Participante'}</p>
              </div>
            </div>
            <div class="flex items-center">
              ${isAdmin ? `
                <span class="border border-brand-green/30 text-brand-green text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-brand-green/5 flex-shrink-0">Admin</span>
              ` : ''}
              ${removeBtn}
            </div>
          </div>
        `;
      }
    });

    let htmlFinal = '';
    if (htmlPendentes) {
      htmlFinal += `
        <div class="mb-4">
          <label class="block text-xs font-black text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <span>⏳</span> Solicitações de Entrada (${pendingCount})
          </label>
          ${htmlPendentes}
        </div>
      `;
    }
    htmlFinal += htmlMembros;
    container.innerHTML = htmlFinal || '<p class="text-text-muted text-[13px] text-center py-6">Nenhum participante encontrado.</p>';

  } catch (err) {
    console.error("Erro em carregarParticipantesGrupo:", err);
    container.innerHTML = '<p class="text-red-400 text-[13px] text-center py-6">Erro no processamento.</p>';
  }
}

async function verificarNotificacoesDesafios() {
  if (!sbClient || !grupoAtual || !usuarioAtual) return;

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

    if (error || !votos) return;

    // Filtra os votos para desafios que estão "resolved" (finalizados pelo GM)
    const votosResolvidos = votos.filter(v => v.desafios && v.desafios.status === 'resolved');

    // Lê a lista de IDs de desafios que o usuário já viu/foi notificado
    let desafiosVistos = [];
    try {
      const vistosStr = localStorage.getItem('desafios_vistos_' + usuarioAtual.id);
      if (vistosStr) {
        desafiosVistos = JSON.parse(vistosStr);
      }
    } catch (e) {
      console.error(e);
    }

    // Identifica quais desafios resolvidos o usuário ainda NÃO viu a notificação
    const pendentesNotificacao = votosResolvidos.filter(v => !desafiosVistos.includes(v.desafio_id));

    if (pendentesNotificacao.length > 0) {
      // Notifica o usuário de cada um (um de cada vez ou todos em popups separados)
      pendentesNotificacao.forEach(voto => {
        const d = voto.desafios;
        const acertou = (voto.points_awarded > 0);
        const perdeu = (voto.points_awarded < 0);
        const pontosInfo = voto.points_awarded;
        const msgPontos = acertou 
          ? `Ganhou +${pontosInfo} pontos! 🎉` 
          : (perdeu ? `Perdeu ${pontosInfo} pontos! ⚠️` : `0 pontos.`);
        
        let resultadoTexto = 'ERROU';
        if (acertou) resultadoTexto = 'ACERTOU';
        else if (perdeu) resultadoTexto = 'ERROU (Com Penalidade)';

        const modalId = 'modal-notif-desafio-' + voto.desafio_id;
        const labelRegra = (typeof traduzirRegraDesafio === 'function') ? traduzirRegraDesafio(d.event_type) : d.event_type;

        // Cria um modal dinâmico no HTML para exibir a notificação
        const modalHtml = `
          <div id="${modalId}" class="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 fade-in">
            <div class="bg-card-bg border border-purple-500/30 rounded-3xl w-full max-w-sm p-6 text-center shadow-[0_0_30px_rgba(139,92,246,0.15)] relative overflow-hidden">
              <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
              
              <div class="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center mb-4 border border-purple-500/20 text-2xl">
                🏆
              </div>
              
              <h3 class="text-lg font-black uppercase text-white mb-1">Resultado do Desafio!</h3>
              <p class="text-[11px] font-bold text-purple-400 uppercase tracking-widest mb-4">Finalizado pelo GM</p>
              
              <div class="bg-black/30 border border-white/5 rounded-2xl p-4 mb-5 text-left space-y-2">
                <p class="text-[12px] text-text-muted">🏟️ Jogo: <strong class="text-white">${d.match_name}</strong></p>
                <p class="text-[12px] text-text-muted">🔥 Regra: <strong class="text-white">${labelRegra}</strong></p>
                <p class="text-[12px] text-text-muted">👉 Seu Voto: <strong class="text-white">${voto.chosen_player}</strong></p>
                <p class="text-[12px] text-text-muted">📊 Resultado: <strong class="${acertou ? 'text-green-400' : (perdeu ? 'text-red-400' : 'text-zinc-400')} font-black">${resultadoTexto}</strong></p>
              </div>

              <div class="text-base font-black text-white mb-6">
                ${msgPontos}
              </div>

              <button onclick="fecharNotificacaoDesafio('${modalId}', '${voto.desafio_id}')" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs py-3.5 rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-purple-600/20">
                Sensacional!
              </button>
            </div>
          </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
      });
    }
  } catch (err) {
    console.error("Erro ao verificar notificações de desafios:", err);
  }
}

function fecharNotificacaoDesafio(modalId, desafioId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();

  // Salva no localStorage que o usuário já viu
  if (usuarioAtual) {
    let desafiosVistos = [];
    const vistosStr = localStorage.getItem('desafios_vistos_' + usuarioAtual.id);
    if (vistosStr) {
      try {
        desafiosVistos = JSON.parse(vistosStr);
      } catch (e) {}
    }
    if (!desafiosVistos.includes(desafioId)) {
      desafiosVistos.push(desafioId);
      localStorage.setItem('desafios_vistos_' + usuarioAtual.id, JSON.stringify(desafiosVistos));
    }
  }
}

async function checarLimiteGruposUsuario() {
  if (!usuarioAtual) return true;
  try {
    // 1. Conta em quantos grupos o usuário logado já participa
    const { count: totalGruposUsuario, error: countUserError } = await sbClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', usuarioAtual.id);

    if (countUserError) {
      console.error("Erro ao contar grupos do usuário:", countUserError);
      return true; // Evita travar a entrada caso o Supabase dê falha temporária
    }

    // 2. Descobre qual é o limite do jogador (buscando na tabela profiles)
    const { data: perfilData, error: perfilError } = await sbClient
      .from('profiles')
      .select('max_grupos')
      .eq('id', usuarioAtual.id)
      .single();

    const limiteDoJogador = perfilData?.max_grupos || 1; // Se der erro ou for nulo, assume 1

    // 3. Se ele já esgotou a cota, bloqueia a entrada e abre o modal do Passe Livre.
    if (totalGruposUsuario >= limiteDoJogador) {
      if (typeof abrirModalPasseLivre === 'function') {
        abrirModalPasseLivre();
      } else {
        showToast("Você atingiu o limite de grupos permitidos no seu plano.", "error");
      }
      return false; // Bloqueado!
    }
    return true; // Autorizado!
  } catch (err) {
    console.error("Erro ao verificar limite de grupos do usuário:", err);
    return true;
  }
}

// ==================== SISTEMA DE TESOURARIA ====================

// 1. Abre o Modal e carrega o status do dinheiro
async function abrirTesouraria() {
  const modal = document.getElementById('modal-tesouraria');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  await carregarDadosTesouraria();
}

function fecharTesouraria() {
  const modal = document.getElementById('modal-tesouraria');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Variável global para guardar os potes carregados e evitar chamar o banco à toa
let potesTesourariaAtivos = []; 

async function carregarDadosTesouraria() {
  const container = document.getElementById('tesouraria-content');
  container.innerHTML = '<p class="text-center text-gray-400 py-4 animate-pulse">Abrindo os cofres...</p>';

  // 1. Busca todos os potes abertos
  const { data: potes, error } = await sbClient
    .from('potes')
    .select('*')
    .eq('group_id', grupoAtual.id)
    .eq('status', 'aberto')
    .order('created_at', { ascending: false });

  potesTesourariaAtivos = potes || [];

  // 2. Interface Base (Sempre mostra o botão de criar um novo)
  let htmlBase = `
    <div class="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
      <h3 class="text-white font-bold text-sm">Suas Disputas Ativas</h3>
      <button onclick="mostrarFormularioNovoPote()" class="bg-brand-green/20 text-brand-green border border-brand-green hover:bg-brand-green text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1">
        <span>➕</span> Novo Pote
      </button>
    </div>
  `;

  // Onde o formulário de criação vai aparecer quando clicar no botão acima
  htmlBase += `<div id="tesouraria-novo-pote-area" class="hidden mb-6 p-4 bg-black/50 border border-brand-green/30 rounded-xl"></div>`;

  if (potesTesourariaAtivos.length === 0) {
    htmlBase += `<p class="text-sm text-gray-400 text-center py-6">Nenhum pote ativo. Crie um novo para arrecadar!</p>`;
    container.innerHTML = htmlBase;
  } else {
    // 3. Monta o Seletor de Potes (Dropdown) e Botão de Compartilhar
    let seletorHTML = `
      <div class="mb-5">
        <label class="text-[10px] text-text-muted font-black tracking-widest uppercase mb-1 block">Selecione o Pote para Gerenciar</label>
        <div class="flex gap-2">
          <select id="seletor-potes-gm" onchange="trocarPoteGerenciado()" class="flex-1 bg-[#151518] border border-brand-green/30 rounded-xl p-3 text-white focus:border-brand-green outline-none appearance-none font-bold text-xs">
    `;
    
    potesTesourariaAtivos.forEach(p => {
      seletorHTML += `<option value="${p.id}">${p.nome} - R$ ${parseFloat(p.valor_entrada).toFixed(2)}</option>`;
    });
    
    seletorHTML += `
          </select>
          <button onclick="compartilharListaPoteWhatsApp()" class="bg-brand-green hover:opacity-90 text-black px-4 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,163,0.2)]">
            <span>📋</span> WhatsApp
          </button>
        </div>
      </div>
    `;
    
    // Div onde a lista de quem pagou vai ser desenhada
    seletorHTML += `<div id="tesouraria-lista-participantes"></div>`;
    
    container.innerHTML = htmlBase + seletorHTML;
    
    // Força carregar a lista do primeiro pote do dropdown
    trocarPoteGerenciado(); 
  }
}

// Quando o GM troca o Dropdown
async function trocarPoteGerenciado() {
  const select = document.getElementById('seletor-potes-gm');
  if(!select) return;
  const poteId = select.value;
  const poteSelecionado = potesTesourariaAtivos.find(p => p.id === poteId);
  
  const containerLista = document.getElementById('tesouraria-lista-participantes');
  containerLista.innerHTML = '<p class="text-xs text-gray-500 text-center py-2">Buscando PIXs...</p>';

  // 1. Busca os participantes deste pote
  const { data: participantes, error: erroPart } = await sbClient
    .from('potes_participantes')
    .select('*')
    .eq('pote_id', poteId);

  let listaHTML = '';
  let arrecadado = 0;

  if (erroPart || !participantes || participantes.length === 0) {
    listaHTML = '<p class="text-[11px] text-gray-500 text-center py-4 bg-black/30 rounded-lg border border-white/5">Ninguém entrou nesta disputa ainda.</p>';
  } else {
    // 2. Busca os perfis deles
    const userIds = participantes.map(p => p.user_id);
    const { data: profiles } = await sbClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    participantes.forEach(part => {
      const p = profiles ? profiles.find(prof => prof.id === part.user_id) : null;
      const nomeUser = p ? (p.full_name || 'Jogador Misterioso') : 'Jogador Misterioso';
      const avatarUrl = p ? p.avatar_url : null;
      const isPago = part.status_pagamento === 'pago';
      
      if (isPago) arrecadado += parseFloat(poteSelecionado.valor_entrada);

      listaHTML += `
        <div class="flex items-center justify-between p-2 bg-black/40 border border-white/5 rounded-lg mb-2 ${isPago ? 'border-brand-green/30' : 'border-orange-500/30'}">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center text-xs">
               ${avatarUrl ? `<img src="${avatarUrl}" class="w-full h-full object-cover">` : '⚽'}
            </div>
            <div>
              <p class="text-white text-xs font-bold">${nomeUser}</p>
              <p class="text-[9px] uppercase tracking-widest ${isPago ? 'text-brand-green' : 'text-orange-500'}">
                ${isPago ? '✅ PAGO' : '⏳ PENDENTE'}
              </p>
            </div>
          </div>
          ${!isPago ? 
            `<button onclick="aprovarPagamentoPote('${part.id}')" class="bg-brand-green/20 text-brand-green hover:bg-brand-green text-black border border-brand-green px-3 py-1 rounded text-[10px] font-black uppercase transition-all">Aprovar</button>` : 
            `<button onclick="desfazerPagamentoPote('${part.id}')" class="text-gray-500 hover:text-red-500 text-xs px-2">✖</button>`
          }
        </div>
      `;
    });
  }

  containerLista.innerHTML = `
    <div class="flex justify-between items-end mb-3 mt-2 px-1">
      <span class="text-xs text-gray-400">Total Arrecadado:</span>
      <span class="text-brand-green font-black text-lg">R$ ${arrecadado.toFixed(2)}</span>
    </div>
    <div class="max-h-56 overflow-y-auto pr-1 space-y-1 mb-4 hide-scrollbar">
      ${listaHTML}
    </div>
    <button onclick="encerrarPoteAtual('${poteSelecionado.id}')" class="w-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all">
      ⚠️ Encerrar Este Pote
    </button>
  `;
}

// Mostra o formulário de criar pote na mesma tela
function mostrarFormularioNovoPote() {
  const div = document.getElementById('tesouraria-novo-pote-area');
  if(!div) return;
  div.classList.remove('hidden');
  div.innerHTML = `
    <p class="text-xs text-white font-bold mb-3 border-b border-white/10 pb-2">Lançar Nova Disputa</p>
    <div class="space-y-3">
      <input type="text" id="novo-pote-nome" placeholder="Nome (Ex: Prêmio do Brasileirão)" class="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-white focus:border-brand-green outline-none text-xs">
      <input type="number" id="novo-pote-valor" placeholder="Valor da Entrada (R$)" class="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-white focus:border-brand-green outline-none text-xs">
      <input type="text" id="novo-pote-pix" placeholder="Sua Chave PIX" class="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-white focus:border-brand-green outline-none text-xs">
      
      <!-- NOVA OPÇÃO: MARCAR COMO GERAL -->
      <div class="flex items-center gap-2 mt-2 bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-lg">
        <input type="checkbox" id="novo-pote-geral" class="w-4 h-4 accent-yellow-500">
        <label for="novo-pote-geral" class="text-[10px] text-yellow-500 uppercase tracking-widest font-black cursor-pointer">Definir como Prêmio Geral (Fixo no Topo)</label>
      </div>

      <div class="flex gap-2 pt-1">
        <button onclick="document.getElementById('tesouraria-novo-pote-area').classList.add('hidden')" class="w-1/3 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-[10px] uppercase transition-all">Cancelar</button>
        <button onclick="lancarPote()" class="w-2/3 bg-brand-green hover:bg-green-500 text-black font-black py-2.5 rounded-lg text-[10px] uppercase transition-all shadow-[0_0_15px_rgba(0,255,100,0.4)]">Lançar Pote</button>
      </div>
    </div>
  `;
}

// 3. Salva o Pote no Banco de Dados
async function lancarPote() {
  const nome = document.getElementById('novo-pote-nome').value;
  const valor = document.getElementById('novo-pote-valor').value;
  const pix = document.getElementById('novo-pote-pix').value;
  const isGeral = document.getElementById('novo-pote-geral').checked; // Lê o checkbox

  if (!nome || !valor || !pix) {
    showToast("Preencha todos os campos do Pote!", "error");
    return;
  }

  showToast("Construindo o cofre...", "success");

  const { error } = await sbClient.from('potes').insert([{
    group_id: grupoAtual.id,
    nome: nome,
    valor_entrada: parseFloat(valor),
    chave_pix_gm: pix,
    status: 'aberto',
    is_geral: isGeral // Salva no banco se é o geral ou não
  }]);

  if (error) {
    console.error("Erro no Supabase:", error);
    showToast("Erro ao lançar o Pote. Tente novamente.", "error");
  } else {
    showToast("Pote Lançado!", "success");
    
    // Dispara a notificação de novo pote lançado para o grupo
    if (typeof dispararNotificacaoPush === 'function' && grupoAtual) {
      dispararNotificacaoPush({
        groupId: grupoAtual.id,
        title: '💰 Novo Pote no ar!',
        body: `Novo Pote: "${nome}"! O prêmio já está acumulando. Vai ficar de fora?`,
        url: '/'
      });
    }
    
    document.getElementById('tesouraria-novo-pote-area').classList.add('hidden');
    carregarDadosTesouraria();
    if(typeof carregarPoteBanner === 'function') carregarPoteBanner();
  }
}

// ==================== AÇÕES DO GM NA TESOURARIA ====================

// GM clica para dizer que o PIX do cara caiu
async function aprovarPagamentoPote(participanteId) {
  showToast("Aprovando...", "success");
  
  // Busca o user_id e pote_id antes de atualizar o status
  const { data: partData } = await sbClient
    .from('potes_participantes')
    .select('user_id, pote_id')
    .eq('id', participanteId)
    .single();

  let targetUserId = null;
  let poteNome = 'Disputa';

  if (partData) {
    targetUserId = partData.user_id;
    const { data: poteData } = await sbClient
      .from('potes')
      .select('nome')
      .eq('id', partData.pote_id)
      .single();
    if (poteData) {
      poteNome = poteData.nome;
    }
  }
  
  const { error } = await sbClient
    .from('potes_participantes')
    .update({ status_pagamento: 'pago' })
    .eq('id', participanteId);

  if (error) {
    showToast("Erro ao aprovar.", "error");
  } else {
    // Dispara a notificação de confirmação para o jogador
    if (targetUserId && typeof dispararNotificacaoPush === 'function') {
      dispararNotificacaoPush({
        userId: targetUserId,
        title: '✅ PIX Confirmado!',
        body: `Sua vaga na disputa "${poteNome}" está garantida. Boa sorte!`,
        url: '/'
      });
    }

    // Recarrega a Tesouraria e também o Banner Dourado que fica no fundo!
    await carregarDadosTesouraria();
    if(typeof carregarPoteBanner === 'function') carregarPoteBanner();
  }
}

// Caso o GM tenha clicado sem querer
async function desfazerPagamentoPote(participanteId) {
  const { error } = await sbClient
    .from('potes_participantes')
    .update({ status_pagamento: 'pendente' })
    .eq('id', participanteId);

  if (!error) {
    await carregarDadosTesouraria();
    if(typeof carregarPoteBanner === 'function') carregarPoteBanner();
  }
}

// ==================== COROANDO O CAMPEÃO (AÇÃO DO GM) ====================

async function encerrarPoteAtual(poteId) {
  // 1. Puxa só a galera que PAGOU para ser selecionada
  const { data: pagantes, error: erroPag } = await sbClient
    .from('potes_participantes')
    .select('*')
    .eq('pote_id', poteId)
    .eq('status_pagamento', 'pago');

  if (erroPag || !pagantes || pagantes.length === 0) {
    if(confirm("Ninguém pagou neste pote. Deseja cancelar e encerrar mesmo assim?")) {
      await sbClient.from('potes').update({ status: 'encerrado' }).eq('id', poteId);
      trocarPoteGerenciado(); // Recarrega a tela
    }
    return;
  }

  // Busca os perfis de quem pagou
  const userIds = pagantes.map(p => p.user_id);
  const { data: profiles } = await sbClient
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  // 2. Monta o seletor de jogadores para o GM escolher o vencedor
  let opcoesHTML = '<option value="" disabled selected>Selecione o Campeão...</option>';
  pagantes.forEach(p => {
    const prof = profiles ? profiles.find(pr => pr.id === p.user_id) : null;
    const nome = prof ? (prof.full_name || 'Jogador') : 'Jogador';
    const id = p.user_id;
    opcoesHTML += `<option value="${id}">🏆 ${nome}</option>`;
  });

  const divLista = document.getElementById('tesouraria-lista-participantes');
  divLista.innerHTML = `
    <div class="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl mt-4 text-center animate-fade-in shadow-[0_0_20px_rgba(234,179,8,0.2)]">
      <span class="text-4xl mb-2 block drop-shadow-md">👑</span>
      <h4 class="text-white font-black text-sm uppercase tracking-widest mb-3">Quem venceu a disputa?</h4>
      
      <select id="select-vencedor" class="w-full bg-black/80 border border-yellow-500/40 rounded-lg p-3 text-white mb-4 text-xs font-bold outline-none">
        ${opcoesHTML}
      </select>
      
      <div class="flex gap-2">
        <button onclick="trocarPoteGerenciado()" class="w-1/3 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg text-[10px] uppercase transition-all">Voltar</button>
        <button onclick="confirmarVencedor('${poteId}')" class="w-2/3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:opacity-90 text-black font-black py-3 rounded-lg text-[10px] uppercase transition-all shadow-lg">Coroar Campeão</button>
      </div>
    </div>
  `;
}

// 3. Salva o vencedor no banco e finaliza o pote
async function confirmarVencedor(poteId) {
  const vencedorId = document.getElementById('select-vencedor').value;
  if(!vencedorId) {
    showToast("Selecione um vencedor na lista!", "error");
    return;
  }

  showToast("Coroando campeão...", "success");

  // Busca informações do pote e do campeão para a notificação
  const { data: poteData } = await sbClient
    .from('potes')
    .select('nome, valor_entrada, group_id')
    .eq('id', poteId)
    .single();

  const { data: profileData } = await sbClient
    .from('profiles')
    .select('full_name')
    .eq('id', vencedorId)
    .single();

  const { data: pagantes } = await sbClient
    .from('potes_participantes')
    .select('id')
    .eq('pote_id', poteId)
    .eq('status_pagamento', 'pago');

  let winnerName = 'Um jogador';
  if (profileData) {
    winnerName = profileData.full_name;
  }

  let premio = 0;
  if (poteData && pagantes) {
    premio = pagantes.length * parseFloat(poteData.valor_entrada);
  }

  const { error } = await sbClient
    .from('potes')
    .update({ status: 'encerrado', vencedor_id: vencedorId })
    .eq('id', poteId);

  if(!error) {
    showToast("Disputa Encerrada! O Campeão foi notificado.", "success");
    
    // Dispara a notificação de coroação para o grupo todo!
    if (poteData && typeof dispararNotificacaoPush === 'function') {
      dispararNotificacaoPush({
        groupId: poteData.group_id,
        title: '👑 Temos um campeão!',
        body: `${winnerName} acabou de faturar R$ ${premio.toFixed(2)} no pote "${poteData.nome}". Veja a classificação final!`,
        url: '/'
      });
    }

    fecharTesouraria();
    if(typeof carregarPoteBanner === 'function') carregarPoteBanner();
    if(typeof verificarPremiosGanhos === 'function') verificarPremiosGanhos(); // Checa se o GM mesmo ganhou
  }
}

async function carregarPoteBanner() {
  // Limpa o que já estava na tela
  const containerAntigo = document.getElementById('potes-master-container');
  if(containerAntigo) containerAntigo.remove();

  const containerFixo = document.getElementById('pote-banner-container');
  if (containerFixo) containerFixo.innerHTML = '';

  if (!grupoAtual || !usuarioAtual) return;

  // ==================== VERIFICAÇÃO DE VITÓRIA ====================
  // Busca se o usuário ganhou algum pote que já foi encerrado
  const { data: potesVencidos } = await sbClient
    .from('potes')
    .select('*')
    .eq('group_id', grupoAtual.id)
    .eq('status', 'encerrado')
    .eq('vencedor_id', usuarioAtual.id);

  let vitoriasHTML = '';

  if (potesVencidos && potesVencidos.length > 0) {
    // Busca os participantes desses potes vencidos para calcular o prêmio
    const vencidosIds = potesVencidos.map(p => p.id);
    const { data: partsVencidos } = await sbClient
      .from('potes_participantes')
      .select('*')
      .in('pote_id', vencidosIds);

    potesVencidos.forEach(poteGanho => {
      // Se o usuário já dispensou este card localmente, pula a renderização
      if (localStorage.getItem('pote_resgatado_' + poteGanho.id) === 'true') return;

      const partsPote = partsVencidos ? partsVencidos.filter(p => p.pote_id === poteGanho.id) : [];
      const qtdPagantes = partsPote.filter(p => p.status_pagamento === 'pago').length;
      const premio = qtdPagantes * parseFloat(poteGanho.valor_entrada);

      vitoriasHTML += `
        <div id="card-vitoria-${poteGanho.id}" class="bg-gradient-to-br from-green-600 to-brand-green border border-white/30 rounded-2xl p-5 flex flex-col items-center text-center shadow-[0_0_40px_rgba(0,255,100,0.3)] mb-4 relative overflow-hidden transform hover:scale-[1.02] transition-all">
          <div class="absolute -left-4 -top-4 text-7xl opacity-20">🏆</div>
          <div class="absolute -right-4 -bottom-4 text-7xl opacity-20">💸</div>
          
          <!-- Botão fechar no canto superior direito -->
          <button onclick="dispensarCardVitoria('${poteGanho.id}')" class="absolute top-3 right-3 z-30 bg-black/10 hover:bg-black/30 text-green-950 hover:text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-all" aria-label="Fechar">✕</button>
          
          <span class="text-black bg-white/30 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-2 relative z-10 backdrop-blur-sm border border-white/20">
            Você Venceu: ${poteGanho.nome}
          </span>
          <h2 class="text-4xl font-black text-black mb-1 relative z-10 drop-shadow-md">R$ ${premio.toFixed(2)}</h2>
          <p class="text-[10px] text-green-900 font-bold uppercase tracking-widest mb-4 relative z-10">O dinheiro é seu!</p>
          
          <button onclick="resgatarPremio('${poteGanho.nome}', ${premio})" class="w-full bg-black text-brand-green hover:bg-gray-900 font-black py-3.5 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all relative z-10 shadow-[0_10px_20px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
            Cobrar no WhatsApp
          </button>
        </div>
      `;
    });
  }

  // 1. Busca TODOS os potes abertos do grupo
  const { data: potes, error: erroPotes } = await sbClient
    .from('potes')
    .select('*')
    .eq('group_id', grupoAtual.id)
    .eq('status', 'aberto');

  if ((erroPotes || !potes || potes.length === 0) && !vitoriasHTML) return;

  let masterHTML = vitoriasHTML + '<div id="potes-master-container" class="my-4 flex flex-col gap-3">';

  if (potes && potes.length > 0) {
    // Busca quem pagou de uma vez só
    const potesIds = potes.map(p => p.id);
    const { data: participantes } = await sbClient
      .from('potes_participantes')
      .select('*')
      .in('pote_id', potesIds);

    // SEPARA O JOIO DO TRIGO: Acha qual é o Pote Geral e quais são os Potes de Rodada
    const poteGeral = potes.find(p => p.is_geral === true);
    const potesRodada = potes.filter(p => p.is_geral === false);

    // 1. DESENHA O POTE GERAL (Fixo, Elegante e Sempre Visível)
    if (poteGeral) {
      const partsPote = participantes ? participantes.filter(p => p.pote_id === poteGeral.id) : [];
      const qtdPagantes = partsPote.filter(p => p.status_pagamento === 'pago').length;
      const valorAcumulado = qtdPagantes * parseFloat(poteGeral.valor_entrada);
      const meuStatus = partsPote.find(p => p.user_id === usuarioAtual.id);

      let botaoGeral = '';
      if (!meuStatus) {
         botaoGeral = `<button onclick="entrarNoPote('${poteGeral.id}', '${poteGeral.chave_pix_gm}', ${poteGeral.valor_entrada})" class="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 text-black px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-[0_0_15px_rgba(234,179,8,0.4)] active:scale-95 whitespace-nowrap">Entrar (R$ ${poteGeral.valor_entrada.toFixed(2)})</button>`;
      } else if (meuStatus.status_pagamento === 'pendente') {
         botaoGeral = `<button onclick="verChavePix('${poteGeral.chave_pix_gm}', ${poteGeral.valor_entrada})" class="bg-orange-600/20 text-orange-500 border border-orange-500 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase active:scale-95 whitespace-nowrap">⏳ Pendente</button>`;
      } else {
         botaoGeral = `<div class="bg-brand-green/20 text-brand-green border border-brand-green/50 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap">✅ Confirmado</div>`;
      }

      masterHTML += `
        <div class="bg-gradient-to-r from-yellow-900/30 to-black border border-yellow-500/50 rounded-xl p-3 flex justify-between items-center shadow-[0_0_15px_rgba(234,179,8,0.1)]">
          <div class="flex items-center gap-3">
            <span class="text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">🏆</span>
            <div class="flex flex-col">
              <span class="text-yellow-500 text-[9px] font-black uppercase tracking-widest">${poteGeral.nome}</span>
              <span class="text-white font-black text-xl leading-tight">R$ ${valorAcumulado.toFixed(2)}</span>
            </div>
          </div>
          <div>${botaoGeral}</div>
        </div>
      `;
    }

    // 2. DESENHA O CARROSSEL (Potes das Rodadas)
    if (potesRodada.length > 0) {
      masterHTML += `<div class="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 hide-scrollbar" style="scrollbar-width: none;">`;
      
      potesRodada.forEach(pote => {
        const partsPote = participantes ? participantes.filter(p => p.pote_id === pote.id) : [];
        const qtdPagantes = partsPote.filter(p => p.status_pagamento === 'pago').length;
        const valorAcumulado = qtdPagantes * parseFloat(pote.valor_entrada);
        const meuStatus = partsPote.find(p => p.user_id === usuarioAtual.id);

        let botaoHTML = '';
        if (!meuStatus) {
          botaoHTML = `<button onclick="entrarNoPote('${pote.id}', '${pote.chave_pix_gm}', ${pote.valor_entrada})" class="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black py-2.5 rounded-xl text-[10px] uppercase shadow-[0_0_10px_rgba(234,179,8,0.2)] active:scale-95">🔥 Entrar (R$ ${pote.valor_entrada.toFixed(2)})</button>`;
        } else if (meuStatus.status_pagamento === 'pendente') {
          botaoHTML = `<button onclick="verChavePix('${pote.chave_pix_gm}', ${pote.valor_entrada})" class="w-full bg-orange-600/20 text-orange-500 border border-orange-500 font-black py-2.5 rounded-xl text-[10px] uppercase active:scale-95">⏳ Pendente</button>`;
        } else {
          botaoHTML = `<div class="w-full bg-brand-green/10 text-brand-green border border-brand-green/30 font-black py-2.5 rounded-xl text-[10px] uppercase text-center">✅ Confirmado</div>`;
        }

        masterHTML += `
          <div class="min-w-[75%] sm:min-w-[250px] snap-center bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col items-center text-center flex-shrink-0">
            <span class="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">${pote.nome}</span>
            <h2 class="text-2xl font-black text-white mb-3">R$ ${valorAcumulado.toFixed(2)}</h2>
            ${botaoHTML}
          </div>
        `;
      });
      
      masterHTML += `</div>`;
    }
  }

  masterHTML += `</div>`;

  if (containerFixo) {
    containerFixo.innerHTML = masterHTML;
  } else {
    const headerContainer = document.getElementById('group-header-info');
    if (headerContainer) headerContainer.insertAdjacentHTML('afterend', masterHTML);
  }
}

async function entrarNoPote(poteId, chavePixGm, valor) {
  showToast("Separando sua vaga...", "success");

  // Insere o cara no banco como 'pendente'
  const { error } = await sbClient.from('potes_participantes').insert([{
    pote_id: poteId,
    user_id: usuarioAtual.id,
    status_pagamento: 'pendente'
  }]);

  if (error) {
    showToast("Erro ao entrar. Tente de novo.", "error");
    return;
  }

  // Já recarrega o banner para trocar o botão e abre a chave pra ele pagar
  await carregarPoteBanner();
  verChavePix(chavePixGm, valor);
}

function verChavePix(chavePix, valor) {
  alert(`Envie o PIX de R$ ${parseFloat(valor).toFixed(2)} para a chave:\n\n${chavePix}\n\nAperte OK para copiar a chave e envie o comprovante para o Administrador!`);
  
  // Copia pro teclado do celular
  navigator.clipboard.writeText(chavePix);
  showToast("Chave PIX copiada! Envie o comprovante ao GM.", "success");
}

// ==================== INTEGRAÇÃO WHATSAPP ====================

function resgatarPremio(nomePote, valor) {
  // Pede a chave PIX usando o prompt nativo (simples e direto)
  const chavePix = prompt(`🏆 Parabéns Campeão!\n\nPara receber seus R$ ${valor.toFixed(2)}, digite sua Chave PIX abaixo:`);
  
  // Se o cara cancelar ou deixar em branco, não faz nada
  if (!chavePix) return;

  // Monta a mensagem persuasiva
  const texto = `Fala Mago! 🪄 Fui o campeão da disputa *${nomePote}*!\n\n💰 Meu prêmio: *R$ ${valor.toFixed(2)}*\n🔑 Minha Chave PIX é: *${chavePix}*\n\nAguardando o pix cair na conta pra comemorar! 🍻`;
  
  // O truque da URL: api.whatsapp sem número fixo abre a lista de contatos do cara para ele escolher o grupo ou o GM!
  const urlBase = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto);
  
  // Abre direto (no celular, isso abre o App do WhatsApp na hora sem ser bloqueado por popup)
  window.location.href = urlBase;
}

function dispensarCardVitoria(poteId) {
  localStorage.setItem('pote_resgatado_' + poteId, 'true');
  const card = document.getElementById('card-vitoria-' + poteId);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      card.remove();
      carregarPoteBanner();
    }, 300);
  }
}

async function removerMembroGrupo(userId, userName) {
  if (!confirm(`Deseja realmente remover o jogador "${userName}" deste grupo?`)) {
    return;
  }

  showToast(`Removendo ${userName}...`, "success");

  try {
    // 1. Remove da tabela group_members
    const { error: errM } = await sbClient
      .from('group_members')
      .delete()
      .eq('group_id', grupoAtual.id)
      .eq('user_id', userId);

    if (errM) throw errM;

    // 2. Remove palpites deste usuário no grupo
    await sbClient
      .from('guesses')
      .delete()
      .eq('group_id', grupoAtual.id)
      .eq('user_id', userId);

    showToast("Jogador removido com sucesso!", "success");
    
    // 3. Recarrega dados na tela
    carregarParticipantesGrupo();
    if (typeof atualizarBadgeVagas === 'function') {
      atualizarBadgeVagas(grupoAtual.id);
    }
  } catch (err) {
    console.error("Erro ao remover jogador:", err.message);
    showToast("Erro ao remover jogador. Tente novamente.", "error");
  }
}

async function alterarPrivacidadeGrupoReal() {
  if (!grupoAtual || !sbClient) return;

  const chk = document.getElementById('chk-grupo-privado');
  if (!chk) return;

  const novoEstado = chk.checked;
  showToast(novoEstado ? "Privando o grupo..." : "Tornando o grupo público...", "success");

  try {
    const { error } = await sbClient
      .from('groups')
      .update({ privado: novoEstado })
      .eq('id', grupoAtual.id);

    if (error) throw error;

    grupoAtual.privado = novoEstado;
    localStorage.setItem('last_active_group', JSON.stringify(grupoAtual));
    showToast(novoEstado ? "Grupo agora é privado!" : "Grupo agora é público!", "success");
  } catch (err) {
    console.error("Erro ao alterar privacidade do grupo:", err.message);
    showToast("Erro ao alterar privacidade. Verifique as colunas do banco.", "error");
    chk.checked = !novoEstado; // Reverte o checkbox na tela se falhar
  }
}

async function responderSolicitacaoGrupo(userId, aceitar, userName) {
  if (!confirm(`Deseja realmente ${aceitar ? 'aceitar' : 'recusar'} a entrada de "${userName}"?`)) {
    return;
  }

  showToast(aceitar ? "Aprovando entrada..." : "Recusando entrada...", "success");

  try {
    if (aceitar) {
      // 1. Atualiza role para member
      const { error } = await sbClient
        .from('group_members')
        .update({ role: 'member' })
        .eq('group_id', grupoAtual.id)
        .eq('user_id', userId);

      if (error) throw error;
      showToast(`${userName} entrou no grupo!`, "success");
    } else {
      // 2. Remove o registro
      const { error } = await sbClient
        .from('group_members')
        .delete()
        .eq('group_id', grupoAtual.id)
        .eq('user_id', userId);

      if (error) throw error;
      showToast("Solicitação recusada.", "success");
    }

    // Recarrega participantes e vagas
    carregarParticipantesGrupo();
    if (typeof atualizarBadgeVagas === 'function') {
      atualizarBadgeVagas(grupoAtual.id);
    }
  } catch (err) {
    console.error("Erro ao responder solicitação:", err.message);
    showToast("Erro ao processar solicitação. Tente novamente.", "error");
  }
}

function copiarTextoParaClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text);
  }
  
  // Fallback legível e funcional em qualquer navegador/ambiente (incluindo HTTP e webviews)
  return new Promise((resolve, reject) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        resolve();
      } else {
        reject(new Error("Falha ao copiar com execCommand"));
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function compartilharListaPoteWhatsApp() {
  const select = document.getElementById('seletor-potes-gm');
  if (!select) return;
  const poteId = select.value;
  const poteSelecionado = potesTesourariaAtivos.find(p => p.id === poteId);
  if (!poteSelecionado) return;

  showToast("Gerando lista para copiar...", "info");

  try {
    // 1. Busca os participantes deste pote
    const { data: participantes, error: erroPart } = await sbClient
      .from('potes_participantes')
      .select('*')
      .eq('pote_id', poteId);

    if (erroPart) {
      showToast("Erro ao carregar participantes.", "error");
      return;
    }

    let pagos = [];
    let pendentes = [];

    if (participantes && participantes.length > 0) {
      const userIds = participantes.map(p => p.user_id);
      const { data: profiles } = await sbClient
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      participantes.forEach(part => {
        const prof = profiles ? profiles.find(p => p.id === part.user_id) : null;
        const nome = prof ? (prof.full_name || 'Jogador') : 'Jogador';
        const isPago = part.status_pagamento === 'pago';
        if (isPago) {
          pagos.push(nome);
        } else {
          pendentes.push(nome);
        }
      });
    }

    const valorEntrada = parseFloat(poteSelecionado.valor_entrada);
    const totalAcumulado = pagos.length * valorEntrada;
    const nomeGrupo = grupoAtual.name || grupoAtual.nome || 'Grupo';

    // Gerando o texto do template com base no grupo atual
    let texto = `⚽ BOLÃO DO ${nomeGrupo.toUpperCase()} 💰\n\n`;
    texto += `🏆 Pote: ${poteSelecionado.nome}\n`;
    texto += `📍 Valor: R$ ${valorEntrada.toFixed(2)} por pessoa\n`;
    texto += `💵 Pote Acumulado: R$ ${totalAcumulado.toFixed(2)} (O bicho tá pegando!) 🔥\n\n`;

    texto += `✅ JÁ GARANTIRAM A VAGA\n`;
    if (pagos.length > 0) {
      pagos.forEach(p => {
        texto += `✔️ ${p}\n`;
      });
    } else {
      texto += `(Nenhum confirmado ainda)\n`;
    }

    texto += `\n⚠️ ATENÇÃO PARA OS PENDENTES ⚠️\n`;
    if (pendentes.length > 0) {
      texto += `❌ ${pendentes.join(', ')}\n`;
    } else {
      texto += `(Nenhum pendente)\n`;
    }

    // Link do App
    const origin = window.location.origin + window.location.pathname;
    const linkApp = origin.startsWith("file://")
      ? "https://bolao-pro-six.vercel.app/?code=" + grupoAtual.invite_code
      : origin + "?code=" + grupoAtual.invite_code;

    texto += `\nO esquema agora é 100% pelo nosso aplicativo VIP! Para a sua vaga ser confirmada e você disputar o prêmio, siga os passos:\n\n`;
    texto += `1️⃣ Acesse o app:\n🔗 ${linkApp}\n`;
    texto += `2️⃣ Crie sua conta rapidão.\n`;
    texto += `3️⃣ Acesse o nosso grupo.\n`;
    texto += `4️⃣ Clique no banner dourado gigante "🔥 ENTRAR NA DISPUTA (R$ ${valorEntrada.toFixed(2)})".\n`;
    texto += `5️⃣ Copie a chave PIX lá no app, faça o pagamento, e o sistema já me avisa para eu aprovar sua entrada!\n\n`;
    texto += `Bora que o bicho vai pegar! 🚀💸`;

    // Tenta usar compartilhamento nativo. Se der erro (ex: cancelado ou sem suporte real), faz o fallback para cópia
    let compartilhado = false;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lista do Pote - ${poteSelecionado.nome}`,
          text: texto
        });
        compartilhado = true;
      } catch (shareErr) {
        console.log("Navigator share falhou ou cancelado, tentando copiar para clipboard:", shareErr);
      }
    }

    if (!compartilhado) {
      await copiarTextoParaClipboard(texto);
      showToast("Lista copiada com sucesso! Só colar no WhatsApp.", "success");
    }
  } catch (err) {
    console.error("Erro ao gerar/compartilhar lista:", err);
    showToast("Erro ao gerar a lista do WhatsApp.", "error");
  }
}


