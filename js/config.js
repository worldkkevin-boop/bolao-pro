// ============ SUPABASE CONFIG & INITIALIZATION ============
const SUPABASE_URL      = 'https://hkiqozqqcymbhfobydoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraXFvenFxY3ltYmhmb2J5ZG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODk0NzYsImV4cCI6MjA5NTQ2NTQ3Nn0.fx31IcsivW-YjYy6Of7c_gbKq90yvE40Tqrt-jCydso';

// Número do WhatsApp para suporte (Exemplo: 55 + DDD + Número)
const SUPORTE_WHATSAPP = '5500000000000'; 


let sbClient = null;

// ============ ESTADO GLOBAL DA APLICAÇÃO ============
let usuarioAtual      = null;
let grupoAtual        = null;
let todosOsJogos      = [];
let palpitesUsuario   = [];
let rodadaSelecionada = null;
let golsHome          = 0;
let golsAway          = 0;
let jogoAtual         = null;
let palpiteOriginal   = { home: 0, away: 0 };
let countdownInterval = null;

// ============ BANDEIRAS & AUXILIARES ============
const FLAG_URLS = {
  1: 'be', 2: 'fr', 3: 'hr', 5: 'se', 6: 'br', 7: 'uy', 8: 'co', 9: 'es',
  10: 'gb-eng', 11: 'pa', 12: 'jp', 13: 'sn', 15: 'ch', 16: 'mx', 17: 'kr',
  20: 'au', 22: 'ir', 23: 'sa', 25: 'de', 26: 'ar', 27: 'pt', 28: 'tn',
  31: 'ma', 32: 'eg', 770: 'cz', 775: 'at', 777: 'tr', 1090: 'no',
  1108: 'gb-sct', 1113: 'ba', 1118: 'nl', 1501: 'ci', 1504: 'gh',
  1508: 'cd', 1531: 'za', 1532: 'dz', 1533: 'cv', 1548: 'jo',
  1567: 'iq', 1568: 'uz', 1569: 'qa', 2380: 'py', 2382: 'ec',
  2384: 'us', 2386: 'ht', 4673: 'nz', 5529: 'ca', 5530: 'cw'
};

function getFlagUrl(teamId) {
  const code = FLAG_URLS[teamId];
  return code ? 'https://flagcdn.com/w40/' + code + '.png' : null;
}

// Inicializa o cliente do Supabase
try {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Escuta mudanças de sessão — dispara quando o Google redireciona de volta
  sbClient.auth.onAuthStateChange(function(event, session) {
    if (session && session.user) {
      const user = session.user;
      if (typeof entrarNoApp === 'function') {
        entrarNoApp({
          id:    user.id,
          nome:  user.user_metadata.full_name || user.email,
          email: user.email,
          foto:  user.user_metadata.avatar_url || null
        });
      }
    }
  });

  // Verifica se já tem sessão ativa ao carregar a página
  sbClient.auth.getSession().then(function(result) {
    const session = result.data.session;
    if (session && session.user) {
      const user = session.user;
      if (typeof entrarNoApp === 'function') {
        entrarNoApp({
          id:    user.id,
          nome:  user.user_metadata.full_name || user.email,
          email: user.email,
          foto:  user.user_metadata.avatar_url || null
        });
      }
    }
  });
} catch (e) {
  console.error('Supabase não inicializou:', e);
}
