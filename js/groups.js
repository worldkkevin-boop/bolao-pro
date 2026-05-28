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
  if (todosOsJogos.length === 0) return;

  const agora = new Date();

  // 1. Próximo Jogo (Kickoff futuro, o mais próximo do agora)
  const jogosFuturos = todosOsJogos.filter(j => new Date(j.fixture.date) > agora);
  
  // Ordena ascendente pela data
  jogosFuturos.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

  const proximoJogo = jogosFuturos[0];

  if (proximoJogo) {
    const homeNome = proximoJogo.teams.home.name;
    const awayNome = proximoJogo.teams.away.name;
    document.getElementById('prox-jogo-nome').innerText = `${homeNome} vs ${awayNome}`;

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

  if (ultimoJogo) {
    const homeNome = ultimoJogo.teams.home.name;
    const awayNome = ultimoJogo.teams.away.name;
    const homeGols = ultimoJogo.goals.home;
    const awayGols = ultimoJogo.goals.away;
    document.getElementById('ultimo-jogo-nome').innerText = `${homeNome} ${homeGols} x ${awayGols} ${awayNome}`;

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
  } else {
    document.getElementById('ultimo-jogo-nome').innerText = 'Nenhum jogo encerrado';
    document.getElementById('ultimo-jogo-placar').innerText = '—';
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
  
  // Se for local, mantém a URL local; se for produção, usa a URL oficial do Vercel
  const origin = window.location.origin + window.location.pathname;
  const linkApp = origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("192.168.")
    ? origin + "?code=" + codigo
    : "https://bolao-pro.vercel.app/?code=" + codigo;

  const textoShare = `⚽ BOLÃO PRO - ${grupoNome} ⚽\n\nFala, craque! 🏟️\nCriei um bolão pra gente competir. Prova que você entende de futebol e entra no meu grupo!\n\n👉 Use o código: ${codigo}\n🔗 ${linkApp}\n\nBora ver quem manja mais? 😏`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Bolão Pro',
        text: textoShare,
        url: linkApp
      });
    } catch (err) {
      console.log('Erro ao compartilhar:', err);
    }
  } else {
    try {
      await navigator.clipboard.writeText(textoShare);
      alert("Link e código copiados! Agora é só colar no WhatsApp.");
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert(`Código do grupo: ${codigo}\nCopie o link: ${linkApp}`);
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
      alert("Erro no upload: " + uploadError.message);
      return;
    }

    // 2. Pega a URL pública
    const { data: { publicUrl } } = sbClient.storage
        .from('grupos-icons')
        .getPublicUrl(filePath);

    if (spinner) spinner.classList.add('hidden');

    alert("Ícone atualizado com sucesso!");
    
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
    alert("Ocorreu um erro no processamento do upload.");
  }
}
