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

    async init() {
      console.log("[ADMIN] Inicializando aplicação do GM...");

      if (!sbClient) {
        alert("Erro: Cliente Supabase não inicializado. Verifique a configuração.");
        this.loading = false;
        return;
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
        this.usuario = null;
        this.acessoAutorizado = false;
        this.pinDesbloqueado = false;
        this.pinInput = '';
        this.pinErro = false;
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
      } else {
        this.pinErro = true;
        this.pinInput = '';
        console.warn("[ADMIN] Tentativa de login frustrada: PIN incorreto.");
      }
    }
  };
}
