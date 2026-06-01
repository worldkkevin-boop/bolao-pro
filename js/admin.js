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

    // Grupos
    gruposLista: [],
    gruposLoading: false,
    gruposFiltro: '',
    grupoSelecionado: null,
    grupoMembros: [],
    grupoMembrosLoading: false,

    // Usuários
    usuariosLista: [],
    usuariosLoading: false,
    usuariosFiltro: '',

    // Migração de Jogadores
    migracaoLoading: false,
    grupoOrigemId: '',
    grupoDestinoId: '',
    deletarOrigem: false,

    // Desafios do GM
    desafiosListaGM: [],
    desafiosLoading: false,
    desafiosAbaFiltro: 'active',
    novoDesafio: { fixture_id: '', match_name: '', event_type: 'Goal', points: 5, custo_fichas: 5, players: [], status: 'active', hasPenalty: false },
    novoJogadorInput: '',
    desafioLancando: false,
    buscaFixture: '',
    buscaFixtureLoading: false,
    resultadoBuscaFixtures: [],

    // Oráculo
    oraculo: { loading: false, fixtureId: '', predicoes: null, distribuicao: null, distorcao: null, erro: null },

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
      this.grupoMembros = [];

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
          m._nome = p ? p.full_name : 'Sem nome';
          m._email = p ? p.email : '';
          m._avatar = p ? p.avatar_url : null;
        });

        this.grupoMembros = membros;
      } catch (err) {
        console.error('Erro ao carregar membros:', err);
      } finally {
        this.grupoMembrosLoading = false;
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

    // ============ DESAFIOS DO GM ============

    traduzirRegra(eventType) {
      const map = {
        'Goal': '⚽ Gol',
        'Goal_penalty': '⚽ Gol (Pen.)',
        'Card': '🟨 Cartão',
        'Card_penalty': '🟨 Cartão (Pen.)'
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
      this.buscaFixtureLoading = true;
      this.resultadoBuscaFixtures = [];

      const startTime = Date.now();
      try {
        // Busca nas 3 ligas: Brasileirão (71), Libertadores (13), Copa do Mundo (1)
        const ligas = [71, 13, 1];
        const hoje = new Date();
        const from = hoje.toISOString().split('T')[0];
        const ate = new Date(hoje.getTime() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0];

        let todosJogos = [];

        for (const liga of ligas) {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures?league=${liga}&season=2025&from=${from}&to=${ate}`, {
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

    selecionarPartida(jogo) {
      this.novoDesafio.fixture_id = jogo.fixture.id;
      this.novoDesafio.match_name = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
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
      if (!this.novoDesafio.fixture_id || this.novoDesafio.players.length < 2) {
        showToast('Selecione uma partida e adicione pelo menos 2 jogadores.', 'error');
        return;
      }

      this.desafioLancando = true;
      const startTime = Date.now();

      try {
        const payload = {
          fixture_id: Number(this.novoDesafio.fixture_id),
          match_name: this.novoDesafio.match_name,
          event_type: this.novoDesafio.event_type,
          points: this.novoDesafio.points,
          custo_fichas: this.novoDesafio.custo_fichas || 0,
          players: this.novoDesafio.players,
          status: 'active'
        };

        const { error } = await sbClient
          .from('desafios')
          .insert([payload]);

        if (error) throw error;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'INSERT desafios', 'SUCCESS', duration, `Desafio "${payload.match_name}" lançado`);

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

    async finalizarDesafioGM(desafioId) {
      if (!confirm('Tem certeza que deseja FINALIZAR este desafio? Ele será marcado como resolvido.')) return;

      const startTime = Date.now();
      try {
        const { error } = await sbClient
          .from('desafios')
          .update({ status: 'resolved' })
          .eq('id', desafioId);

        if (error) throw error;

        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'UPDATE desafios (finalizar)', 'SUCCESS', duration, `Desafio ${desafioId.substring(0, 8)} finalizado`);

        this.carregarDesafiosGM();
      } catch (err) {
        const duration = Date.now() - startTime;
        this.adicionarLog('Supabase', 'UPDATE desafios', 'ERROR', duration, err.message);
        showToast('Erro ao finalizar: ' + err.message, 'error');
      }
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

    async analisarOraculoGM() {
      if (!this.oraculo.fixtureId) return;
      this.oraculo.loading = true;
      this.oraculo.predicoes = null;
      this.oraculo.distribuicao = null;
      this.oraculo.distorcao = null;
      this.oraculo.erro = null;
      const fId = Number(this.oraculo.fixtureId);
      const t = Date.now();
      try {
        const [pred, dist] = await Promise.all([
          analisarDistorcaoPalpites(fId),
          this._distribuicaoLocalGM(fId)
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
        this.adicionarLog('API-Football', `/predictions?fixture=${fId}`, 'SUCCESS', Date.now() - t, `${pred.teams?.home?.name} vs ${pred.teams?.away?.name}`);
      } catch(err) {
        this.oraculo.erro = err.message;
        this.adicionarLog('API-Football', `/predictions?fixture=${fId}`, 'ERROR', Date.now() - t, err.message);
      } finally {
        this.oraculo.loading = false;
      }
    },

    async _distribuicaoLocalGM(fixtureId) {
      const { data, error } = await sbClient.from('guesses').select('score_home, score_away').eq('match_id', fixtureId);
      if (error || !data || data.length === 0) return { total: 0, homePct: 0, drawPct: 0, awayPct: 0, raw: { home: 0, draw: 0, away: 0 } };
      let home = 0, draw = 0, away = 0;
      data.forEach(g => { if (g.score_home > g.score_away) home++; else if (g.score_home < g.score_away) away++; else draw++; });
      const total = data.length;
      return { total, homePct: (home/total)*100, drawPct: (draw/total)*100, awayPct: (away/total)*100, raw: { home, draw, away } };
    }
  };
}

// ============================================================
// FUNÇÕES STANDALONE — compartilhadas entre adminApp e admin.html legado
// ============================================================

async function analisarDistorcaoPalpites(fixtureId) {
  const resp = await fetch(`https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`, {
    headers: {
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-rapidapi-key': '47ca2bb05eb5931347aca04964818eb5'
    }
  });
  if (!resp.ok) throw new Error(`API-Football ${resp.status}`);
  const json = await resp.json();
  if (!json.response || json.response.length === 0) throw new Error('Sem predições para esta partida.');
  const pred = json.response[0];
  const pct = pred.predictions.percent;
  return {
    teams: pred.teams,
    winner: pred.predictions.winner,
    advice: pred.predictions.advice,
    percent: {
      home: parseFloat(pct.home) || 0,
      draw: parseFloat(pct.draw) || 0,
      away: parseFloat(pct.away) || 0
    },
    goals: pred.predictions.goals
  };
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
