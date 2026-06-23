// ============ GAME MASTER (GM) ADMIN CONTROLLER ============

// ============ SISTEMA DE NOTIFICAÇÕES (TOAST) ============
function showToast(mensagem, tipo = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  
  let bgClass, icon;
  if (tipo === 'success') {
    bgClass = 'bg-brand-green/95 border-brand-green/50 text-white';
    icon = '✅';
  } else if (tipo === 'error') {
    bgClass = 'bg-red-500/95 border-red-500/50 text-white';
    icon = '❌';
  } else if (tipo === 'mago') {
    bgClass = 'bg-purple-650/95 border-purple-400/50 text-white';
    icon = '🪄';
  } else {
    bgClass = 'bg-zinc-800/95 border-zinc-700/50 text-white';
    icon = 'ℹ️';
  }

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md text-[13px] font-bold transform transition-all duration-300 translate-y-[-20px] opacity-0 ${bgClass}`;
  toast.innerHTML = `<span class="text-[16px]">${icon}</span> <span>${mensagem}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-20px]', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function adminApp() {
  return {
    loading: true,
    usuario: null,
    acessoAutorizado: false,
    pinDesbloqueado: false,
    pinInput: '',
    pinErro: false,
    abaAtiva: 'dashboard',
    sidebarMobileAberta: false,

    // ===== MÓDULO ISOLADO: EVENTO TELÃO (lê só leads_evento_telao) =====
    telaoLoading: false,
    telaoLeads: [],
    telaoEvento: 'telao_brasil',     // vira 'fixture_<id>' quando um jogo é escolhido
    telaoPlacar: { casa: '', fora: '' },
    telaoVencedor: null,
    // Modo Telão (apresentação em tela cheia do sorteio)
    telaoApresentacao: false,
    telaoSorteando: false,
    telaoRolando: '0000',
    // Seletor de jogo (puxa da API-Football, mesma do bolão)
    telaoBuscaJogo: '',
    telaoBuscaLoading: false,
    telaoResultadosBusca: [],
    telaoHistoricoBusca: [], // Adicionado: histórico para o telão
    telaoFixture: null,              // { id, homeName, homeLogo, awayName, awayLogo, date }
    eventoAtivo: false,              // Indica se o evento está iniciado para os players
    iniciandoEvento: false,
    palpitesTravados: false,         // Trava o cadastro público (jogo começou)
    travandoPalpites: false,
    telaoApresentacaoPalpites: false, // Modo Telão da distribuição de palpites

    // Grupos
    gruposLista: [],
    gruposLoading: false,
    gruposFiltro: '',
    grupoSelecionado: null,
    grupoSelecionadoMembros: [],
    grupoMembrosLoading: false,

    // Editor rápido de palpite (Habitantes da Matriz)
    editorPalpite: { aberto: false, membro: null, loading: false, salvandoId: null, palpites: [] },

    // Placar da Galera por Jogo (rolando + futuros)
    placarJogos: { carregado: false, loading: false, jogos: [], salvandoKey: null },

    // Tesouraria
    tesourariaLoading: false,
    transacoesTesouraria: [],
    
    transacoesPendentes() {
      return this.transacoesTesouraria.filter(t => t.status === 'pending');
    },
    transacoesHistorico() {
      return this.transacoesTesouraria.filter(t => t.status !== 'pending').sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    },

    // Auditoria (Big Brother)
    auditoriaLoading: false,
    feedPalpites: [],
    feedAuditoria: [],

    // Usuários
    usuariosLista: [],
    usuariosLoading: false,
    usuariosFiltro: '',
    usuarioSelecionado: null,

    // Migração de Jogadores
    migracaoLoading: false,
    grupoOrigemId: '',
    grupoDestinoId: '',
    deletarOrigem: false,

    // Desafios do GM
    desafiosListaGM: [],
    desafiosLoading: false,
    desafiosAbaFiltro: 'active',
    novoDesafio: { fixture_id: '', match_name: '', market_type: '', prop_line: 0.5, target_player_name: '', premio_pontos: 15, custo_fichas: 1, event_type: 'Prop', points: 15, status: 'active', hasPenalty: false, players: [] },
    novoJogadorInput: '',
    desafioLancando: false,
    buscaFixture: '',
    buscaFixtureLoading: false,
    resultadoBuscaFixtures: [],
    historicoBuscaFixtures: [], // Adicionado: lista de buscas recentes

    async buscarFixtures() {
      if (this.buscaFixture.length < 3) return;
      
      // Salvar no histórico
      const termo = this.buscaFixture.trim();
      if (termo) {
        let h = [termo, ...this.historicoBuscaFixtures.filter(t => t.toLowerCase() !== termo.toLowerCase())];
        this.historicoBuscaFixtures = h.slice(0, 5); // Mantém as 5 últimas
        localStorage.setItem('gm_busca_history', JSON.stringify(this.historicoBuscaFixtures));
      }

      this.buscaFixtureLoading = true;
      // ... rest of search logic
    },

    usarBuscaHistorico(termo) {
      this.buscaFixture = termo;
      this.buscarFixtures();
    },

    // Oráculo (aba dedicada)
    oraculo: { loading: false, fixtureId: '', predicoes: null, distribuicao: null, distorcao: null, estrategia: null, placaresProvaveis: null, tabelaPlacares: null, golsInfo: null, mataMata: false, modoEstrategia: 'hedge', zebraRadar: null, quantData: null, modo: 'zebra', erro: null },

    // Foco no grupo: lê as regras de pontos e os palpites do bolão específico.
    grupoFoco: { code: '', id: null, nome: null, regras: null, carregando: false, erro: null },
    grupoFocoHistorico: [], // histórico de grupos focados (code + nome) p/ reuso rápido

    // Desafio rápido — lançado diretamente do Oráculo
    desafioRapido: { eventType: 'Goal', pts: 5, fichas: 3, players: [], jogadorInput: '', lancando: false, motivo: '' },

    // Oráculo inline no formulário de novo desafio (legado)
    oraculoDesafio: { loading: false, dados: null, sugestao: null },

    // Finalização de desafio com vencedor
    desafioParaFinalizar: null,
    desafioFinalizando: false,

    // Métricas de Banco de Dados
    metricas: {
      loading: false,
      usuarios: 0,
      grupos: 0,
      palpites: 0,
      desafios: 0
    },

    // Status da API-Football
    apiStatus: {
      loading: false,
      error: null,
      account: '',
      plan: '',
      active: false,
      current: 0,
      limit: 0,
      percent: 0
    },

    // Histórico de Logs de Requisições
    apiLogs: [],

    async init() {
      console.log("[ADMIN] Inicializando aplicação do GM...");

      if (!sbClient) {
        showToast("Erro: Cliente Supabase não inicializado. Verifique a configuração.", "error");
        this.loading = false;
        return;
      }

      // Restaura históricos do localStorage
      try {
        const h = localStorage.getItem('gm_busca_history');
        if (h) this.historicoBuscaFixtures = JSON.parse(h);
        
        const ht = localStorage.getItem('gm_telao_history');
        if (ht) this.telaoHistoricoBusca = JSON.parse(ht);

        const gf = localStorage.getItem('gm_grupo_foco_history');
        if (gf) this.grupoFocoHistorico = JSON.parse(gf);
      } catch(e) {
        console.warn("Erro ao restaurar histórico:", e);
      }

      // Restaura logs do sessionStorage se existirem
      const savedLogs = sessionStorage.getItem('gm_api_logs');
      if (savedLogs) {
        try {
          this.apiLogs = JSON.parse(savedLogs);
        } catch (e) {
          this.apiLogs = [];
        }
      }

      // Restaura o estado de desbloqueio do PIN da sessão do navegador
      if (sessionStorage.getItem('gm_pin_unlocked') === 'true') {
        this.pinDesbloqueado = true;
      }

      // Escuta mudanças de autenticação
      sbClient.auth.onAuthStateChange((event, session) => {
        this.processarSessao(session);
      });

      // Busca sessão inicial
      try {
        const { data: { session } } = await sbClient.auth.getSession();
        this.processarSessao(session);
      } catch (err) {
        console.error("Erro ao buscar sessão ativa:", err);
      }

      // Se já estiver desbloqueado, puxa os dados iniciais
      if (this.acessoAutorizado && this.pinDesbloqueado) {
        this.carregarDadosPainel();
        // Sincroniza o estado do Telão se estiver na aba
        this.carregarTelao();
      }

      this.loading = false;
    },

    processarSessao(session) {
      if (session && session.user) {
        this.usuario = session.user;
        // Verifica permissão por e-mail do GM
        if (this.usuario.email === 'worldkkevin@gmail.com') {
          this.acessoAutorizado = true;
        } else {
          this.acessoAutorizado = false;
          this.pinDesbloqueado = false;
        }
      } else {
        this.usuario = null;
        this.acessoAutorizado = false;
        this.pinDesbloqueado = false;
      }
    },

    async entrarComGoogle() {
      try {
        const origin = window.location.origin + window.location.pathname;
        const { error } = await sbClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: origin
          }
        });
        if (error) throw error;
      } catch (err) {
        showToast("Erro no Login do Google: " + err.message, "error");
      }
    },

    async deslogar() {
      this.loading = true;
      try {
        await sbClient.auth.signOut();
        sessionStorage.removeItem('gm_pin_unlocked');
        sessionStorage.removeItem('gm_api_logs');
        this.usuario = null;
        this.acessoAutorizado = false;
        this.pinDesbloqueado = false;
        this.pinInput = '';
        this.pinErro = false;
        this.apiLogs = [];
      } catch (err) {
        console.error("Erro ao deslogar:", err);
      }
      this.loading = false;
    },

    verificarPin() {
      // PIN secreto configurado como 8187
      const PIN_SECRETO = "8187";
      
      if (this.pinInput === PIN_SECRETO) {
        this.pinDesbloqueado = true;
        this.pinErro = false;
        this.pinInput = '';
        sessionStorage.setItem('gm_pin_unlocked', 'true');
        console.log("[ADMIN] PIN validado com sucesso. Painel destravado.");
        this.carregarDadosPainel();
      } else {
        this.pinErro = true;
        this.pinInput = '';
        console.warn("[ADMIN] Tentativa de login frustrada: PIN incorreto.");
      }
    },

    // ============ MÉTODOS DE DADOS & APIS ============

    adicionarLog(servico, rota, status, tempoMs, mensagem) {
      const log = {
        horario: new Date().toLocaleTimeString('pt-BR'),
        servico,
        rota,
        status,
        tempoMs,
        mensagem
      };
      
      // Adiciona no início da lista
      this.apiLogs.unshift(log);
      
      // Limita a 15 logs recentes
      if (this.apiLogs.length > 15) {
        this.apiLogs.pop();
      }
      
      // Salva no sessionStorage
      sessionStorage.setItem('gm_api_logs', JSON.stringify(this.apiLogs));
    },

    limparLogs() {
      this.apiLogs = [];
      sessionStorage.removeItem('gm_api_logs');
    },

    async carregarDadosPainel() {
      // Carrega métricas e API status simultaneamente
      await Promise.all([
        this.carregarMetricas(),
        this.carregarApiStatus()
      ]);
    },

    async carregarMetricas() {
      if (this.metricas.loading) return;
      this.metricas.loading = true;
      
      const tabelas = ['profiles', 'groups', 'guesses', 'desafios'];
      
      try {
        await Promise.all(tabelas.map(async (tabela) => {
          const startTime = Date.now();
          const { count, error } = await sbClient
            .from(tabela)
            .select('*', { count: 'exact', head: true });
          
          const duration = Date.now() - startTime;
          
          if (error) {
            this.adicionarLog('Supabase', `SELECT COUNT(${tabela})`, 'ERROR', duration, error.message);
          } else {
            // Mapeia para o objeto de métricas
            if (tabela === 'profiles') this.metricas.usuarios = count;
            else if (tabela === 'groups') this.metricas.grupos = count;
            else if (tabela === 'guesses') this.metricas.palpites = count;
            else if (tabela === 'desafios') this.metricas.desafios = count;
            
            this.adicionarLog('Supabase', `SELECT COUNT(${tabela})`, 'SUCCESS', duration, `Total: ${count}`);
          }
        }));
      } catch (err) {
        console.error("Erro ao puxar métricas:", err);
      } finally {
        this.metricas.loading = false;
      }
    },

    async carregarApiStatus() {
      if (this.apiStatus.loading) return;
      this.apiStatus.loading = true;
      this.apiStatus.error = null;
      const startTime = Date.now();

      try {
        // endpoint status da API-Football
        const res = await fetch('https://v3.football.api-sports.io/status', {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5'
          }
        });

        const duration = Date.now() - startTime;

        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }

        const data = await res.json();
        
        // Verifica se a API retornou erros na resposta (Ex: limites de chave excedidos)
        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error(JSON.stringify(data.errors));
        }

        const resp = data.response;
        this.apiStatus.account = `${resp.account.firstname || ''} ${resp.account.lastname || ''}`.trim() || resp.account.email;
        this.apiStatus.plan = resp.subscription.plan;
        this.apiStatus.active = resp.subscription.active;
        this.apiStatus.current = resp.requests.current;
        this.apiStatus.limit = resp.requests.limit_day;
        this.apiStatus.percent = Math.min(100, Math.round((resp.requests.current / resp.requests.limit_day) * 100)) || 0;

        this.adicionarLog('API-Football', 'GET /status', 'SUCCESS', duration, `Cota: ${resp.requests.current}/${resp.requests.limit_day}`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.apiStatus.error = err.message;
        this.adicionarLog('API-Football', 'GET /status', 'ERROR', duration, err.message);
      } finally {
        this.apiStatus.loading = false;
      }
    },

    // ============ GRUPOS ============

    gruposFiltrados() {
      if (!this.gruposFiltro) return this.gruposLista;
      const q = this.gruposFiltro.toLowerCase();
      return this.gruposLista.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.invite_code || '').toLowerCase().includes(q) ||
        (g._donoNome || '').toLowerCase().includes(q)
      );
    },

    async carregarGrupos() {
      if (this.gruposLoading) return;
      this.gruposLoading = true;
      const startTime = Date.now();

      try {
        // Busca todos os grupos
        const { data: grupos, error } = await sbClient
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Busca todos os membros para contar por grupo
        const { data: membros } = await sbClient
          .from('group_members')
          .select('group_id, user_id');

        // Busca perfis para resolver nomes dos donos
        const { data: perfis } = await sbClient
          .from('profiles')
          .select('id, full_name');

        const perfisMap = {};
        if (perfis) perfis.forEach(p => { perfisMap[p.id] = p.full_name; });

        const membrosCount = {};
        if (membros) membros.forEach(m => {
          membrosCount[m.group_id] = (membrosCount[m.group_id] || 0) + 1;
        });

        // Enriquece os grupos com contagem e nome do dono
        grupos.forEach(g => {
          g._membros = membrosCount[g.id] || 0;
          g._donoNome = perfisMap[g.owner_id] || 'Desconhecido';
        });

        this.gruposLista = grupos;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT groups + members + profiles', 'SUCCESS', duration, `${grupos.length} grupos carregados`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT groups', 'ERROR', duration, err.message);
        console.error('Erro ao carregar grupos:', err);
      } finally {
        this.gruposLoading = false;
      }
    },

    async carregarMembrosGrupo(grupoId) {
      this.grupoMembrosLoading = true;
      this.grupoSelecionadoMembros = [];
      this.placarJogos = { carregado: false, loading: false, jogos: [], salvandoKey: null };

      try {
        const { data: membros, error } = await sbClient
          .from('group_members')
          .select('*')
          .eq('group_id', grupoId);

        if (error) throw error;

        // Busca perfis dos membros
        const userIds = membros.map(m => m.user_id);
        const { data: perfis } = await sbClient
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        const perfisMap = {};
        if (perfis) perfis.forEach(p => { perfisMap[p.id] = p; });

        membros.forEach(m => {
          const p = perfisMap[m.user_id];
          // Formata exatamente como o novo HTML espera: membro.profiles.xxx
          m.profiles = p ? p : { full_name: 'Sem nome', email: '', avatar_url: null };
        });

        this.grupoSelecionadoMembros = membros;
      } catch (err) {
        console.error('Erro ao carregar membros:', err);
      } finally {
        this.grupoMembrosLoading = false;
      }
    },

    // ============ EDITOR RÁPIDO DE PALPITE ============

    async abrirEditorPalpite(membro) {
      this.editorPalpite = { aberto: true, membro, loading: true, salvandoId: null, palpites: [] };
      const grupoId = this.grupoSelecionado.id;
      const t = Date.now();
      try {
        const { data: palpites, error } = await sbClient
          .from('guesses')
          .select('id, match_id, score_home, score_away')
          .eq('group_id', grupoId)
          .eq('user_id', membro.user_id);
        if (error) throw error;

        const matchIds = (palpites || []).map(p => p.match_id);
        let matchesMap = {};
        if (matchIds.length > 0) {
          const { data: jogos } = await sbClient
            .from('matches')
            .select('id, home_team, away_team, home_logo, away_logo, kickoff')
            .in('id', matchIds);
          if (jogos) jogos.forEach(j => { matchesMap[j.id] = j; });
        }

        const lista = (palpites || []).map(p => ({
          ...p,
          _novoHome: p.score_home,
          _novoAway: p.score_away,
          jogo: matchesMap[p.match_id] || null
        })).sort((a, b) => new Date(a.jogo?.kickoff || 0) - new Date(b.jogo?.kickoff || 0));

        this.editorPalpite.palpites = lista;
        this.adicionarLog('Supabase', 'SELECT guesses (editor)', 'SUCCESS', Date.now() - t, `${lista.length} palpites de ${membro.profiles?.full_name}`);
      } catch (err) {
        console.error('Erro ao carregar palpites do membro:', err);
        showToast('Erro ao carregar palpites: ' + err.message, 'error');
      } finally {
        this.editorPalpite.loading = false;
      }
    },

    fecharEditorPalpite() {
      this.editorPalpite = { aberto: false, membro: null, loading: false, salvandoId: null, palpites: [] };
    },

    async salvarPalpiteEditado(palpite) {
      const novoHome = parseInt(palpite._novoHome);
      const novoAway = parseInt(palpite._novoAway);
      if (isNaN(novoHome) || isNaN(novoAway) || novoHome < 0 || novoAway < 0) {
        showToast('Placar inválido.', 'error');
        return;
      }
      const membro = this.editorPalpite.membro;
      const grupoId = this.grupoSelecionado.id;
      this.editorPalpite.salvandoId = palpite.id;
      const t = Date.now();
      try {
        const { error } = await sbClient
          .from('guesses')
          .upsert([{
            user_id: membro.user_id,
            group_id: grupoId,
            match_id: palpite.match_id,
            score_home: novoHome,
            score_away: novoAway
          }], { onConflict: 'user_id,group_id,match_id' });
        if (error) throw error;

        const oldHome = palpite.score_home, oldAway = palpite.score_away;
        palpite.score_home = novoHome;
        palpite.score_away = novoAway;

        this.adicionarLog('Supabase', 'UPSERT guesses', 'SUCCESS', Date.now() - t, `Palpite alterado para ${membro.profiles?.full_name}`);
        await this._registrarAuditoria('EDIT_GUESS', 'guesses', palpite.id, {
          match_id: palpite.match_id,
          user_id: membro.user_id,
          old: { home: oldHome, away: oldAway },
          new: { home: novoHome, away: novoAway }
        });
        showToast('Palpite atualizado com sucesso!', 'success');
      } catch (err) {
        showToast('Erro ao salvar palpite: ' + err.message, 'error');
      } finally {
        this.editorPalpite.salvandoId = null;
      }
    },

    // ============ PLACAR DA GALERA POR JOGO ============

    async carregarPlacarJogos() {
      if (!this.grupoSelecionado) return;
      const grupo = this.grupoSelecionado;
      this.placarJogos = { carregado: true, loading: true, jogos: [], salvandoKey: null };
      const t = Date.now();
      try {
        // 1. Busca os fixtures da liga do grupo (rolando + futuros, janela de 30 dias)
        const liga = grupo.league_id || 1;
        const hoje = new Date();
        const from = new Date(hoje.getTime() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
        const ate = new Date(hoje.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

        const resp = await fetch(`https://v3.football.api-sports.io/fixtures?league=${liga}&season=2026&from=${from}&to=${ate}`, {
          headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5'
          }
        });
        const json = await resp.json();
        const ENCERRADOS = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
        const fixtures = (json.response || [])
          .filter(j => !ENCERRADOS.includes(j.fixture?.status?.short))
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        this.adicionarLog('API-Football', `GET /fixtures liga ${liga} (placar galera)`, 'SUCCESS', Date.now() - t, `${fixtures.length} jogos rolando/futuros`);

        // 2. Busca TODOS os palpites do grupo de uma vez
        const { data: palpites, error } = await sbClient
          .from('guesses')
          .select('user_id, match_id, score_home, score_away')
          .eq('group_id', grupo.id);
        if (error) throw error;

        const palpitesMap = {}; // `${match_id}_${user_id}` -> palpite
        (palpites || []).forEach(p => { palpitesMap[`${p.match_id}_${p.user_id}`] = p; });

        // 3. Monta cada jogo com a linha de cada membro
        const membros = this.grupoSelecionadoMembros || [];
        const ABERTO = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];
        const jogos = fixtures.map(j => {
          const fid = j.fixture.id;
          const aoVivo = ABERTO.includes(j.fixture?.status?.short);
          const linhas = membros.map(m => {
            const p = palpitesMap[`${fid}_${m.user_id}`];
            const palpitou = !!p && p.score_home !== null && p.score_away !== null;
            return {
              user_id: m.user_id,
              nome: m.profiles?.full_name || 'Sem nome',
              avatar: m.profiles?.avatar_url,
              palpitou,
              score_home: palpitou ? p.score_home : null,
              score_away: palpitou ? p.score_away : null,
              _novoHome: palpitou ? p.score_home : '',
              _novoAway: palpitou ? p.score_away : ''
            };
          });
          const semPalpite = linhas.filter(l => !l.palpitou).length;
          return {
            fixture_id: fid,
            _raw: j,
            aoVivo,
            statusShort: j.fixture?.status?.short,
            home: j.teams.home.name,
            away: j.teams.away.name,
            homeLogo: j.teams.home.logo,
            awayLogo: j.teams.away.logo,
            golsHome: j.goals.home,
            golsAway: j.goals.away,
            kickoff: j.fixture.date,
            round: j.league?.round || '',
            aberto: false,
            linhas,
            totalMembros: linhas.length,
            semPalpite
          };
        });

        this.placarJogos.jogos = jogos;
      } catch (err) {
        console.error('Erro ao carregar placar da galera:', err);
        showToast('Erro ao carregar jogos: ' + (err.message || err), 'error');
        this.adicionarLog('API-Football', 'GET /fixtures (placar galera)', 'ERROR', Date.now() - t, err.message || String(err));
      } finally {
        this.placarJogos.loading = false;
      }
    },

    togglePlacarJogo(jogo) {
      jogo.aberto = !jogo.aberto;
    },

    async salvarPalpiteGM(jogo, linha) {
      const novoHome = parseInt(linha._novoHome);
      const novoAway = parseInt(linha._novoAway);
      if (isNaN(novoHome) || isNaN(novoAway) || novoHome < 0 || novoAway < 0) {
        showToast('Placar inválido.', 'error');
        return;
      }
      const grupoId = this.grupoSelecionado.id;
      const key = `${jogo.fixture_id}_${linha.user_id}`;
      this.placarJogos.salvandoKey = key;
      const t = Date.now();
      try {
        // 1. Garante que o jogo existe na tabela matches (FK do guesses)
        const j = jogo._raw;
        const { error: matchError } = await sbClient.from('matches').upsert([{
          id:           j.fixture.id,
          league_id:    j.league.id,
          season:       j.league.season,
          home_team:    j.teams.home.name,
          home_team_id: j.teams.home.id,
          home_logo:    j.teams.home.logo || '',
          away_team:    j.teams.away.name,
          away_team_id: j.teams.away.id,
          away_logo:    j.teams.away.logo || '',
          kickoff:      j.fixture.date,
          status:       j.fixture.status.short,
          score_home:   j.goals.home,
          score_away:   j.goals.away,
          round:        j.league.round
        }], { onConflict: 'id' });
        if (matchError) throw matchError;

        // 2. Upsert do palpite
        const { error } = await sbClient
          .from('guesses')
          .upsert([{
            user_id: linha.user_id,
            group_id: grupoId,
            match_id: jogo.fixture_id,
            score_home: novoHome,
            score_away: novoAway
          }], { onConflict: 'user_id,group_id,match_id' });
        if (error) throw error;

        const old = linha.palpitou ? { home: linha.score_home, away: linha.score_away } : null;
        linha.score_home = novoHome;
        linha.score_away = novoAway;
        const eraSemPalpite = !linha.palpitou;
        linha.palpitou = true;
        if (eraSemPalpite) jogo.semPalpite = Math.max(0, jogo.semPalpite - 1);

        this.adicionarLog('Supabase', 'UPSERT guesses (placar GM)', 'SUCCESS', Date.now() - t, `${linha.nome}: ${novoHome}x${novoAway} em ${jogo.home} x ${jogo.away}`);
        await this._registrarAuditoria(eraSemPalpite ? 'CREATE_GUESS' : 'EDIT_GUESS', 'guesses', null, {
          match_id: jogo.fixture_id,
          user_id: linha.user_id,
          jogo: `${jogo.home} x ${jogo.away}`,
          old,
          new: { home: novoHome, away: novoAway }
        });
        showToast('Palpite salvo!', 'success');
      } catch (err) {
        showToast('Erro ao salvar: ' + (err.message || err), 'error');
      } finally {
        this.placarJogos.salvandoKey = null;
      }
    },

    // ============ USUÁRIOS ============

    usuariosFiltrados() {
      if (!this.usuariosFiltro) return this.usuariosLista;
      const q = this.usuariosFiltro.toLowerCase();
      return this.usuariosLista.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    },

    async carregarUsuarios() {
      if (this.usuariosLoading) return;
      this.usuariosLoading = true;
      const startTime = Date.now();

      try {
        const { data: perfis, error } = await sbClient
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Busca contagem de grupos por usuário
        const { data: membros } = await sbClient
          .from('group_members')
          .select('user_id');

        // Busca contagem de palpites por usuário
        const { data: palpites } = await sbClient
          .from('guesses')
          .select('user_id');

        const gruposCount = {};
        if (membros) membros.forEach(m => {
          gruposCount[m.user_id] = (gruposCount[m.user_id] || 0) + 1;
        });

        const palpitesCount = {};
        if (palpites) palpites.forEach(p => {
          palpitesCount[p.user_id] = (palpitesCount[p.user_id] || 0) + 1;
        });

        perfis.forEach(u => {
          u._gruposCount = gruposCount[u.id] || 0;
          u._palpitesCount = palpitesCount[u.id] || 0;
        });

        this.usuariosLista = perfis;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT profiles + members + guesses', 'SUCCESS', duration, `${perfis.length} usuários carregados`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT profiles', 'ERROR', duration, err.message);
        console.error('Erro ao carregar usuários:', err);
      } finally {
        this.usuariosLoading = false;
      }
    },

    // ============================================================
    // PROJETO GOD MODE: DOSSIÊ DE JOGADORES (Poderes do GM)
    // ============================================================

    async abrirRaioXUsuario(u) {
      this.usuarioSelecionado = u;
      this.abaAtiva = 'usuario-detalhe';
      if (!u.is_banned) u.is_banned = false; // Garante prop reativa
      document.querySelector('main').scrollTop = 0;

      // Buscar os grupos em tempo real para o Raio-X
      try {
        const { data } = await sbClient
          .from('group_members')
          .select('group_id, role, groups(name)')
          .eq('user_id', u.id);
        
        // Garante a reatividade no Alpine
        this.usuarioSelecionado._gruposLista = data || [];
      } catch (err) {
        console.error("Erro ao buscar grupos do usuário:", err);
        this.usuarioSelecionado._gruposLista = [];
      }
    },

    async injetarFichas(usuarioId, qtdStr) {
      const qtd = parseInt(qtdStr);
      if (isNaN(qtd) || qtd <= 0) {
        showToast("Quantidade inválida.", "error");
        return;
      }
      const t = Date.now();
      try {
        const u = this.usuarioSelecionado;
        const novasFichas = (u.fichas_desafio || 0) + qtd;
        const { error } = await sbClient.from('profiles').update({ fichas_desafio: novasFichas }).eq('id', usuarioId);
        if (error) throw error;
        
        u.fichas_desafio = novasFichas;
        this.adicionarLog('Supabase', 'UPDATE profiles (fichas)', 'SUCCESS', Date.now() - t, `+${qtd} fichas para ${u.full_name}`);
        
        // Registrar na auditoria
        await this._registrarAuditoria('INJECT_FICHAS', 'profiles', usuarioId, { added: qtd, new_total: novasFichas });
        
        showToast(`${qtd} fichas injetadas com sucesso!`, "success");
        document.getElementById('inputFichasInjetar').value = '';
      } catch (err) {
        showToast("Erro ao injetar fichas: " + err.message, "error");
        this.adicionarLog('Supabase', 'UPDATE profiles', 'ERROR', Date.now() - t, err.message);
      }
    },

    async zerarFichas(usuarioId) {
      const u = this.usuarioSelecionado;
      if (!confirm(`⚠️ Atenção: Isso vai zerar TODAS as fichas de ${u.full_name}. Confirma?`)) return;
      const t = Date.now();
      try {
        const oldTotal = u.fichas_desafio || 0;
        const { error } = await sbClient.from('profiles').update({ fichas_desafio: 0 }).eq('id', usuarioId);
        if (error) throw error;
        
        u.fichas_desafio = 0;
        this.adicionarLog('Supabase', 'UPDATE profiles (fichas=0)', 'SUCCESS', Date.now() - t, `Fichas zeradas para ${u.full_name}`);
        await this._registrarAuditoria('ZERO_FICHAS', 'profiles', usuarioId, { old_total: oldTotal, new_total: 0 });
        
        showToast("Saldo zerado.", "success");
      } catch (err) {
        showToast("Erro ao zerar fichas: " + err.message, "error");
      }
    },

    async alternarBanimento(usuarioId, banir) {
      const u = this.usuarioSelecionado;
      const acao = banir ? 'banir' : 'desbanir';
      if (!confirm(`⚠️ Tem certeza que deseja ${acao} a conta de ${u.full_name}?`)) return;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('profiles').update({ is_banned: banir }).eq('id', usuarioId);
        if (error) throw error;
        
        u.is_banned = banir;
        this.adicionarLog('Supabase', 'UPDATE profiles (is_banned)', 'SUCCESS', Date.now() - t, `Usuário ${banir ? 'BANIDO' : 'DESBANIDO'}: ${u.full_name}`);
        await this._registrarAuditoria(banir ? 'BAN_USER' : 'UNBAN_USER', 'profiles', usuarioId, { is_banned: banir });
        
        showToast(`Conta ${banir ? 'banida' : 'reativada'} com sucesso!`, banir ? "error" : "success");
      } catch (err) {
        showToast("Erro na moderação: " + err.message, "error");
      }
    },

    async deletarUsuarioNuclear(id, nome) {
      if (!confirm(`🚨 ALERTA NUCLEAR! 🚨\n\nVocê tem certeza que deseja EXTERMINAR a conta de "${nome}"?\n\nIsso removerá o perfil, todos os palpites, fichas e participações em grupos permanentemente.`)) return;
      
      const pin = prompt(`Para confirmar a destruição, digite o PIN de segurança:`);
      if (pin !== "8187") return alert("PIN incorreto. Operação abortada.");

      try {
        const { error } = await sbClient
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;

        showToast(`Usuário ${nome} foi removido da existência.`, 'success');
        this.abaAtiva = 'usuarios';
        this.carregarUsuarios();
      } catch (err) {
        console.error("Erro ao deletar usuário:", err);
        showToast("Falha ao exterminar usuário: " + err.message, "error");
      }
    },

    async expulsarCirurgico(usuarioId, grupoId, grupoName) {
      if (!confirm(`⚠️ Expulsar o jogador do grupo "${grupoName}"? Ele perderá acesso ao bolão desse grupo.`)) return;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('group_members').delete().eq('user_id', usuarioId).eq('group_id', grupoId);
        if (error) throw error;
        
        // Remove localmente da UI
        this.usuarioSelecionado._gruposLista = this.usuarioSelecionado._gruposLista.filter(g => g.group_id !== grupoId);
        this.usuarioSelecionado._gruposCount = Math.max(0, this.usuarioSelecionado._gruposCount - 1);
        
        this.adicionarLog('Supabase', 'DELETE group_members', 'SUCCESS', Date.now() - t, `Usuário expulso de ${grupoName}`);
        await this._registrarAuditoria('SURGICAL_KICK', 'group_members', usuarioId, { group_id: grupoId, group_name: grupoName });
        
        showToast(`Jogador expulso do grupo ${grupoName}`, "success");
      } catch (err) {
        showToast("Erro ao expulsar: " + err.message, "error");
      }
    },

    async _registrarAuditoria(action, targetType, targetId, details) {
      try {
        if (!this.usuario?.id) return;
        await sbClient.from('audit_logs').insert([{
          admin_id: this.usuario.id,
          action,
          target_type: targetType,
          target_id: targetId,
          details
        }]);
      } catch (e) {
        console.error("Aviso: Falha ao gravar log de auditoria. Tabela criada?", e);
      }
    },

    // ============ FIM: DOSSIÊ DE JOGADORES ============

    // ============================================================
    // PROJETO GOD MODE: CONTROLE DA MATRIZ (Grupos)
    // ============================================================

    async salvarNomeGrupo(grupoId, novoNome) {
      if (!novoNome || novoNome.trim() === '') {
        showToast("O nome não pode ficar vazio.", "error");
        return;
      }
      const t = Date.now();
      try {
        const { error } = await sbClient.from('groups').update({ name: novoNome.trim() }).eq('id', grupoId);
        if (error) throw error;
        
        this.grupoSelecionado.name = novoNome.trim();
        this.adicionarLog('Supabase', 'UPDATE groups (name)', 'SUCCESS', Date.now() - t, `Nome alterado para: ${novoNome}`);
        await this._registrarAuditoria('RENAME_GROUP', 'groups', grupoId, { new_name: novoNome });
        showToast("Nome do grupo atualizado com sucesso!", "success");
      } catch (err) {
        showToast("Erro ao renomear: " + err.message, "error");
      }
    },

    async atualizarLimiteGrupoManual(grupoId, novoLimiteStr) {
      const limite = parseInt(novoLimiteStr);
      if (isNaN(limite) || limite < 1) return;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('groups').update({ max_participants: limite }).eq('id', grupoId);
        if (error) throw error;
        
        this.grupoSelecionado.max_participants = limite;
        this.adicionarLog('Supabase', 'UPDATE groups (max_participants)', 'SUCCESS', Date.now() - t, `Novo limite: ${limite}`);
        await this._registrarAuditoria('CHANGE_GROUP_LIMIT', 'groups', grupoId, { new_limit: limite });
        showToast(`Vagas do grupo expandidas para ${limite}!`, "success");
      } catch (err) {
        showToast("Erro ao alterar limite: " + err.message, "error");
      }
    },

    async toggleZebraDinamica(grupoId, ativar) {
      const t = Date.now();
      try {
        const { error } = await sbClient.from('groups').update({ regra_zebra_dinamica: ativar }).eq('id', grupoId);
        if (error) throw error;
        
        this.grupoSelecionado.regra_zebra_dinamica = ativar;
        this.adicionarLog('Supabase', 'UPDATE groups (zebra)', 'SUCCESS', Date.now() - t, `Zebra ${ativar ? 'ATIVADA' : 'DESATIVADA'}`);
        await this._registrarAuditoria('TOGGLE_ZEBRA', 'groups', grupoId, { active: ativar });
        showToast(`Zebra Dinâmica ${ativar ? 'ativada' : 'desativada'}!`, "success");
      } catch (err) {
        showToast("Erro ao alterar zebra: " + err.message, "error");
      }
    },

    async transferirDono(grupoId, novoDonoId, donoNome) {
      if (!confirm(`⚠️ Você está prestes a transferir a coroa (Acesso de Dono) do grupo "${this.grupoSelecionado.name}" para o jogador ${donoNome}. O dono antigo perderá seus poderes. Confirma?`)) return;
      const t = Date.now();
      try {
        // 1. Muda o dono na tabela groups
        const { error: err1 } = await sbClient.from('groups').update({ owner_id: novoDonoId }).eq('id', grupoId);
        if (err1) throw err1;
        
        // 2. Tira o papel de 'owner' do dono antigo
        await sbClient.from('group_members').update({ role: 'member' }).eq('group_id', grupoId).eq('role', 'owner');
        
        // 3. Dá o papel de 'owner' para o novo dono
        await sbClient.from('group_members').update({ role: 'owner' }).eq('group_id', grupoId).eq('user_id', novoDonoId);

        // Atualiza a interface
        this.grupoSelecionado.owner_id = novoDonoId;
        this.grupoSelecionado._donoNome = donoNome;
        this.grupoSelecionadoMembros.forEach(m => {
          m.role = m.user_id === novoDonoId ? 'admin' : 'member';
        });

        this.adicionarLog('Supabase', 'UPDATE groups/members (transfer owner)', 'SUCCESS', Date.now() - t, `Dono transferido para: ${donoNome}`);
        await this._registrarAuditoria('TRANSFER_GROUP_OWNER', 'groups', grupoId, { new_owner_id: novoDonoId });
        showToast(`A coroa foi transferida para ${donoNome}!`, "success");
      } catch (err) {
        showToast("Erro catastrófico ao transferir dono: " + err.message, "error");
      }
    },

    async deletarGrupoNuclear(grupoId, grupoNome) {
      const confirmText = `DELETAR-${grupoNome.substring(0, 4).toUpperCase()}`;
      const digito = prompt(`⚠️ ATENÇÃO! EXTERMÍNIO NUCLEAR.\nIsso vai apagar DEFINITIVAMENTE o grupo "${grupoNome}", e arrancar todos os jogadores dele.\n\nPara prosseguir, digite exatamente: ${confirmText}`);

      if ((digito || '').trim().toUpperCase() !== confirmText) {
        showToast("Código nuclear incorreto. Abortando operação.", "error");
        return;
      }

      const t = Date.now();
      try {
        const { error } = await sbClient.from('groups').delete().eq('id', grupoId);
        if (error) throw error;
        
        // Remove da UI
        this.gruposLista = this.gruposLista.filter(g => g.id !== grupoId);
        this.abaAtiva = 'grupos'; // Volta pra tela de grupos
        
        this.adicionarLog('Supabase', 'DELETE groups', 'SUCCESS', Date.now() - t, `Grupo ${grupoNome} aniquilado`);
        await this._registrarAuditoria('NUCLEAR_DELETE_GROUP', 'groups', grupoId, { group_name: grupoNome });
        showToast(`💥 Grupo ${grupoNome} exterminado da face da terra!`, "success");
      } catch (err) {
        showToast("Erro ao tentar aniquilar grupo: " + err.message, "error");
      }
    },

    // ============ FIM: CONTROLE DA MATRIZ ============

    // ============================================================
    // PROJETO GOD MODE: TESOURARIA & PIX
    // ============================================================

    async carregarTesouraria() {
      this.tesourariaLoading = true;
      const t = Date.now();
      try {
        const { data, error } = await sbClient
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        let transacoes = data || [];
        if (transacoes.length > 0) {
          const userIds = [...new Set(transacoes.map(tx => tx.user_id))];
          const { data: perfis } = await sbClient.from('profiles').select('id, full_name, email').in('id', userIds);
          
          const perfilMap = {};
          if (perfis) {
            perfis.forEach(p => perfilMap[p.id] = p);
          }
          
          transacoes.forEach(tx => {
            tx.profiles = perfilMap[tx.user_id] || { full_name: 'Jogador Desconhecido', email: 'Sem email' };
          });
        }

        this.transacoesTesouraria = transacoes;
        this.adicionarLog('Supabase', 'SELECT transactions (Manual Join)', 'SUCCESS', Date.now() - t, `${this.transacoesTesouraria.length} registros de PIX carregados`);
      } catch (err) {
        showToast("Erro ao carregar os cofres da Tesouraria: " + err.message, "error");
        this.adicionarLog('Supabase', 'SELECT transactions', 'ERROR', Date.now() - t, err.message);
      } finally {
        this.tesourariaLoading = false;
      }
    },

    async aprovarTransacaoPix(transacaoId, userId, amount, type) {
      if (!confirm(`⚠️ Aprovar entrada de PIX no valor de R$ ${parseFloat(amount).toFixed(2)}?`)) return;
      
      // O GM decide quantas fichas injetar por esse PIX
      const inputFichas = prompt(`PIX de R$ ${parseFloat(amount).toFixed(2)} APROVADO!\n\nO jogador solicitou: "${type}".\nQuantas FICHAS DO MAGO você deseja injetar na conta dele agora? (Digite 0 para aprovar sem injetar)`);
      if (inputFichas === null) return; // Cancelou o prompt
      
      const fichas = parseInt(inputFichas);
      if (isNaN(fichas) || fichas < 0) {
        showToast("Operação cancelada. Quantidade de fichas inválida.", "error");
        return;
      }

      const t = Date.now();
      try {
        // 1. Marca transação como aprovada
        const { error: errTx } = await sbClient.from('transactions')
          .update({ status: 'approved', updated_at: new Date() })
          .eq('id', transacaoId);
        
        if (errTx) throw errTx;

        // 2. Se houver fichas, injeta na conta do cidadão
        if (fichas > 0) {
          const { data: u } = await sbClient.from('profiles').select('fichas_desafio').eq('id', userId).single();
          const novasFichas = (u?.fichas_desafio || 0) + fichas;
          await sbClient.from('profiles').update({ fichas_desafio: novasFichas }).eq('id', userId);
        }

        this.adicionarLog('Supabase', 'APPROVE PIX & INJECT', 'SUCCESS', Date.now() - t, `R$ ${amount} Aprovado. +${fichas} Fichas.`);
        await this._registrarAuditoria('APPROVE_PIX', 'transactions', transacaoId, { amount, type, injected_fichas: fichas });
        
        showToast(fichas > 0 ? `PIX Aprovado e ${fichas} fichas transferidas com sucesso!` : "PIX Aprovado! Nenhuma ficha injetada.", "success");
        this.carregarTesouraria(); // Recarrega a fila
      } catch (err) {
        showToast("Falha catastrófica ao aprovar PIX: " + err.message, "error");
      }
    },

    async rejeitarTransacao(transacaoId) {
      if (!confirm("Tem certeza que deseja RECUSAR e arquivar este PIX? O jogador não receberá as fichas.")) return;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('transactions')
          .update({ status: 'rejected', updated_at: new Date() })
          .eq('id', transacaoId);
        
        if (error) throw error;
        
        this.adicionarLog('Supabase', 'REJECT PIX', 'SUCCESS', Date.now() - t, 'PIX Movido para Rejeitados');
        await this._registrarAuditoria('REJECT_PIX', 'transactions', transacaoId, {});
        
        showToast("PIX Rejeitado e arquivado.", "error");
        this.carregarTesouraria();
      } catch (err) {
        showToast("Erro ao rejeitar PIX: " + err.message, "error");
      }
    },

    // ============ FIM: TESOURARIA & PIX ============

    // ============================================================
    // PROJETO GOD MODE: AUDITORIA (Big Brother)
    // ============================================================

    async carregarAuditoriaGlobal() {
      if (this.auditoriaLoading) return;
      this.auditoriaLoading = true;
      const t = Date.now();
      try {
        // 1. Puxa os últimos 50 palpites (Radar de usuários)
        const { data: palpites, error: errP } = await sbClient
          .from('guesses')
          .select('id, user_id, match_id, group_id, score_home, score_away, created_at, profiles(full_name, avatar_url), groups(name)')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (errP) {
          console.warn("Aviso ao puxar palpites:", errP.message);
          // Fallback caso a relação profiles/groups falhe
          const { data: fallbackPalpites } = await sbClient.from('guesses').select('*').order('created_at', { ascending: false }).limit(50);
          this.feedPalpites = fallbackPalpites || [];
        } else {
          this.feedPalpites = palpites || [];
        }

        // 2. Puxa os últimos 50 logs de auditoria do GM
        const { data: logs, error: errL } = await sbClient
          .from('audit_logs')
          .select('*, profiles!audit_logs_admin_id_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (errL) {
          console.warn("Aviso ao puxar audit_logs:", errL.message);
          const { data: fallbackLogs } = await sbClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
          this.feedAuditoria = fallbackLogs || [];
        } else {
          // Normaliza o fallback do join
          const normalLogs = logs ? logs.map(l => ({...l, profiles: l.profiles || { full_name: 'GM Oculto' }})) : [];
          this.feedAuditoria = normalLogs;
        }

        this.adicionarLog('Supabase', 'SELECT Auditoria', 'SUCCESS', Date.now() - t, 'Sincronização do Big Brother concluída');
      } catch (err) {
        showToast("Erro ao sincronizar as câmeras da Auditoria: " + err.message, "error");
      } finally {
        this.auditoriaLoading = false;
      }
    },

    // ============ FIM: AUDITORIA ============

    // ============ DESAFIOS DO GM ============

    traduzirRegra(eventType) {
      const map = {
        'Goal': '⚽ Time a marcar primeiro',
        'Goal_penalty': '⚽ Time a marcar primeiro (Pen.)',
        'Card': '🟨 Time a levar cartão primeiro',
        'Card_penalty': '🟨 Time a levar cartão primeiro (Pen.)'
      };
      return map[eventType] || eventType;
    },

    async carregarDesafiosGM() {
      if (this.desafiosLoading) return;
      this.desafiosLoading = true;
      const startTime = Date.now();

      try {
        const { data: desafios, error } = await sbClient
          .from('desafios')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Conta votos por desafio
        const desafioIds = desafios.map(d => d.id);
        let votosCount = {};
        if (desafioIds.length > 0) {
          const { data: votos } = await sbClient
            .from('user_desafios')
            .select('desafio_id')
            .in('desafio_id', desafioIds);

          if (votos) votos.forEach(v => {
            votosCount[v.desafio_id] = (votosCount[v.desafio_id] || 0) + 1;
          });
        }

        desafios.forEach(d => {
          d._votosCount = votosCount[d.id] || 0;
          d._statusJogo = null; // será preenchido pela API
          d._placarJogo = null;
        });

        this.desafiosListaGM = desafios;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT desafios + user_desafios', 'SUCCESS', duration, `${desafios.length} desafios carregados`);

        // Busca status dos jogos em background para desafios ativos
        this.enriquecerStatusJogos();
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'SELECT desafios', 'ERROR', duration, err.message);
        console.error('Erro ao carregar desafios:', err);
      } finally {
        this.desafiosLoading = false;
      }
    },

    async enriquecerStatusJogos() {
      // Pega fixture_ids únicos dos desafios
      const fixtureIds = [...new Set(this.desafiosListaGM.map(d => d.fixture_id))];
      if (fixtureIds.length === 0) return;

      const startTime = Date.now();
      try {
        const idsParam = fixtureIds.join('-');
        const resp = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${idsParam}`, {
          headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5'
          }
        });
        const json = await resp.json();

        if (json.response) {
          const statusMap = {};
          json.response.forEach(f => {
            statusMap[f.fixture.id] = {
              status: f.fixture.status.short,
              statusLong: f.fixture.status.long,
              elapsed: f.fixture.status.elapsed,
              homeGoals: f.goals.home,
              awayGoals: f.goals.away,
              homeName: f.teams.home.name,
              awayName: f.teams.away.name,
              homeLogo: f.teams.home.logo,
              awayLogo: f.teams.away.logo
            };
          });

          this.desafiosListaGM.forEach(d => {
            if (statusMap[d.fixture_id]) {
              d._statusJogo = statusMap[d.fixture_id];
              const s = statusMap[d.fixture_id];
              d._placarJogo = `${s.homeGoals ?? '-'} x ${s.awayGoals ?? '-'}`;
            }
          });
        }

        const duration = Date.now() - startTime;
        this.adicionarLog('API-Football', `GET /fixtures?ids=${fixtureIds.length} jogos`, 'SUCCESS', duration, `Status de ${fixtureIds.length} partidas carregados`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('API-Football', 'GET /fixtures (status)', 'ERROR', duration, err.message);
      }
    },

    async buscarPartidas() {
      if (!this.buscaFixture || this.buscaFixtureLoading) return;

      // Salvar no histórico
      const termo = this.buscaFixture.trim();
      if (termo) {
        let h = [termo, ...this.historicoBuscaFixtures.filter(t => t.toLowerCase() !== termo.toLowerCase())];
        this.historicoBuscaFixtures = h.slice(0, 5); // Mantém as 5 últimas
        localStorage.setItem('gm_busca_history', JSON.stringify(this.historicoBuscaFixtures));
      }

      this.buscaFixtureLoading = true;
      this.resultadoBuscaFixtures = [];

      const startTime = Date.now();
      try {
        // Busca nas ligas: Copa do Mundo (1), Brasileirão (71), Libertadores (13), Nordeste (325), Amistosos (10)
        const ligas = [1, 71, 13, 325, 10];
        const hoje = new Date();
        const from = hoje.toISOString().split('T')[0];
        const ate = new Date(hoje.getTime() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0];

        let todosJogos = [];

        for (const liga of ligas) {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures?league=${liga}&season=2026&from=${from}&to=${ate}`, {
            headers: {
              'x-rapidapi-host': 'v3.football.api-sports.io',
              'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5'
            }
          });
          const json = await resp.json();
          if (json.response) todosJogos = todosJogos.concat(json.response);
        }

        // Filtra pelo nome do time buscado
        const q = this.buscaFixture.toLowerCase();
        this.resultadoBuscaFixtures = todosJogos.filter(j =>
          j.teams.home.name.toLowerCase().includes(q) ||
          j.teams.away.name.toLowerCase().includes(q)
        ).sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

        const duration = Date.now() - startTime;
        this.adicionarLog('API-Football', `GET /fixtures busca "${this.buscaFixture}"`, 'SUCCESS', duration, `${this.resultadoBuscaFixtures.length} partidas encontradas`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('API-Football', 'GET /fixtures (busca)', 'ERROR', duration, err.message);
      } finally {
        this.buscaFixtureLoading = false;
      }
    },

    usarBuscaHistorico(termo) {
      this.buscaFixture = termo;
      this.buscarPartidas();
    },

    selecionarPartida(jogo) {
      this.novoDesafio.fixture_id = jogo.fixture.id;
      this.novoDesafio.match_name = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
      this.oraculoDesafio = { loading: true, dados: null, sugestao: null };
      this._buscarOraculoDesafio(jogo.fixture.id);
    },

    async _buscarOraculoDesafio(fixtureId) {
      try {
        const [pred, dist] = await Promise.all([
          analisarDistorcaoPalpites(fixtureId),
          this._distribuicaoLocalGM(fixtureId)
        ]);

        let zebraAlert = false;
        let maxDesvio = 0;
        if (dist.total > 0) {
          maxDesvio = Math.max(
            Math.abs(dist.homePct - pred.percent.home),
            Math.abs(dist.awayPct - pred.percent.away)
          );
          zebraAlert = maxDesvio > 25;
        }

        let sugestao;
        if (zebraAlert) {
          sugestao = { pts: 15, fichas: 8, tipo: 'Goal', zebraAlert: true,
            motivo: '🦓 Zebra Dinâmica detectada! Alto desvio entre a matemática e o bolão — alto risco, alta recompensa.' };
        } else if (maxDesvio > 15) {
          sugestao = { pts: 10, fichas: 5, tipo: 'Goal', zebraAlert: false,
            motivo: `Desvio de sentimento moderado (${maxDesvio.toFixed(0)}%). Partida com distorção interessante.` };
        } else {
          const golsEsperados = (parseFloat(pred.goals?.home) || 0) + (parseFloat(pred.goals?.away) || 0);
          const tipo = golsEsperados < 1.5 ? 'Card' : 'Goal';
          sugestao = { pts: 5, fichas: 3, tipo, zebraAlert: false,
            motivo: tipo === 'Card'
              ? 'Jogo travado esperado (< 1.5 gols) — desafio de cartão é mais provável de engajar.'
              : 'Partida equilibrada e aberta — bom para desafio de gol.' };
        }

        this.oraculoDesafio = { loading: false, dados: pred, sugestao };
      } catch {
        this.oraculoDesafio = { loading: false, dados: null, sugestao: null };
      }
    },

    aplicarSugestaoOraculo() {
      const s = this.oraculoDesafio.sugestao;
      if (!s) return;
      this.novoDesafio.event_type = s.tipo;
      this.novoDesafio.points = s.pts;
      this.novoDesafio.custo_fichas = s.fichas;
    },

    adicionarJogadorDesafio() {
      const nome = this.novoJogadorInput.trim();
      if (!nome) return;
      if (!this.novoDesafio.players.includes(nome)) {
        this.novoDesafio.players.push(nome);
      }
      this.novoJogadorInput = '';
    },

    async lancarDesafioGM() {
      if (this.desafioLancando) return;
      if (!this.novoDesafio.fixture_id || !this.novoDesafio.market_type) {
        showToast('Selecione uma partida e um mercado primeiro.', 'error');
        return;
      }

      this.desafioLancando = true;
      const startTime = Date.now();

      try {
        const payload = {
          fixture_id: Number(this.novoDesafio.fixture_id),
          match_name: this.novoDesafio.match_name,
          event_type: 'Prop', // Legacy field fallback
          market_type: this.novoDesafio.market_type,
          prop_line: parseFloat(this.novoDesafio.prop_line) || null,
          target_player_name: this.novoDesafio.target_player_name || null,
          premio_pontos: parseInt(this.novoDesafio.premio_pontos) || 10,
          points: parseInt(this.novoDesafio.premio_pontos) || 10, // Legacy fallback
          custo_fichas: parseInt(this.novoDesafio.custo_fichas) || 1,
          status: 'active'
        };

        const { error } = await sbClient
          .from('desafios')
          .insert([payload]);

        if (error) throw error;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'INSERT desafios', 'SUCCESS', duration, `Desafio Prop "${payload.market_type}" lançado`);

        showToast("Aposta tirada da cartola! Desafio lançado.", "mago");

        // Volta pra lista
        this.abaAtiva = 'desafios';
        this.carregarDesafiosGM();
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'INSERT desafios', 'ERROR', duration, err.message);
        showToast('Erro ao lançar desafio: ' + err.message, 'error');
      } finally {
        this.desafioLancando = false;
      }
    },

    selecionarVencedorUI(desafio) {
      let options = ['over', 'under'];
      if (desafio.market_type === 'btts' || desafio.market_type === 'marcador') {
        options = ['yes', 'no'];
      } else if (desafio.players && desafio.players.length > 0) {
        options = desafio.players;
      }
      this.desafioParaFinalizar = { id: desafio.id, options: options, pontos: desafio.points || desafio.premio_pontos, fixture_id: desafio.fixture_id, isEdit: false };
    },

    editarVencedorUI(desafio) {
      let options = ['over', 'under'];
      if (desafio.market_type === 'btts' || desafio.market_type === 'marcador') {
        options = ['yes', 'no'];
      } else if (desafio.players && desafio.players.length > 0) {
        options = desafio.players;
      }
      this.desafioParaFinalizar = { id: desafio.id, options: options, pontos: desafio.points || desafio.premio_pontos, fixture_id: desafio.fixture_id, isEdit: true };
    },

    nomesCoincidem(nome1, nome2) {
      if (!nome1 || !nome2) return false;
      const n1 = nome1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const n2 = nome2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (n1 === n2) return true;
      const p1 = n1.split(' ');
      const p2 = n2.split(' ');
      const last1 = p1[p1.length - 1];
      const last2 = p2[p2.length - 1];
      return (last1 === last2 && (p1[0] === p2[0] || p1[0].charAt(0) === p2[0].charAt(0)));
    },

    async resolverDesafioAPI(desafio) {
      if (!confirm('Deseja realmente obter os dados da API para resolver este desafio?')) return;
      
      const fixtureId = desafio.fixture_id;
      const eventType = desafio.event_type;
      const players = desafio.players || [];
      const cleanEventType = eventType.replace('_penalty', '');
      
      try {
        showToast('Consultando API...', 'mago');
        let jogadoresVencedores = [];

        if (cleanEventType.startsWith('CornersOver') || cleanEventType.startsWith('CardsOver')) {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, { headers: { "x-rapidapi-host": "v3.football.api-sports.io", "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5" } });
          const json = await resp.json();
          const stats = json.response || [];
          
          let total = 0;
          stats.forEach(team => {
            if (cleanEventType.startsWith('CornersOver')) {
              const s = team.statistics.find(x => x.type === 'Corner Kicks');
              if (s && s.value) total += parseInt(s.value);
            } else {
              const sy = team.statistics.find(x => x.type === 'Yellow Cards');
              const sr = team.statistics.find(x => x.type === 'Red Cards');
              if (sy && sy.value) total += parseInt(sy.value);
              if (sr && sr.value) total += parseInt(sr.value);
            }
          });
          
          const limit = parseFloat(cleanEventType.replace(/[^0-9.]/g, '')) || 0;
          const isOver = cleanEventType.startsWith('CornersOver') ? (total > limit) : (total > limit);
          const resultText = total > limit ? `Mais de ${limit}` : `Menos de ${limit}`;
          jogadoresVencedores.push(resultText);
          
        } else if (cleanEventType === 'BTTS') {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, { headers: { "x-rapidapi-host": "v3.football.api-sports.io", "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5" } });
          const json = await resp.json();
          const fixtureData = json.response && json.response[0] ? json.response[0] : null;
          if (fixtureData && fixtureData.goals.home > 0 && fixtureData.goals.away > 0) {
            jogadoresVencedores.push('Sim');
          } else {
            jogadoresVencedores.push('Não');
          }
        } else {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, { headers: { "x-rapidapi-host": "v3.football.api-sports.io", "x-rapidapi-key": "47ca2bb05eb5931347aca04964818eb5" } });
          const json = await resp.json();
          const eventos = json.response || [];
          
          eventos.forEach(evt => {
            if (evt.type === 'Goal' && (cleanEventType === 'Goal' || cleanEventType === 'Assist')) {
              players.forEach(p => {
                if (cleanEventType === 'Goal') {
                  if (this.nomesCoincidem(evt.player?.name, p)) jogadoresVencedores.push(p);
                  if (this.nomesCoincidem(evt.team?.name, p)) jogadoresVencedores.push(p);
                }
                if (cleanEventType === 'Assist' && this.nomesCoincidem(evt.assist?.name, p)) jogadoresVencedores.push(p);
              });
            } else if (evt.type === 'Card' && cleanEventType.startsWith('Card')) {
              players.forEach(p => {
                if (cleanEventType === 'CardYellow' && evt.detail?.toLowerCase().includes('yellow')) {
                  if (this.nomesCoincidem(evt.player?.name, p)) jogadoresVencedores.push(p);
                  if (this.nomesCoincidem(evt.team?.name, p)) jogadoresVencedores.push(p);
                }
                if (cleanEventType === 'CardRed' && evt.detail?.toLowerCase().includes('red')) {
                  if (this.nomesCoincidem(evt.player?.name, p)) jogadoresVencedores.push(p);
                  if (this.nomesCoincidem(evt.team?.name, p)) jogadoresVencedores.push(p);
                }
                if (cleanEventType === 'Card') {
                  if (this.nomesCoincidem(evt.player?.name, p)) jogadoresVencedores.push(p);
                  if (this.nomesCoincidem(evt.team?.name, p)) jogadoresVencedores.push(p);
                }
              });
            }
          });
        }

        if (jogadoresVencedores.length > 0) {
          showToast(`A API encontrou o vencedor: ${jogadoresVencedores[0]}`, 'success');
          this.selecionarVencedorUI(desafio);
        } else {
          showToast('A API não encontrou nenhuma das opções como vencedora ainda.', 'error');
        }
      } catch (err) {
        showToast('Erro ao consultar API: ' + err.message, 'error');
      }
    },

    async confirmarVencedorGM(vencedor) {
      const d = this.desafioParaFinalizar;
      if (!d || !vencedor || this.desafioFinalizando) return;
      this.desafioFinalizando = true;

      const startTime = Date.now();
      try {
        if (d.isEdit) {
          // Zera os pontos distribuídos anteriormente
          await sbClient
            .from('user_desafios')
            .update({ points_awarded: 0 })
            .eq('desafio_id', d.id);
        }

        const { error: e1 } = await sbClient
          .from('desafios')
          .update({ status: 'resolved', vencedor })
          .eq('id', d.id);
        if (e1) throw e1;

        // Busca votos corretos e distribui pontos
        const { data: votos } = await sbClient
          .from('user_desafios')
          .select('id')
          .eq('desafio_id', d.id)
          .eq('chosen_player', vencedor);

        if (votos?.length > 0) {
          const ids = votos.map(v => v.id);
          await sbClient.from('user_desafios')
            .update({ points_awarded: d.pontos })
            .in('id', ids);
        }

        const nVenc = votos?.length || 0;
        this.adicionarLog('Supabase', 'UPDATE desafios + user_desafios (resolver)', 'SUCCESS', Date.now() - startTime, `Vencedor: ${vencedor} | ${nVenc} premiado(s)`);
        showToast(`Desafio resolvido! ${nVenc} jogador(es) ganharam +${d.pontos} pts 🏆`, 'mago');

        this.desafioParaFinalizar = null;
        this.carregarDesafiosGM();
      } catch (err) {
        this.adicionarLog('Supabase', 'UPDATE desafios (resolver)', 'ERROR', Date.now() - startTime, err.message);
        showToast('Erro ao resolver desafio: ' + err.message, 'error');
      } finally {
        this.desafioFinalizando = false;
      }
    },

    traduzirAdvice(texto) {
      return traduzirAdviceOraculoAPI(texto);
    },

    async excluirDesafioGM(desafioId) {
      if (!confirm('⚠️ Tem certeza? Isso vai APAGAR o desafio e os votos dos jogadores permanentemente!')) return;

      const startTime = Date.now();
      try {
        // Deleta votos primeiro
        await sbClient
          .from('user_desafios')
          .delete()
          .eq('desafio_id', desafioId);

        // Depois deleta o desafio
        const { error } = await sbClient
          .from('desafios')
          .delete()
          .eq('id', desafioId);

        if (error) throw error;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'DELETE desafios + user_desafios', 'SUCCESS', duration, `Desafio ${desafioId.substring(0, 8)} excluído`);

        this.carregarDesafiosGM();
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'DELETE desafios', 'ERROR', duration, err.message);
        showToast('Erro ao excluir: ' + err.message, 'error');
      }
    },

    async atualizarLimiteGrupoManual(grupoId, novoLimite) {
      const limit = parseInt(novoLimite);
      if (isNaN(limit) || limit < 1) {
        showToast("Limite inválido", "error");
        return;
      }
      const startTime = Date.now();
      try {
        const { error } = await sbClient
          .from('groups')
          .update({ max_participants: limit })
          .eq('id', grupoId);

        if (error) throw error;

        showToast("Limite do grupo atualizado com sucesso!", "success");
        this.adicionarLog('Supabase', `UPDATE groups SET max_participants = ${limit}`, 'SUCCESS', Date.now() - startTime, `Limite do grupo ${grupoId} atualizado para ${limit}`);
        
        // Atualiza a lista local
        const g = this.gruposLista.find(item => item.id === grupoId);
        if (g) g.max_participants = limit;
        if (this.grupoSelecionado && this.grupoSelecionado.id === grupoId) {
          this.grupoSelecionado.max_participants = limit;
        }
      } catch (err) {
        showToast("Erro ao atualizar limite: " + err.message, "error");
        this.adicionarLog('Supabase', `UPDATE groups`, 'ERROR', Date.now() - startTime, err.message);
      }
    },

    async atualizarLimiteUsuarioManual(usuarioId, novoLimite) {
      const limit = parseInt(novoLimite);
      if (isNaN(limit) || limit < 1) {
        showToast("Limite inválido", "error");
        return;
      }
      const startTime = Date.now();
      try {
        const { error } = await sbClient
          .from('profiles')
          .update({ max_grupos: limit })
          .eq('id', usuarioId);

        if (error) throw error;

        showToast("Limite de grupos do jogador atualizado com sucesso!", "success");
        this.adicionarLog('Supabase', `UPDATE profiles SET max_grupos = ${limit}`, 'SUCCESS', Date.now() - startTime, `Limite de grupos do usuário ${usuarioId} atualizado para ${limit}`);
        
        // Atualiza a lista local
        const u = this.usuariosLista.find(item => item.id === usuarioId);
        if (u) u.max_grupos = limit;
      } catch (err) {
        showToast("Erro ao atualizar limite: " + err.message, "error");
        this.adicionarLog('Supabase', `UPDATE profiles`, 'ERROR', Date.now() - startTime, err.message);
      }
    },

    async migrarJogadores(grupoOrigemId, grupoDestinoId, deletarOrigem) {
      if (!grupoOrigemId || !grupoDestinoId) {
        showToast("Selecione os grupos de origem e destino!", "error");
        return;
      }
      if (grupoOrigemId === grupoDestinoId) {
        showToast("Os grupos de origem e destino não podem ser iguais!", "error");
        return;
      }
      const startTime = Date.now();
      this.migracaoLoading = true;
      try {
        // 1. Busca os membros do grupo de origem
        const { data: dataMembros, error: errorOrigem } = await sbClient
          .from('group_members')
          .select('*')
          .eq('group_id', grupoOrigemId);

        if (errorOrigem) throw errorOrigem;
        if (!dataMembros || dataMembros.length === 0) {
          showToast("Nenhum jogador encontrado no grupo de origem!", "error");
          return;
        }

        // 2. Busca os membros do grupo de destino para não duplicar
        const { data: membrosDestino, error: errorDestino } = await sbClient
          .from('group_members')
          .select('user_id')
          .eq('group_id', grupoDestinoId);

        if (errorDestino) throw errorDestino;
        const membrosDestinoSet = new Set(membrosDestino.map(m => m.user_id));

        // 3. Prepara a lista de novos membros para inserção
        const novosMembros = [];
        dataMembros.forEach(m => {
          if (!membrosDestinoSet.has(m.user_id)) {
            novosMembros.push({
              group_id: grupoDestinoId,
              user_id: m.user_id,
              role: m.role || 'member'
            });
          }
        });

        if (novosMembros.length > 0) {
          const { error: insertError } = await sbClient
            .from('group_members')
            .insert(novosMembros);

          if (insertError) throw insertError;
        }

        // 4. Se for para mover (deletar da origem), deleta os membros copiados
        if (deletarOrigem) {
          const userIdsParaDeletar = dataMembros.map(m => m.user_id);
          const { error: deleteError } = await sbClient
            .from('group_members')
            .delete()
            .eq('group_id', grupoOrigemId)
            .in('user_id', userIdsParaDeletar);

          if (deleteError) throw deleteError;
          showToast(`Migração concluída! ${novosMembros.length} jogadores movidos com sucesso.`, "success");
        } else {
          showToast(`Cópia concluída! ${novosMembros.length} jogadores adicionados ao grupo de destino.`, "success");
        }

        this.adicionarLog('Supabase', `MIGRATION ${grupoOrigemId} -> ${grupoDestinoId}`, 'SUCCESS', Date.now() - startTime, `Transferidos ${novosMembros.length} membros.`);
        
        // Limpa e recarrega
        this.carregarGrupos();
      } catch (err) {
        showToast("Erro na migração: " + err.message, "error");
        this.adicionarLog('Supabase', `MIGRATION`, 'ERROR', Date.now() - startTime, err.message);
      } finally {
        this.migracaoLoading = false;
      }
    },

    // Carrega as regras de pontos do grupo pelo código de convite, pra usar no EV.
    async focarGrupo() {
      const code = (this.grupoFoco.code || '').trim().toUpperCase();
      if (!code) return;
      this.grupoFoco.carregando = true;
      this.grupoFoco.erro = null;
      const t = Date.now();
      try {
        const { data, error } = await sbClient
          .from('groups')
          .select('id, name, pt_placar_exato, pt_vencedor_saldo, pt_empate_nao_exato, pt_apenas_vencedor, regra_zebra_dinamica, mult_fase_final')
          .eq('invite_code', code)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          this.grupoFoco.id = null; this.grupoFoco.nome = null; this.grupoFoco.regras = null;
          this.grupoFoco.erro = 'Grupo não encontrado com esse código.';
          return;
        }
        this.grupoFoco.id = data.id;
        this.grupoFoco.nome = data.name;
        this.grupoFoco.regras = {
          exato: data.pt_placar_exato ?? 12,
          saldo: data.pt_vencedor_saldo ?? 7,
          empate: data.pt_empate_nao_exato ?? 6,
          vencedor: data.pt_apenas_vencedor ?? 3,
          zebra: data.regra_zebra_dinamica === true,
          multFase: data.mult_fase_final ?? 2
        };
        this.adicionarLog('Supabase', `SELECT groups (foco ${code})`, 'SUCCESS', Date.now() - t, data.name);
        if (typeof showToast === 'function') showToast('Foco no grupo ' + data.name + ' ✓', 'success');
        // Salva no histórico (code + nome) pra reuso rápido sem digitar
        let hf = [{ code, nome: data.name }, ...this.grupoFocoHistorico.filter(g => g.code !== code)];
        this.grupoFocoHistorico = hf.slice(0, 5);
        try { localStorage.setItem('gm_grupo_foco_history', JSON.stringify(this.grupoFocoHistorico)); } catch (_) {}
        // Se já tinha uma análise aberta, reanalisa com as regras do grupo
        if (this.oraculo.fixtureId) this.analisarOraculoGM();
      } catch (err) {
        this.grupoFoco.erro = err.message;
        this.adicionarLog('Supabase', 'SELECT groups (foco)', 'ERROR', Date.now() - t, err.message);
      } finally {
        this.grupoFoco.carregando = false;
      }
    },

    // Reusa um grupo do histórico (clique no chip) sem digitar o código
    usarFocoHistorico(code) {
      this.grupoFoco.code = code;
      this.focarGrupo();
    },

    async analisarOraculoGM() {
      if (!this.oraculo.fixtureId) return;
      this.oraculo.loading = true;
      this.oraculo.predicoes = null;
      this.oraculo.distribuicao = null;
      this.oraculo.distorcao = null;
      this.oraculo.estrategia = null;
      this.oraculo.placaresProvaveis = null;
      this.oraculo.tabelaPlacares = null;
      this.oraculo.golsInfo = null;
      this.oraculo.zebraRadar = null;
      this.oraculo.quantData = null;
      this.oraculo.erro = null;
      const fId = Number(this.oraculo.fixtureId);
      const t = Date.now();
      try {
        const [pred, dist, odds] = await Promise.all([
          analisarDistorcaoPalpites(fId),
          this._distribuicaoLocalGM(fId, this.grupoFoco.id),
          this._fetchOddsOraculo(fId)
        ]);
        this.oraculo.predicoes = pred;
        this.oraculo.quantData = pred;
        this.oraculo.distribuicao = dist;
        const placares = odds.placares;
        if (placares) this._calcEVPlacares(placares, dist);
        this.oraculo.placaresProvaveis = placares;
        this.oraculo.golsInfo = odds.gols;
        if (dist.total > 0) {
          this.oraculo.distorcao = {
            home: (dist.homePct - pred.percent.home).toFixed(1),
            draw: (dist.drawPct - pred.percent.draw).toFixed(1),
            away: (dist.awayPct - pred.percent.away).toFixed(1),
            zebraAlert: Math.max(Math.abs(dist.homePct - pred.percent.home), Math.abs(dist.awayPct - pred.percent.away)) > 25
          };
        }
        this.oraculo.estrategia = this._calcEstrategiaPlacar(pred, placares);
        this.oraculo.tabelaPlacares = placares ? this._agruparPlacares(placares) : null;
        this.oraculo.zebraRadar = this.grupoFoco.id ? await this._zebraRadarGrupo(fId, this.grupoFoco.id) : null;
        this.adicionarLog('API-Football', `/predictions?fixture=${fId}`, 'SUCCESS', Date.now() - t, `${pred.teams?.home?.name} vs ${pred.teams?.away?.name}`);
        this._popularDesafioRapido(pred, dist);
      } catch(err) {
        this.oraculo.erro = err.message;
        this.adicionarLog('API-Football', `/predictions?fixture=${fId}`, 'ERROR', Date.now() - t, err.message);
      } finally {
        this.oraculo.loading = false;
      }
    },

    // Busca as odds (1x) e extrai: placares prováveis (Exact Score) + gols
    // esperados (Goals Over/Under). Retorna { placares, gols }.
    async _fetchOddsOraculo(fixtureId) {
      try {
        return await ORACLE.oddsFull(fixtureId);
      } catch (_) {
        return { placares: null, gols: null };
      }
    },

    // Estima gols esperados e total mais provável a partir do mercado Over/Under.
    _calcGolsEsperados(bks) {
      const linhas = {};
      bks.forEach(bk => {
        const bet = (bk.bets || []).find(b => b.name === 'Goals Over/Under');
        if (!bet) return;
        (bet.values || []).forEach(v => {
          const m = String(v.value).match(/^(Over|Under)\s+([\d.]+)$/i);
          if (!m) return;
          const odd = parseFloat(v.odd);
          if (!odd || odd <= 1) return;
          const linha = m[2];
          if (!linhas[linha]) linhas[linha] = { over: [], under: [] };
          linhas[linha][m[1].toLowerCase()].push(odd);
        });
      });
      const pOver = {};
      Object.keys(linhas).forEach(l => {
        const o = linhas[l].over, u = linhas[l].under;
        if (!o.length || !u.length) return;
        const avgO = o.reduce((a, b) => a + b, 0) / o.length;
        const avgU = u.reduce((a, b) => a + b, 0) / u.length;
        const iO = 1 / avgO, iU = 1 / avgU;
        pOver[parseFloat(l)] = iO / (iO + iU);
      });
      if (Object.keys(pOver).length === 0) return null;
      const distK = {};
      if (pOver[0.5] != null) distK[0] = Math.max(0, 1 - pOver[0.5]);
      for (let k = 1; k <= 6; k++) {
        const lo = k - 0.5, hi = k + 0.5;
        if (pOver[lo] != null) {
          const pHi = pOver[hi] != null ? pOver[hi] : 0;
          distK[k] = Math.max(0, pOver[lo] - pHi);
        }
      }
      let esperado = 0, soma = 0, maisProv = null, maxP = -1;
      Object.keys(distK).forEach(k => {
        esperado += Number(k) * distK[k];
        soma += distK[k];
        if (distK[k] > maxP) { maxP = distK[k]; maisProv = Number(k); }
      });
      if (soma <= 0) return null;
      return { esperado: esperado / soma, maisProvavel: maisProv };
    },

    // Pontos de um palpite contra um resultado real. Usa as regras do grupo
    // focado, com fallback na escala padrão 12/7/6/3.
    _pontosPalpite(ph, pa, rh, ra) {
      const r = (this.grupoFoco && this.grupoFoco.regras) ? this.grupoFoco.regras : { exato: 12, saldo: 7, empate: 6, vencedor: 3 };
      if (ph === rh && pa === ra) return r.exato;
      const vp = ph > pa ? 'h' : (ph < pa ? 'a' : 'e');
      const vr = rh > ra ? 'h' : (rh < ra ? 'a' : 'e');
      if (vp !== vr) return 0;
      if (vr === 'e') return r.empate;
      return Math.abs(ph - pa) === Math.abs(rh - ra) ? r.saldo : r.vencedor;
    },

    // EV (pontos esperados) de cada placar: soma os pontos contra cada resultado
    // possível, ponderado pela probabilidade. Aplica zebra 2x (aprox.) quando a
    // distribuição do bolão mostra <15% no resultado vencedor.
    _calcEVPlacares(placares, distribuicao) {
      const crowd = distribuicao && distribuicao.total > 0 ? distribuicao : null;
      // Zebra: se não há grupo focado, mantém a aproximação; se há, respeita a regra do grupo.
      const zebraOn = !this.grupoFoco || !this.grupoFoco.regras || this.grupoFoco.regras.zebra;
      const multMata = (this.grupoFoco && this.grupoFoco.regras && this.grupoFoco.regras.multFase) ? this.grupoFoco.regras.multFase : 2;
      const isMata = !!this.oraculo.mataMata;
      placares.forEach(cand => {
        let ev = 0;
        placares.forEach(real => {
          let pts = this._pontosPalpite(cand.home, cand.away, real.home, real.away);
          if (pts > 0) {
            if (zebraOn && crowd) {
              const w = real.winner;
              const pctW = w === 'home' ? crowd.homePct : (w === 'away' ? crowd.awayPct : crowd.drawPct);
              if (pctW != null && pctW < 15) pts *= 2;
            }
            if (isMata) pts *= multMata;
          }
          ev += (real.probNorm || 0) * pts;
        });
        cand.ev = ev;
      });
      return placares;
    },

    // Recalcula só a sugestão das 2 contas (ao trocar o modo) sem refazer a busca.
    recalcEstrategia() {
      if (this.oraculo.placaresProvaveis) {
        this.oraculo.estrategia = this._calcEstrategiaPlacar(this.oraculo.predicoes, this.oraculo.placaresProvaveis);
      }
    },

    // Radar de zebra do grupo focado: quem cravou cada resultado e o que acontece
    // ao adicionar 1 ou 2 contas (mantém a zebra <15% ou estoura ≥15%).
    async _zebraRadarGrupo(fixtureId, groupId) {
      if (!groupId) return null;
      const { data: gs, error } = await sbClient
        .from('guesses')
        .select('user_id, score_home, score_away')
        .eq('match_id', fixtureId)
        .eq('group_id', groupId);
      if (error || !gs || gs.length === 0) return { total: 0, resultados: [] };
      const ids = [...new Set(gs.map(g => g.user_id))];
      const nomes = {};
      const { data: profs } = await sbClient.from('profiles').select('id, full_name').in('id', ids);
      (profs || []).forEach(p => { nomes[p.id] = (p.full_name || 'Participante').trim().split(/\s+/)[0]; });
      const buckets = { home: [], draw: [], away: [] };
      gs.forEach(g => {
        const w = g.score_home > g.score_away ? 'home' : (g.score_home < g.score_away ? 'away' : 'draw');
        buckets[w].push(nomes[g.user_id] || 'Participante');
      });
      const total = gs.length;
      const mk = (key) => {
        const arr = buckets[key];
        const count = arr.length;
        const pct = total ? (count / total) * 100 : 0;
        return {
          key, count, nomes: arr, pct,
          isZebra: total > 0 && pct < 15,
          pct1: ((count + 1) / (total + 1)) * 100,
          pct2: ((count + 2) / (total + 2)) * 100
        };
      };
      return { total, resultados: [mk('home'), mk('draw'), mk('away')] };
    },

    // Agrupa os placares por resultado (Casa / Empate / Fora), ordena por odd
    // (menor = mais provável) e limita a 6 por coluna — formato tabela do mercado.
    _agruparPlacares(lista) {
      const fmt = arr => arr
        .slice()
        .sort((a, b) => a.oddMedia - b.oddMedia)
        .slice(0, 6)
        .map(p => ({ placar: p.placar, odd: p.oddMedia.toFixed(2), pct: Math.round((p.probNorm || 0) * 100), ev: (typeof p.ev === 'number' ? p.ev.toFixed(1) : null) }));
      return {
        casa: fmt(lista.filter(p => p.winner === 'home')),
        empate: fmt(lista.filter(p => p.winner === 'empate')),
        fora: fmt(lista.filter(p => p.winner === 'away'))
      };
    },

    // Sugere placares pras 2 contas (Você + Gaby). Prioriza as odds de placar
    // exato; se não houver, cai numa heurística por probabilidade + gols.
    _calcEstrategiaPlacar(pred, placares) {
      // 1) Preferência: escolhe pelos PONTOS ESPERADOS (EV); senão, pela prob.
      if (placares && placares.length >= 1) {
        const temEV = placares.some(p => typeof p.ev === 'number');
        const ord = placares.slice().sort((a, b) => temEV ? ((b.ev || 0) - (a.ev || 0)) : ((b.prob || 0) - (a.prob || 0)));
        const c1 = ord[0];
        const cacar = (this.oraculo && this.oraculo.modoEstrategia === 'cacar');
        // Caçar placar: 2ª conta vai no 2º melhor placar (mesmo vencedor ok) → dobra a chance do exato.
        // Cobrir cenários (hedge): 2ª conta vai no melhor placar de OUTRO resultado.
        const c2 = cacar
          ? (ord[1] || c1)
          : (ord.find(p => p.winner !== c1.winner) || ord[1] || c1);
        const pc = x => Math.round((x.probNorm || x.prob || 0) * 100);
        const nomeRes = w => w === 'home' ? (pred && pred.teams && pred.teams.home ? pred.teams.home.name : 'Casa') : (w === 'away' ? (pred && pred.teams && pred.teams.away ? pred.teams.away.name : 'Fora') : 'o empate');
        const alvo2 = c2.winner === 'empate' ? 'o empate' : ('a vitória de ' + nomeRes(c2.winner));
        const confianca = c1.probNorm >= 0.13 ? 'alta' : (c1.probNorm >= 0.09 ? 'média' : 'baixa');
        const ev1 = temEV ? ` (~${c1.ev.toFixed(1)} pts esperados)` : '';
        const ev2 = temEV ? ` (~${c2.ev.toFixed(1)} pts)` : '';
        const resumo = cacar
          ? `🎯 Caçar placar: as duas contas vão nos 2 placares de maior EV (${c1.placar}${ev1} e ${c2.placar}${ev2}) pra dobrar a chance de cravar o exato quando o jogo sair como esperado.`
          : (temEV
            ? `🛡️ Cobrir cenários: o melhor placar é ${c1.placar}${ev1} — ${pc(c1)}% no mercado. A 2ª conta cobre ${alvo2} com ${c2.placar}${ev2}, pra não ficar refém de um resultado só.`
            : `O cenário mais provável é ${c1.placar} (${pc(c1)}%). A 2ª conta cobre ${alvo2} com ${c2.placar} (${pc(c2)}%).`);
        return {
          fonte: 'odds',
          conta1: c1.placar, conta2: c2.placar, confianca, resumo,
          homeName: (pred && pred.teams && pred.teams.home ? pred.teams.home.name : 'Casa'),
          awayName: (pred && pred.teams && pred.teams.away ? pred.teams.away.name : 'Fora'),
          top: ord.slice(0, 5).map(p => ({ placar: p.placar, pct: pc(p) }))
        };
      }
      // 2) Fallback: heurística por probabilidade + gols esperados.
      if (!pred || !pred.percent) return null;
      const pH = Number(pred.percent.home) || 0;
      const pD = Number(pred.percent.draw) || 0;
      const pA = Number(pred.percent.away) || 0;
      const homeName = pred.teams?.home?.name || 'Casa';
      const awayName = pred.teams?.away?.name || 'Fora';
      const favSide = pH >= pA ? 'home' : 'away';
      const favProb = Math.max(pH, pA);
      const favName = favSide === 'home' ? homeName : awayName;

      const gH = Math.abs(parseFloat(pred.goals?.home));
      const gA = Math.abs(parseFloat(pred.goals?.away));
      const temGols = !isNaN(gH) && !isNaN(gA) && (gH > 0 || gA > 0);

      const fmt = (h, a) => `${h}-${a}`;
      const winScore = (side, fg, og) => side === 'home' ? fmt(fg, og) : fmt(og, fg); // fg = gols do favorito

      let fgBase = 2, ogBase = 1;
      if (temGols) {
        const favG = favSide === 'home' ? gH : gA;
        const dogG = favSide === 'home' ? gA : gH;
        fgBase = Math.max(1, Math.round(favG));
        ogBase = Math.max(0, Math.round(dogG));
        if (fgBase <= ogBase) fgBase = ogBase + 1;
      }

      let conta1, conta2, confianca, resumo;
      if (favProb >= 55) {
        confianca = 'alta';
        conta1 = winScore(favSide, fgBase, ogBase);
        conta2 = winScore(favSide, fgBase + 1, ogBase);
        resumo = `${favName} é favorito forte (${favProb.toFixed(0)}%). As duas contas cravam a vitória dele em placares diferentes pra aumentar a chance de placar exato — qualquer vitória já garante os pontos de vencedor nas duas.`;
      } else if (favProb >= 45 && pD >= 27) {
        confianca = 'média';
        conta1 = winScore(favSide, fgBase, ogBase);
        conta2 = '1-1';
        resumo = `Equilibrado: ${favName} levemente favorito (${favProb.toFixed(0)}%) e empate provável (${pD.toFixed(0)}%). Uma conta vai na vitória do favorito e a outra cobre o empate (1-1).`;
      } else {
        confianca = 'baixa';
        conta1 = '1-1';
        conta2 = winScore(favSide, Math.max(2, fgBase), ogBase);
        resumo = `Jogo aberto, sem favorito claro. Cobrimos o empate (1-1) numa conta e a vitória magra do leve favorito na outra.`;
      }
      return { fonte: 'heuristica', conta1, conta2, confianca, resumo, favName, homeName, awayName };
    },

    _popularDesafioRapido(pred, dist) {
      const zAlert = this.oraculo.distorcao?.zebraAlert || false;
      const maxD = dist.total > 0
        ? Math.max(Math.abs(dist.homePct - pred.percent.home), Math.abs(dist.awayPct - pred.percent.away))
        : 0;
      const golsEsp = (parseFloat(pred.goals?.home) || 0) + (parseFloat(pred.goals?.away) || 0);

      let eventType, pts, fichas, motivo;
      if (zAlert) {
        eventType = 'Goal'; pts = 15; fichas = 8;
        motivo = '🦓 Zebra Dinâmica — alto risco, alta recompensa';
      } else if (maxD > 15) {
        eventType = 'Goal'; pts = 10; fichas = 5;
        motivo = `Distorção ${maxD.toFixed(0)}% — desafio de nível médio`;
      } else {
        eventType = golsEsp < 1.5 ? 'Card' : 'Goal';
        pts = 5; fichas = 3;
        motivo = eventType === 'Card'
          ? `Jogo travado (${golsEsp.toFixed(1)} gols) — cartão é mais provável`
          : 'Partida equilibrada — desafio de gol padrão';
      }
      const homeName = pred.teams?.home?.name || 'Time da Casa';
      const awayName = pred.teams?.away?.name || 'Time Visitante';
      const players = eventType.startsWith('Goal')
        ? [homeName, awayName, 'Nenhum gol']
        : [homeName, awayName];

      this.desafioRapido = { ...this.desafioRapido, eventType, pts, fichas, motivo, players, jogadorInput: '' };
    },

    recalcularOpcoesPorEvento() {
      const homeName = this.oraculo.predicoes?.teams?.home?.name || 'Time da Casa';
      const awayName = this.oraculo.predicoes?.teams?.away?.name || 'Time Visitante';
      const keeps = this.desafioRapido.players.filter(p => p !== homeName && p !== awayName && p !== 'Nenhum gol');
      const base = this.desafioRapido.eventType.startsWith('Goal')
        ? [homeName, awayName, 'Nenhum gol']
        : [homeName, awayName];
      this.desafioRapido.players = [...base, ...keeps];
    },

    sugerirPtsParaFichas() {
      const f = this.desafioRapido.fichas;
      if (!f || f <= 0) return '';
      if (f <= 2) {
        const min = Math.round(f * 2);
        const max = Math.round(f * 2.5);
        return `💡 Recomendado: ${min} a ${max} pts`;
      } else if (f <= 5) {
        const min = Math.round(f * 2.5);
        const max = Math.round(f * 3);
        return `💡 Recomendado: ${min} a ${max} pts`;
      } else {
        const ideal = Math.round(f * 2);
        return `⚠️ Nível Sniper — Recomendado: ${ideal} pts (acima disso desequilibra o ranking)`;
      }
    },

    adicionarOpcaoDesafio() {
      const nome = this.desafioRapido.jogadorInput.trim();
      if (!nome) return;
      if (!this.desafioRapido.players.includes(nome)) this.desafioRapido.players.push(nome);
      this.desafioRapido.jogadorInput = '';
    },

    async lancarDesafioDoOraculo() {
      if (this.desafioRapido.lancando) return;
      if (!this.oraculo.fixtureId || this.desafioRapido.players.length < 2) {
        showToast('Adicione pelo menos 2 opções antes de lançar.', 'error');
        return;
      }
      this.desafioRapido.lancando = true;
      const matchName = this.oraculo.predicoes?.teams
        ? `${this.oraculo.predicoes.teams.home.name} vs ${this.oraculo.predicoes.teams.away.name}`
        : `Fixture #${this.oraculo.fixtureId}`;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('desafios').insert([{
          fixture_id: Number(this.oraculo.fixtureId),
          match_name: matchName,
          event_type: this.desafioRapido.eventType,
          points: this.desafioRapido.pts,
          custo_fichas: this.desafioRapido.fichas,
          players: this.desafioRapido.players,
          status: 'active'
        }]);
        if (error) throw error;
        this.adicionarLog('Supabase', 'INSERT desafios (via Oráculo)', 'SUCCESS', Date.now() - t, matchName);
        showToast(`⚡ Desafio lançado! "${matchName}" está ativo.`, 'mago');
        this.desafioRapido.players = [];
        this.desafioRapido.jogadorInput = '';
        this.abaAtiva = 'desafios';
        this.carregarDesafiosGM();
      } catch(err) {
        this.adicionarLog('Supabase', 'INSERT desafios', 'ERROR', Date.now() - t, err.message);
        showToast('Erro ao lançar: ' + err.message, 'error');
      } finally {
        this.desafioRapido.lancando = false;
      }
    },

    async _distribuicaoLocalGM(fixtureId, groupId) {
      let q = sbClient.from('guesses').select('score_home, score_away').eq('match_id', fixtureId);
      if (groupId) q = q.eq('group_id', groupId);
      const { data, error } = await q;
      if (error || !data || data.length === 0) return { total: 0, homePct: 0, drawPct: 0, awayPct: 0, raw: { home: 0, draw: 0, away: 0 } };
      let home = 0, draw = 0, away = 0;
      data.forEach(g => { if (g.score_home > g.score_away) home++; else if (g.score_home < g.score_away) away++; else draw++; });
      const total = data.length;
      return { total, homePct: (home/total)*100, drawPct: (draw/total)*100, awayPct: (away/total)*100, raw: { home, draw, away } };
    },

    // ============================================================
    // MÓDULO ISOLADO: EVENTO TELÃO — leads_evento_telao
    // (nenhuma destas funções toca em profiles/groups/guesses)
    // ============================================================
    async carregarTelao() {
      this.telaoLoading = true;
      const t = Date.now();
      try {
        const { data, error } = await sbClient
          .from('leads_evento_telao')
          .select('id, nome, whatsapp, palpite, numero_sorte, evento, criado_em')
          .eq('evento', this.telaoEvento)
          .order('criado_em', { ascending: false });
        if (error) throw error;
        this.telaoLeads = data || [];
        this.adicionarLog('Supabase', 'SELECT leads_evento_telao', 'SUCCESS', Date.now() - t, `${this.telaoLeads.length} leads`);

        // Checa se o evento está marcado como ATIVO no banco (marcador especial)
        const { data: activeCheck } = await sbClient.from('evento_sorteio_telao').select('id').eq('evento', 'CONFIG_ATIVO_' + this.telaoEvento).limit(1);
        this.eventoAtivo = (activeCheck && activeCheck.length > 0);

        // Checa se os palpites estão TRAVADOS (jogo começou)
        const { data: lockCheck } = await sbClient.from('evento_sorteio_telao').select('id').eq('evento', 'CONFIG_TRAVADO_' + this.telaoEvento).limit(1);
        this.palpitesTravados = (lockCheck && lockCheck.length > 0);

      } catch (err) {
        this.adicionarLog('Supabase', 'SELECT leads_evento_telao', 'ERROR', Date.now() - t, err.message);
        showToast('Erro ao carregar leads do telão: ' + err.message, 'error');
      } finally {
        this.telaoLoading = false;
      }
    },

    async alternarStatusEvento() {
      if (!this.telaoEvento) return;
      this.iniciandoEvento = true;
      try {
        if (this.eventoAtivo) {
          await sbClient.from('evento_sorteio_telao').delete().eq('evento', 'CONFIG_ATIVO_' + this.telaoEvento);
          this.eventoAtivo = false;
          showToast('Evento finalizado para os participantes.', 'info');
        } else {
          await sbClient.from('evento_sorteio_telao').insert({
            evento: 'CONFIG_ATIVO_' + this.telaoEvento,
            numero_sorte: 'STATUS',
            nome: 'ATIVO'
          });
          this.eventoAtivo = true;
          showToast('Evento INICIADO! Botão liberado para os participantes.', 'success');
        }
      } catch (e) {
        showToast('Erro ao alternar status do evento.', 'error');
      } finally {
        this.iniciandoEvento = false;
      }
    },

    // Trava/destrava o cadastro público de palpites (quando o jogo começa)
    async alternarTravaPalpites() {
      if (!this.telaoEvento) return;
      this.travandoPalpites = true;
      try {
        if (this.palpitesTravados) {
          await sbClient.from('evento_sorteio_telao').delete().eq('evento', 'CONFIG_TRAVADO_' + this.telaoEvento);
          this.palpitesTravados = false;
          showToast('Palpites LIBERADOS novamente.', 'success');
        } else {
          await sbClient.from('evento_sorteio_telao').insert({
            evento: 'CONFIG_TRAVADO_' + this.telaoEvento,
            numero_sorte: 'STATUS',
            nome: 'TRAVADO'
          });
          this.palpitesTravados = true;
          showToast('🔒 Palpites TRAVADOS. Quem abrir o link agora entra só no sorteio (sem palpite).', 'info');
        }
      } catch (e) {
        showToast('Erro ao travar/liberar palpites.', 'error');
      } finally {
        this.travandoPalpites = false;
      }
    },

    // Distribuição dos palpites por placar (para o Modo Telão dos Palpites)
    distribuicaoPalpitesTelao() {
      const mapa = {}; let total = 0;
      for (const l of this.telaoLeads) {
        const m = String(l.palpite || '').match(/(\d+)\s*x\s*(\d+)/i);
        if (!m) continue;
        const casa = parseInt(m[1], 10), fora = parseInt(m[2], 10);
        const key = casa + 'x' + fora;
        if (!mapa[key]) mapa[key] = { casa, fora, count: 0 };
        mapa[key].count++; total++;
      }
      return Object.values(mapa)
        .map(o => ({ ...o, pct: total ? Math.round((o.count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);
    },

    abrirTelaoPalpites() {
      if (!this.telaoLeads.length) { showToast('Sem palpites pra mostrar ainda.', 'error'); return; }
      this.telaoApresentacaoPalpites = true;
      try { const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen(); } catch (_) {}
    },
    fecharTelaoPalpites() {
      this.telaoApresentacaoPalpites = false;
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (_) {}
    },

    // Filtra quem cravou exatamente o placar digitado pelo GM
    telaoAcertadores() {
      const c = this.telaoPlacar.casa, f = this.telaoPlacar.fora;
      if (c === '' || c === null || f === '' || f === null) return [];
      return this.telaoLeads.filter(lead => {
        const m = String(lead.palpite || '').match(/(\d+)\s*x\s*(\d+)/i);
        if (!m) return false;
        return parseInt(m[1], 10) === parseInt(c, 10) && parseInt(m[2], 10) === parseInt(f, 10);
      });
    },

    // Define o conjunto do sorteio: todos OU só quem acertou o placar.
    // Retorna null (e avisa) se não der pra sortear.
    _poolSorteio(soAcertadores) {
      if (soAcertadores) {
        if (this.telaoPlacar.casa === '' || this.telaoPlacar.fora === '') {
          showToast('Digite o placar final no card "Quem Acertou o Placar" primeiro.', 'error');
          return null;
        }
        const ac = this.telaoAcertadores();
        if (!ac.length) { showToast('Ninguém acertou esse placar. 😬', 'error'); return null; }
        return ac;
      }
      if (!this.telaoLeads.length) { showToast('Nenhum participante para sortear ainda.', 'error'); return null; }
      return this.telaoLeads;
    },

    // Sorteio (aqui no painel): geral OU só entre os acertadores
    realizarSorteioTelao(soAcertadores = false) {
      const pool = this._poolSorteio(soAcertadores);
      if (!pool) return;
      this.telaoVencedor = pool[Math.floor(Math.random() * pool.length)];
      this._salvarSorteioTelao(this.telaoVencedor);
      showToast(soAcertadores ? '🎯 Sorteado entre os acertadores!' : '🎉 Bilhete premiado sorteado!', 'mago');
    },

    // Grava o ganhador pra o celular dele acender "VOCÊ GANHOU"
    async _salvarSorteioTelao(vencedor) {
      if (!vencedor || !sbClient) return;
      try {
        const { error } = await sbClient.from('evento_sorteio_telao').insert({
          evento: this.telaoEvento,
          numero_sorte: vencedor.numero_sorte,
          nome: vencedor.nome
        });
        if (error) throw error;
        this.adicionarLog('Supabase', 'INSERT evento_sorteio_telao', 'SUCCESS', 0, `Ganhador: ${vencedor.nome}`);
      } catch (e) {
        this.adicionarLog('Supabase', 'INSERT evento_sorteio_telao', 'ERROR', 0, e.message);
        showToast('Sorteio feito, mas falhou avisar os celulares: ' + e.message, 'error');
      }
    },

    async limparSorteioTelao() {
      this.telaoVencedor = null;
      // Apaga os registros de ganhador deste evento p/ os celulares pararem de exibir
      try {
        const { error } = await sbClient.from('evento_sorteio_telao').delete().eq('evento', this.telaoEvento);
        if (error) throw error;
        showToast('Sorteio limpo. O anúncio some dos celulares.', 'info');
      } catch (e) {
        showToast('Não consegui limpar o sorteio (rode a migração de DELETE).', 'error');
      }
    },

    // ----- Modo Telão: sorteio em tela cheia para projeção -----
    abrirModoTelao() {
      if (!this.telaoLeads.length) { showToast('Carregue/atualize os participantes antes.', 'error'); return; }
      this.telaoVencedor = null;
      this.telaoSorteando = false;
      this.telaoApresentacao = true;
      // Tenta tela cheia de verdade (a partir do clique do usuário)
      try { const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen(); } catch (_) {}
    },

    fecharModoTelao() {
      this.telaoApresentacao = false;
      this.telaoSorteando = false;
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (_) {}
    },

    // Sorteia com um "rolar" de números pra criar suspense, depois revela.
    // soAcertadores=true sorteia só entre quem cravou o placar.
    sortearNoTelao(soAcertadores = false) {
      const pool = this._poolSorteio(soAcertadores);
      if (!pool) return;
      this.telaoVencedor = null;
      this.telaoSorteando = true;
      let ticks = 0;
      const total = 32;
      const timer = setInterval(() => {
        this.telaoRolando = String(Math.floor(1000 + Math.random() * 9000));
        if (++ticks >= total) {
          clearInterval(timer);
          this.telaoVencedor = pool[Math.floor(Math.random() * pool.length)];
          this.telaoSorteando = false;
          this._salvarSorteioTelao(this.telaoVencedor);
          showToast('🎉 Temos um ganhador!', 'mago');
        }
      }, 70);
    },

    // ----- Seletor de jogo do evento (API-Football) -----
    async buscarJogoTelao() {
      if (!this.telaoBuscaJogo || this.telaoBuscaJogo.trim().length < 2) {
        showToast('Digite o nome de um time para buscar.', 'error');
        return;
      }

      // Salvar no histórico
      const termo = this.telaoBuscaJogo.trim();
      if (termo) {
        let h = [termo, ...this.telaoHistoricoBusca.filter(t => t.toLowerCase() !== termo.toLowerCase())];
        this.telaoHistoricoBusca = h.slice(0, 5);
        localStorage.setItem('gm_telao_history', JSON.stringify(this.telaoHistoricoBusca));
      }

      this.telaoBuscaLoading = true;
      this.telaoResultadosBusca = [];
      const t = Date.now();
      try {
        // Mesmas ligas usadas no bolão: Copa do Mundo (1), Brasileirão (71), Libertadores (13), Nordeste (325), Amistosos (10)
        const ligas = [1, 71, 13, 325, 10];
        const hoje = new Date();
        // Começa 14 dias atrás pra achar também jogos JÁ ENCERRADOS (ver resultado da galera)
        const from = new Date(hoje.getTime() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
        const ate  = new Date(hoje.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        let jogos = [];
        for (const liga of ligas) {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures?league=${liga}&season=2026&from=${from}&to=${ate}`, {
            headers: { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5' }
          });
          const json = await resp.json();
          if (json.response) jogos = jogos.concat(json.response);
        }
        // A API devolve nomes em inglês (ex: "Brazil"). Normaliza acento e
        // traduz PT->EN as seleções pra busca em português funcionar.
        const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        const ALIAS = {
          'brasil':'brazil','alemanha':'germany','espanha':'spain','inglaterra':'england',
          'franca':'france','italia':'italy','holanda':'netherlands','paises baixos':'netherlands',
          'belgica':'belgium','croacia':'croatia','suica':'switzerland','coreia do sul':'south korea',
          'coreia':'korea','japao':'japan','estados unidos':'united states','eua':'united states',
          'arabia saudita':'saudi arabia','africa do sul':'south africa','marrocos':'morocco',
          'camaroes':'cameroon','equador':'ecuador','uruguai':'uruguay','polonia':'poland',
          'dinamarca':'denmark','servia':'serbia','tunisia':'tunisia','gana':'ghana','catar':'qatar',
          'ira':'iran','turquia':'turkey','escocia':'scotland','gales':'wales','noruega':'norway',
          'argelia':'algeria','egito':'egypt','nova zelandia':'new zealand'
        };
        const qn = norm(this.telaoBuscaJogo);
        const qa = ALIAS[qn] || qn;
        this.telaoResultadosBusca = jogos
          .filter(j => {
            const h = norm(j.teams.home.name), a = norm(j.teams.away.name);
            return h.includes(qn) || a.includes(qn) || h.includes(qa) || a.includes(qa);
          })
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        this.adicionarLog('API-Football', `GET /fixtures telão "${this.telaoBuscaJogo}"`, 'SUCCESS', Date.now() - t, `${this.telaoResultadosBusca.length} jogos`);
        if (!this.telaoResultadosBusca.length) showToast('Nenhum jogo encontrado nos próximos 30 dias.', 'info');
      } catch (err) {
        this.adicionarLog('API-Football', 'GET /fixtures telão', 'ERROR', Date.now() - t, err.message);
        showToast('Erro ao buscar jogos: ' + err.message, 'error');
      } finally {
        this.telaoBuscaLoading = false;
      }
    },

    selecionarJogoTelao(jogo) {
      this.telaoFixture = {
        id:       jogo.fixture.id,
        homeName: jogo.teams.home.name,
        homeLogo: jogo.teams.home.logo,
        awayName: jogo.teams.away.name,
        awayLogo: jogo.teams.away.logo,
        date:     jogo.fixture.date
      };
      this.telaoEvento = 'fixture_' + jogo.fixture.id;
      this.telaoResultadosBusca = [];
      this.telaoBuscaJogo = '';
      this.telaoVencedor = null;
      this.telaoPlacar = { casa: '', fora: '' };
      this.carregarTelao();
      showToast(`Jogo definido: ${this.telaoFixture.homeName} x ${this.telaoFixture.awayName}`, 'mago');
    },

    usarHistoricoTelao(termo) {
      this.telaoBuscaJogo = termo;
      this.buscarJogoTelao();
    },

    async removerLeadTelao(id, nome) {
      if (!confirm(`⚠️ Deseja remover o participante "${nome}" deste evento?\n\nEsta ação é irreversível.`)) return;
      
      const t = Date.now();
      try {
        const { data, error } = await sbClient
          .from('leads_evento_telao')
          .delete()
          .eq('id', id)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          // RLS bloqueou (0 linhas) — provavelmente a policy de DELETE não foi aplicada
          showToast('Não removeu (sem permissão). Rode a migração com a policy de DELETE.', 'error');
          return;
        }

        showToast(`Participante ${nome} removido.`, 'info');
        this.adicionarLog('Supabase', 'DELETE leads_evento_telao', 'SUCCESS', Date.now() - t, `Removido: ${nome}`);
        this.carregarTelao(); // recarrega a lista
      } catch (err) {
        showToast("Erro ao remover participante: " + err.message, "error");
      }
    },

    limparJogoTelao() {
      this.telaoFixture = null;
      this.telaoEvento = 'telao_brasil';
      this.telaoVencedor = null;
      this.telaoPlacar = { casa: '', fora: '' };
      this.carregarTelao();
    },

    // Link público que vai no QR Code (atrelado ao jogo escolhido)
    telaoLinkPublico() {
      const base = location.origin + '/telas/telao.html';
      return this.telaoFixture ? `${base}?fixture=${this.telaoFixture.id}` : base;
    },

    telaoQrUrl() {
      return 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(this.telaoLinkPublico());
    },

    copiarLinkTelao() {
      navigator.clipboard.writeText(this.telaoLinkPublico())
        .then(() => showToast('Link do telão copiado! 📋', 'success'))
        .catch(() => showToast('Não consegui copiar — copie manualmente.', 'error'));
    }
  };
}

// ============================================================
// FUNÇÕES STANDALONE — compartilhadas entre adminApp e admin.html legado
// ============================================================

async function analisarDistorcaoPalpites(fixtureId) {
  return ORACLE.predictions(fixtureId);
}

function traduzirAdviceOraculoAPI(texto) {
  if (!texto) return '—';
  let t = texto.trim();

  // "Combo Double chance : X or draw and -2.5 goals"
  const comboDouble = t.match(/combo double chance\s*:\s*(.+?)\s+or\s+draw\s+and\s+(-[\d.]+)\s+goals?/i);
  if (comboDouble) {
    const gols = Math.abs(parseFloat(comboDouble[2]));
    return `Combinada: ${comboDouble[1]} ou Empate + Menos de ${gols} gols na partida`;
  }

  // "Double chance : X or draw"
  const doubleChance = t.match(/double chance\s*:\s*(.+?)\s+or\s+draw/i);
  if (doubleChance) return `Dupla Chance: ${doubleChance[1]} vence ou Empate`;

  // "Win or draw : X"
  const winOrDraw = t.match(/win or draw\s*:\s*(.+)/i);
  if (winOrDraw) return `${winOrDraw[1]} não perde — vitória ou empate`;

  // "X to win"
  const toWin = t.match(/^(.+?)\s+to\s+win$/i);
  if (toWin) return `${toWin[1]} para vencer`;

  // "Both teams to score"
  if (/both teams to score/i.test(t)) return 'Ambas as equipes marcam gol';

  // "Under X goals"
  const under = t.match(/under\s+([\d.]+)\s+goals?/i);
  if (under) return `Menos de ${under[1]} gols na partida`;

  // "Over X goals"
  const over = t.match(/over\s+([\d.]+)\s+goals?/i);
  if (over) return `Mais de ${over[1]} gols na partida`;

  // "No goal in the first half"
  if (/no goal in the first half/i.test(t)) return 'Sem gols no primeiro tempo';

  // "X to score first"
  const scoreFirst = t.match(/(.+?)\s+to\s+score\s+first/i);
  if (scoreFirst) return `${scoreFirst[1]} marca primeiro`;

  // "Draw No Bet : X"
  const dnb = t.match(/draw no bet\s*:\s*(.+)/i);
  if (dnb) return `Aposta sem empate: ${dnb[1]} (devolve se empatar)`;

  return t;
}

function validarLiquidez(distribuicao) {
  if (!distribuicao || distribuicao.total === 0) {
    return { status: 'sem_dados', label: 'SEM PALPITES', premiacao: 'migalhas',
      descricao: 'Nenhum palpite registrado ainda. Sem liquidez garantida.' };
  }
  const { homePct, awayPct, total } = distribuicao;
  const dominante = Math.max(homePct, awayPct);
  if (dominante > 85) {
    return { status: 'baixa', label: 'LIQUIDEZ BAIXA ⚠', premiacao: 'migalhas',
      descricao: `Mercado concentrado (${dominante.toFixed(0)}% num lado). Prêmio será migalhas (10%) se resultado unilateral.`,
      detalhes: distribuicao };
  }
  return { status: 'ok', label: 'LIQUIDEZ OK ✓', premiacao: 'integral',
    descricao: 'Apostas bem distribuídas. Premiação integral garantida.',
    detalhes: distribuicao };
}

// ============================================================
// TESTE DE FOGO — Backtest do Oráculo com Amistosos Pré-Copa
// Uso: abra o console (F12) na página do GM e chame testarOraculoAmistosos()
// ============================================================
async function testarOraculoAmistosos() {
  const KEY = '47ca2bb05eb5931347aca04964818eb5';
  const HOST = 'v3.football.api-sports.io';
  const headers = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
  const hoje = new Date().toISOString().split('T')[0];
  const amanha = new Date(Date.now() + 864e5).toISOString().split('T')[0];

  console.group('🧪 [Backtest Oráculo] Amistosos Pré-Copa');
  console.log('Datas pesquisadas:', hoje, amanha);

  const [r1, r2] = await Promise.all([
    fetch(`https://${HOST}/fixtures?date=${hoje}`, { headers }).then(r => r.json()),
    fetch(`https://${HOST}/fixtures?date=${amanha}`, { headers }).then(r => r.json())
  ]);

  const todos = [...(r1.response || []), ...(r2.response || [])];
  // Amistosos internacionais: nome contém "friend" ou league_id 10 (Clubs Friendly) / 325 (Friendlies)
  // Exclui cancelados (CANC) e adiados (PST)
  const amistosos = todos.filter(f =>
    (f.league.name.toLowerCase().includes('friend') || [10, 325].includes(f.league.id)) &&
    !['CANC', 'PST', 'ABD', 'WD'].includes(f.fixture.status.short)
  );

  console.log(`Total fixtures: ${todos.length} | Amistosos filtrados: ${amistosos.length}`);

  if (amistosos.length === 0) {
    console.warn('Nenhum amistoso encontrado nas datas. Exibindo top-5 de hoje para inspeção manual:');
    console.table(todos.slice(0, 5).map(f => ({
      fixture_id: f.fixture.id,
      liga: f.league.name,
      home: f.teams.home.name,
      away: f.teams.away.name,
      status: f.fixture.status.short
    })));
    console.groupEnd();
    return todos;
  }

  console.table(amistosos.map(f => ({
    fixture_id: f.fixture.id,
    liga: f.league.name,
    home: f.teams.home.name,
    away: f.teams.away.name,
    data: new Date(f.fixture.date).toLocaleString('pt-BR'),
    status: f.fixture.status.short
  })));

  const fId = amistosos[0].fixture.id;
  console.log(`\n🎯 Analisando fixture_id ${fId}: ${amistosos[0].teams.home.name} vs ${amistosos[0].teams.away.name}`);

  // Chama /predictions e /odds em paralelo
  const [predRes, oddsRes] = await Promise.all([
    fetch(`https://${HOST}/predictions?fixture=${fId}`, { headers }).then(r => r.json()),
    fetch(`https://${HOST}/odds?fixture=${fId}`, { headers }).then(r => r.json())
  ]);

  // Predictions
  if (predRes.response?.length > 0) {
    const p = predRes.response[0];
    console.group('📊 /predictions');
    console.log('Advice:', p.predictions.advice);
    console.log('Vencedor previsto:', p.predictions.winner?.name || 'Empate');
    console.log('Probabilidades:', p.predictions.percent);
    console.log('Gols esperados:', p.predictions.goals);
    console.groupEnd();
  } else {
    console.warn('/predictions vazio ou sem suporte para este fixture:', predRes.errors);
  }

  // Odds (plano free pode não incluir)
  if (oddsRes.response?.length > 0) {
    const bm = oddsRes.response[0].bookmakers?.[0];
    const mw = bm?.bets?.find(b => b.name === 'Match Winner');
    console.group(`💰 /odds — ${bm?.name || 'Casa 1'} (Match Winner)`);
    (mw?.values || []).forEach(v => console.log(`  ${v.value}: ${v.odd}`));
    console.groupEnd();
  } else {
    console.warn('/odds vazio — plano Free não inclui odds:', oddsRes.errors);
  }

  console.log('\n✅ Backtest concluído. Copie o fixture_id acima e cole no campo do Oráculo para análise completa.');
  console.groupEnd();

  return { fId, amistosos, predictions: predRes.response?.[0], odds: oddsRes.response?.[0] };
}

// terminalApp() removido — funcionalidades integradas no gm.html
// (mantido como stub para não quebrar cache de navegador)
function terminalApp() {
  return {
    loading: true,
    usuario: null,
    acessoAutorizado: false,
    pinDesbloqueado: false,
    pinInput: '',
    pinErro: false,

    abaAtiva: 'global',
    relogio: '',
    _clockInt: null,

    metricas: { loading: false, usuarios: 0, grupos: 0, palpites: 0, desafios: 0, fichas: 0 },

    oraculo: { loading: false, fixtureId: '', predicoes: null, distribuicao: null, distorcao: null, erro: null },

    buscaInput: '',
    buscaLoading: false,
    resultadoBusca: [],
    novoDesafio: { fixture_id: '', match_name: '', evento: 'Goal', custo_fichas: 5, premio_pts: 50, descricao: '' },
    liquidezStatus: null,
    desafioLancando: false,

    logs: [],

    async init() {
      this._clockInt = setInterval(() => { this.relogio = new Date().toLocaleTimeString('pt-BR'); }, 1000);
      this.relogio = new Date().toLocaleTimeString('pt-BR');

      if (!sbClient) { this.loading = false; return; }

      const savedLogs = sessionStorage.getItem('terminal_logs');
      if (savedLogs) { try { this.logs = JSON.parse(savedLogs); } catch(e) { this.logs = []; } }
      if (sessionStorage.getItem('gm_pin_unlocked') === 'true') this.pinDesbloqueado = true;

      sbClient.auth.onAuthStateChange((_, session) => {
        this._processarSessao(session);
        if (this.acessoAutorizado && this.pinDesbloqueado) this.carregarMetricas();
      });

      try {
        const { data: { session } } = await sbClient.auth.getSession();
        this._processarSessao(session);
      } catch(err) { console.error('[TERMINAL]', err); }

      if (this.acessoAutorizado && this.pinDesbloqueado) this.carregarMetricas();
      this.loading = false;
    },

    _processarSessao(session) {
      if (session?.user) {
        this.usuario = session.user;
        this.acessoAutorizado = session.user.email === 'worldkkevin@gmail.com';
      } else {
        this.usuario = null;
        this.acessoAutorizado = false;
        this.pinDesbloqueado = false;
      }
    },

    async entrarComGoogle() {
      const { error } = await sbClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      });
      if (error) this._log('AUTH', 'signInWithOAuth', 'ERROR', 0, error.message);
    },

    async deslogar() {
      await sbClient.auth.signOut();
      sessionStorage.removeItem('gm_pin_unlocked');
      sessionStorage.removeItem('terminal_logs');
      this.usuario = null; this.acessoAutorizado = false; this.pinDesbloqueado = false; this.logs = [];
    },

    verificarPin() {
      if (this.pinInput === '8187') {
        this.pinDesbloqueado = true; this.pinErro = false; this.pinInput = '';
        sessionStorage.setItem('gm_pin_unlocked', 'true');
        this.carregarMetricas();
      } else {
        this.pinErro = true; this.pinInput = '';
      }
    },

    _log(servico, rota, status, ms, msg) {
      this.logs.unshift({ ts: new Date().toLocaleTimeString('pt-BR'), servico, rota, status, ms, msg });
      if (this.logs.length > 60) this.logs.pop();
      sessionStorage.setItem('terminal_logs', JSON.stringify(this.logs));
    },

    async carregarMetricas() {
      if (this.metricas.loading) return;
      this.metricas.loading = true;
      const tabelas = ['profiles', 'groups', 'guesses', 'desafios'];
      await Promise.all(tabelas.map(async (tab) => {
        const t = Date.now();
        const { count, error } = await sbClient.from(tab).select('*', { count: 'exact', head: true });
        const ms = Date.now() - t;
        if (!error) {
          if (tab === 'profiles')  this.metricas.usuarios  = count;
          if (tab === 'groups')    this.metricas.grupos    = count;
          if (tab === 'guesses')   this.metricas.palpites  = count;
          if (tab === 'desafios')  this.metricas.desafios  = count;
          this._log('Supabase', `COUNT(${tab})`, 'OK', ms, `${count}`);
        } else {
          this._log('Supabase', `COUNT(${tab})`, 'ERR', ms, error.message);
        }
      }));
      // Fichas em circulação
      try {
        const t = Date.now();
        const { data } = await sbClient.from('profiles').select('fichas_desafio');
        if (data) this.metricas.fichas = data.reduce((s, u) => s + (u.fichas_desafio || 0), 0);
        this._log('Supabase', 'SUM(fichas_desafio)', 'OK', Date.now() - t, `${this.metricas.fichas} fichas`);
      } catch(e) {}
      this.metricas.loading = false;
    },

    async analisarOraculo() {
      if (!this.oraculo.fixtureId) return;
      this.oraculo.loading = true;
      this.oraculo.predicoes = null; this.oraculo.distribuicao = null;
      this.oraculo.distorcao = null; this.oraculo.erro = null;
      const fId = Number(this.oraculo.fixtureId);
      const t = Date.now();
      try {
        const [pred, dist] = await Promise.all([
          analisarDistorcaoPalpites(fId),
          this._distribuicaoLocal(fId)
        ]);
        this.oraculo.predicoes = pred;
        this.oraculo.distribuicao = dist;
        if (dist.total > 0) {
          this.oraculo.distorcao = {
            home: (dist.homePct - pred.percent.home).toFixed(1),
            draw: (dist.drawPct - pred.percent.draw).toFixed(1),
            away: (dist.awayPct - pred.percent.away).toFixed(1),
            zebraAlert: Math.max(Math.abs(dist.homePct - pred.percent.home), Math.abs(dist.awayPct - pred.percent.away)) > 25
          };
        }
        this._log('API-Football', `/predictions?fixture=${fId}`, 'OK', Date.now() - t, `${pred.teams?.home?.name} vs ${pred.teams?.away?.name}`);
      } catch(err) {
        this.oraculo.erro = err.message;
        this._log('API-Football', `/predictions?fixture=${fId}`, 'ERR', Date.now() - t, err.message);
      } finally {
        this.oraculo.loading = false;
      }
    },

    async _distribuicaoLocal(fixtureId) {
      const { data, error } = await sbClient.from('guesses').select('score_home, score_away').eq('match_id', fixtureId);
      if (error || !data || data.length === 0) return { total: 0, homePct: 0, drawPct: 0, awayPct: 0, raw: { home:0, draw:0, away:0 } };
      let home = 0, draw = 0, away = 0;
      data.forEach(g => { if (g.score_home > g.score_away) home++; else if (g.score_home < g.score_away) away++; else draw++; });
      const total = data.length;
      return { total, homePct: (home/total)*100, drawPct: (draw/total)*100, awayPct: (away/total)*100, raw: { home, draw, away } };
    },

    async buscarPartidas() {
      if (!this.buscaInput || this.buscaLoading) return;
      this.buscaLoading = true; this.resultadoBusca = [];
      const t = Date.now();
      try {
        const hoje = new Date();
        const from = hoje.toISOString().split('T')[0];
        const ate = new Date(hoje.getTime() + 25 * 864e5).toISOString().split('T')[0];
        let jogos = [];
        for (const liga of [1, 71, 13, 325]) {
          const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${liga}&season=2026&from=${from}&to=${ate}`, {
            headers: { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5' }
          });
          const j = await r.json();
          if (j.response) jogos = jogos.concat(j.response);
        }
        const q = this.buscaInput.toLowerCase();
        this.resultadoBusca = jogos
          .filter(j => j.teams.home.name.toLowerCase().includes(q) || j.teams.away.name.toLowerCase().includes(q))
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)).slice(0, 8);
        this._log('API-Football', `fixtures busca "${this.buscaInput}"`, 'OK', Date.now() - t, `${this.resultadoBusca.length} jogos`);
      } catch(err) {
        this._log('API-Football', 'fixtures busca', 'ERR', Date.now() - t, err.message);
      } finally {
        this.buscaLoading = false;
      }
    },

    async selecionarPartida(jogo) {
      this.novoDesafio.fixture_id = jogo.fixture.id;
      this.novoDesafio.match_name = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
      this.buscaInput = this.novoDesafio.match_name;
      this.resultadoBusca = [];
      const dist = await this._distribuicaoLocal(jogo.fixture.id);
      this.liquidezStatus = validarLiquidez(dist);
    },

    async lancarDesafio() {
      if (this.desafioLancando || !this.novoDesafio.fixture_id) return;
      this.desafioLancando = true;
      const t = Date.now();
      try {
        const { error } = await sbClient.from('desafios').insert([{
          fixture_id: Number(this.novoDesafio.fixture_id),
          match_name: this.novoDesafio.match_name,
          event_type: this.novoDesafio.evento,
          points: this.novoDesafio.premio_pts,
          custo_fichas: this.novoDesafio.custo_fichas,
          descricao: this.novoDesafio.descricao || null,
          status: 'active'
        }]);
        if (error) throw error;
        this._log('Supabase', 'INSERT desafios', 'OK', Date.now() - t, this.novoDesafio.match_name);
        this.novoDesafio = { fixture_id: '', match_name: '', evento: 'Goal', custo_fichas: 5, premio_pts: 50, descricao: '' };
        this.liquidezStatus = null; this.buscaInput = '';
        alert('✅ Desafio lançado!');
      } catch(err) {
        this._log('Supabase', 'INSERT desafios', 'ERR', Date.now() - t, err.message);
        alert('Erro: ' + err.message);
      } finally {
        this.desafioLancando = false;
      }
    }
  };
}

// ============================================================
// ORÁCULO QUANTITATIVO - INICIALIZAÇÃO DO GRÁFICO (MOCK)
// ============================================================
window.initQuantChart = function() {
  const chartEl = document.querySelector("#quantChart");
  if (!chartEl) return;
  
  // Previne múltiplas renderizações
  if (chartEl.innerHTML !== "") {
    chartEl.innerHTML = "";
  }

  const options = {
    series: [{
      name: 'Valor',
      data: [6, 2, 2, 2, 1, 3, 2]
    }],
    chart: {
      type: 'bar',
      height: 220,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: { enabled: true, delay: 150 },
        dynamicAnimation: { enabled: true, speed: 350 }
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
        colors: {
          ranges: [
            { from: 0, to: 1.49, color: '#ef4444' }, // Red for Loss (abaixo da linha 1.5)
            { from: 1.5, to: 100, color: '#10b981' } // Neon Green for Win
          ]
        },
        dataLabels: {
          position: 'bottom' // Coloca o label embaixo
        }
      }
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: { fontSize: '12px', fontWeight: 'bold', colors: ['#ffffff'] },
      background: { enabled: false, dropShadow: { enabled: false } }
    },
    xaxis: {
      categories: ['05/06', '08/06', '06/09', '09/10', '12/10', '17/11', '25/03'],
      labels: { 
        style: { colors: '#71717a', fontSize: '9px', fontWeight: 'bold' },
        offsetY: -2
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      show: true,
      tickAmount: 2,
      labels: { style: { colors: '#71717a', fontSize: '9px', fontWeight: 'bold' } },
      axisBorder: { show: false }
    },
    grid: { 
      show: false,
      padding: { top: 0, right: 0, bottom: 0, left: 10 }
    },
    theme: { mode: 'dark' },
    tooltip: {
      enabled: true,
      theme: 'dark',
      y: { formatter: function (val) { return val + " Cartões" } }
    },
    annotations: {
      yaxis: [{
        y: 1.5,
        borderColor: '#ffffff',
        borderWidth: 2,
        strokeDashArray: 0,
        label: {
          text: '1.5',
          style: { 
            color: '#0a0a0a', 
            background: '#ffffff', 
            fontSize: '9px', 
            fontWeight: '900', 
            padding: { left: 4, right: 4, top: 2, bottom: 2 } 
          }
        }
      }]
    }
  };

  const chart = new ApexCharts(chartEl, options);
  chart.render();
};
