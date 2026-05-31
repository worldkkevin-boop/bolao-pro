// ============ GESTÃO DE GRUPOS ============

async function carregarGrupos() {
  if (!sbClient) return;
  const { data: { user } } = await sbClient.auth.getUser();
  if (!user) return;

  // Pega os IDs de todos os grupos que o usuário é membro
  const { data: memberships, error: errM } = await sbClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

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

function entrarNoGrupo(grupoId, grupoNome, conviteCodigo, ownerId, leagueId = 1) {
  grupoAtual = { id: grupoId, nome: grupoNome, invite_code: conviteCodigo, owner_id: ownerId, league_id: leagueId };
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

  if (typeof switchView === 'function') switchView('view-grupo-home');

  // Atualiza badge de vagas
  atualizarBadgeVagas(grupoId);
}

async function atualizarBadgeVagas(grupoId) {
  const badge = document.getElementById('badge-vagas');
  if (!badge || !sbClient) return;

  try {
    const { count } = await sbClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', grupoId);

    const { data: grp } = await sbClient
      .from('groups')
      .select('max_participants')
      .eq('id', grupoId)
      .single();

    const limite = (grp && grp.max_participants) ? grp.max_participants : 20;
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

  const { data: { user } } = await sbClient.auth.getUser();
  const codigo = Math.random().toString(36).substring(2, 9).toUpperCase();
  const leagueId = parseInt(document.getElementById('select-liga-grupo').value) || 1;
  const maxPart = parseInt(document.getElementById('input-max-participantes').value) || 20;

  const { data: novoGrupo, error } = await sbClient
    .from('groups')
    .insert([{ name: nome, invite_code: codigo, owner_id: user.id, league_id: leagueId, max_participants: maxPart }])
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
    .select('user_id')
    .eq('group_id', grupo.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!jaEhMembro) {
    // Verifica se ainda tem vaga
    const { count } = await sbClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', grupo.id);

    const limite = grupo.max_participants || 20;
    if (count >= limite) {
      const errorEl = document.getElementById('entrar-grupo-error');
      errorEl.innerText = `Grupo lotado! Limite de ${limite} participantes atingido.`;
      errorEl.classList.remove('hidden');
      return;
    }

    // Adiciona como membro
    await sbClient
      .from('group_members')
      .insert([{ group_id: grupo.id, user_id: user.id }]);
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
        const pts = (typeof calcularPontosPalpite === 'function')
          ? calcularPontosPalpite(meuPalpiteUltimo.score_home, meuPalpiteUltimo.score_away, ultimoJogo.goals.home, ultimoJogo.goals.away)
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
  
  const grupoNome = grupoAtual.nome;
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
    try {
      await navigator.clipboard.writeText(textoShare);
      showToast("Link de convite copiado!", "success");
    } catch (err) {
      console.error('Erro ao copiar:', err);
      showToast(`Código: ${codigo} | Link copiado para transferência!`, "success");
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

async function alterarNomeGrupoReal() {
  if (!grupoAtual || !sbClient) return;

  const inputNome = document.getElementById('input-novo-nome-grupo');
  const btn = document.getElementById('btn-alterar-nome-grupo');
  
  if (!inputNome || !btn) return;
  
  const novoNome = inputNome.value.trim();
  
  if (!novoNome) {
    showToast("O nome do grupo não pode ser vazio!", "error");
    return;
  }
  
  if (novoNome === grupoAtual.nome) {
    showToast("O nome do grupo é o mesmo atual.", "error");
    return;
  }
  
  btn.disabled = true;
  btn.innerText = "Salvando...";
  
  try {
    const { error } = await sbClient
      .from('groups')
      .update({ name: novoNome })
      .eq('id', grupoAtual.id);
      
    if (error) {
      console.error("Erro ao alterar nome do grupo:", error.message);
      showToast("Erro ao alterar nome do grupo. Tente novamente.", "error");
      return;
    }
    
    // Atualiza o estado local
    grupoAtual.nome = novoNome;
    
    // Atualiza o header do grupo e outros textos na tela
    document.getElementById('nome-grupo').innerText = novoNome;
    const rankingHeader = document.getElementById('nome-grupo-ranking');
    if (rankingHeader) rankingHeader.innerText = novoNome;
    
    showToast("Nome do grupo alterado com sucesso!", "success");
    
    // Atualiza a lista geral de grupos em background
    carregarGrupos();
  } catch (err) {
    console.error("Erro:", err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Salvar";
  }
}

function salvarRegrasGrupoReal() {
  showToast("Disponível em breve!", "mago");
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

    members.forEach(member => {
      const profile = profiles ? profiles.find(p => p.id === member.user_id) : null;
      const nome = profile ? profile.full_name : 'Participante';
      const foto = (profile && profile.avatar_url) ? profile.avatar_url : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nome) + '&background=10b981&color=fff';
      const isAdmin = member.role === 'owner';

      container.innerHTML += `
        <div class="bg-card-bg/60 rounded-xl p-3 flex items-center justify-between border border-white/5 mb-2">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${foto}" class="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0">
            <div class="min-w-0">
              <h4 class="font-bold text-[14px] text-white truncate">${nome}</h4>
              <p class="text-[11px] text-text-muted truncate">${isAdmin ? 'Organizador do Bolão' : 'Participante'}</p>
            </div>
          </div>
          ${isAdmin ? `
            <span class="border border-brand-green/30 text-brand-green text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-brand-green/5 flex-shrink-0">Admin</span>
          ` : ''}
        </div>
      `;
    });

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


