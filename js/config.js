// ============ SUPABASE CONFIG & INITIALIZATION ============
// AMBIENTE: em localhost usa o Supabase de TESTE (VPS); no site de verdade usa PRODUÇÃO.
// A checagem é pelo hostname, então nunca aponta usuário real pro banco de dev.
const _BOLAO_DEV = ['localhost', '127.0.0.1', '::1'].includes(location.hostname) || location.hostname.endsWith('.local');

const SUPABASE_URL = _BOLAO_DEV
  ? 'https://supabase-dev.ksstudio.cloud'                       // DEV (VPS self-hosted)
  : 'https://hkiqozqqcymbhfobydoq.supabase.co';                 // PRODUÇÃO

const SUPABASE_ANON_KEY = _BOLAO_DEV
  ? 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MzQ1NDU4MCwiZXhwIjo0OTM5MTI4MTgwLCJyb2xlIjoiYW5vbiJ9.VGwo7oEpShbcZvMrh74pD2VWW24pep64fpNpBNsqjAI'                             // SERVICE_SUPABASEANON_KEY (anon, pode ficar no front)
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraXFvenFxY3ltYmhmb2J5ZG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODk0NzYsImV4cCI6MjA5NTQ2NTQ3Nn0.fx31IcsivW-YjYy6Of7c_gbKq90yvE40Tqrt-jCydso';

if (_BOLAO_DEV) console.log('%c[BOLÃO DEV] Conectado ao Supabase de teste:', 'color:#f59e0b;font-weight:bold', SUPABASE_URL);

// Número do WhatsApp para suporte (Exemplo: 55 + DDD + Número)
const SUPORTE_WHATSAPP = '5596991767788';

// ============ MODO MANUTENÇÃO (reforma pra 2.0) ============
// Enquanto true, só MAINTENANCE_ADMIN_EMAIL entra no app normal — todo mundo mais
// vê a tela de aviso com o ranking final do Ladaya (só leitura). Reverter: false.
const MAINTENANCE_MODE = true;
const MAINTENANCE_ADMIN_EMAIL = 'worldkkevin@gmail.com';


let sbClient = null;

// ============ ESTADO GLOBAL DA APLICAÇÃO ============
let usuarioAtual      = null;
let grupoAtual        = null;
let todosOsJogos      = [];
let palpitesUsuario   = [];
let distribuicaoPalpitesGrupo = {};
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

// ============ PLACAR QUE VALE PRO BOLÃO (só os 90' + acréscimos) ============
// Regra do bolão: vale só o tempo normal. Quando o jogo entra em prorrogação ou
// pênaltis, a API congela o placar dos 90' em `score.fulltime` e o `goals` passa a
// somar os gols da prorrogação. Então, em jogos pós-90' (ET/BT/P em andamento ou
// AET/PEN encerrado), usamos `score.fulltime` — assim prorrogação e pênaltis NÃO
// mexem na pontuação. Sem `score` (ex.: jogo vindo do cache `matches`, onde já
// salvamos o placar de 90'), cai no `goals` mesmo.
const STATUS_POS_90 = ['ET', 'BT', 'P', 'AET', 'PEN'];

function passouDoTempoNormal(jogo) {
  const st = jogo && jogo.fixture && jogo.fixture.status ? jogo.fixture.status.short : null;
  return STATUS_POS_90.includes(st);
}

// Retorna { home, away } com o placar que conta pro bolão (90').
function placarValido(jogo) {
  if (!jogo) return { home: null, away: null };
  const ft = jogo.score ? jogo.score.fulltime : null;
  if (passouDoTempoNormal(jogo) && ft && ft.home != null && ft.away != null) {
    return { home: ft.home, away: ft.away };
  }
  return {
    home: jogo.goals ? jogo.goals.home : null,
    away: jogo.goals ? jogo.goals.away : null
  };
}

// Inicializa o cliente do Supabase
try {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase não inicializou:', e);
}

// Busca TODOS os palpites de um grupo paginando em blocos (o Supabase corta em
// ~1000 linhas e um teto fixo como .limit(2000) também truncava). Um grupo grande,
// ao longo da Copa, junta milhares de palpites somando todos os jogos — sem paginar,
// gente que palpitou some do ranking/zebra/ao vivo. Ordem estável (match_id, user_id
// é único dentro do grupo) pra não repetir nem pular linha entre as páginas.
async function buscarTodosPalpitesGrupo(groupId, selectCols = 'user_id, match_id, score_home, score_away') {
  const todos = [];
  if (!sbClient || !groupId) return todos;
  const PAG = 1000;
  let de = 0;
  while (true) {
    const { data, error } = await sbClient
      .from('guesses')
      .select(selectCols)
      .eq('group_id', groupId)
      .order('match_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(de, de + PAG - 1);
    if (error) { console.error('buscarTodosPalpitesGrupo:', error); break; }
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < PAG) break;
    de += PAG;
  }
  return todos;
}
