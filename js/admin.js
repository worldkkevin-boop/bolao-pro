// ============ GAME MASTER (GM) ADMIN CONTROLLER ============

function adminApp() {
  return {
    loading: true,
    usuario: null,
    acessoAutorizado: false,
    pinDesbloqueado: false,
    pinInput: '',
    pinErro: false,
    abaAtiva: 'dashboard',

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
        alert("Erro: Cliente Supabase não inicializado. Verifique a configuração.");
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
        alert("Erro no Login do Google: " + err.message);
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
    }
  };
}
