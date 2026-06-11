// ============================================================
//  SALA DO EVENTO TELÃO — MÓDULO ISOLADO
//  Lê só a VIEW pública evento_telao_publico (sem WhatsApp) e a
//  API-Football (placar ao vivo). NÃO toca em grupos/palpites do bolão.
//  Identidade do participante = aparelho (localStorage), não a conta.
// ============================================================

const EVENTO_API_HOST = 'v3.football.api-sports.io';
const EVENTO_API_KEY  = '47ca2bb05eb5931347aca04964818eb5';

let _eventoSlugAtual   = null;
let _eventoFixtureId   = null;
let _eventoPollTimer   = null;
let _eventoSorteioTimer = null;
let _eventoLastSorteioId = null;
let _eventoPlacarVivo  = null;   // { home, away } do jogo agora
let _eventoParticipantes = [];

// Slug do evento que ficou pendente no aparelho (vindo da página telao.html)
function obterEventoPendente() {
  try { return localStorage.getItem('evento_telao_pending') || null; }
  catch (_) { return null; }
}

let _eventoGlobalPollTimer = null;
let _slugEventoAtivoEncontrado = null;
let _eventoEstavaAtivo = false;   // p/ detectar a transição ativo -> finalizado dentro da sala

// Checa se existe algum evento iniciado pelo GM no Supabase
async function checarEventoAtivoGlobal() {
  if (typeof sbClient === 'undefined' || !sbClient) return;

  try {
    // Busca na tabela de sorteio pelo marcador especial de 'CONFIG_ATIVO_'
    const { data, error } = await sbClient
      .from('evento_sorteio_telao')
      .select('evento, nome')
      .like('evento', 'CONFIG_ATIVO_%')
      .order('criado_em', { ascending: false })
      .limit(1);

    const container = document.getElementById('container-eventos-ativos');
    const nomeEl = document.getElementById('menu-evento-nome');

    if (!error && data && data.length > 0) {
      const configSlug = data[0].evento;
      const realSlug = configSlug.replace('CONFIG_ATIVO_', '');
      _slugEventoAtivoEncontrado = realSlug;

      // Marca que o evento desta sala já esteve ativo (p/ detectar finalização)
      if (realSlug === _eventoSlugAtual) _eventoEstavaAtivo = true;

      if (nomeEl) {
        // Tenta pegar o nome do jogo salvo ou usa um padrão
        nomeEl.textContent = 'Evento Telão Ao Vivo';
        // Se houver lead salvo para esse slug, podemos mostrar o placar ou times
        const lead = _eventoLeadLocal(realSlug);
        if (lead && lead.casa) nomeEl.textContent = `${lead.casa} × ${lead.fora}`;
      }

      if (container) {
        container.classList.remove('hidden');
        container.classList.add('fade-in');
      }
    } else {
      if (container) container.classList.add('hidden');
      _slugEventoAtivoEncontrado = null;

      // Se a pessoa está DENTRO da sala e o evento (que estava ativo) sumiu,
      // o GM finalizou → mostra a tela de encerramento com recomendação.
      const room = document.getElementById('view-evento');
      const salaAberta = room && !room.classList.contains('hidden');
      if (salaAberta && _eventoEstavaAtivo && _eventoSlugAtual) {
        _eventoEstavaAtivo = false;
        mostrarEventoFinalizado();
      }
    }
  } catch (e) {
    console.warn('[evento] erro ao checar eventos globais:', e);
  }
}

// Chamada pelo botão do menu principal
function abrirSalaEventoDesdeMenu() {
  if (_slugEventoAtivoEncontrado) {
    abrirSalaEvento(_slugEventoAtivoEncontrado);
  } else {
    alert('O evento não está mais ativo ou foi finalizado pelo Mago.');
  }
}

// Inicia o monitoramento global (roda sempre que o app inicia)
function iniciarMonitoramentoEventos() {
  checarEventoAtivoGlobal();
  if (_eventoGlobalPollTimer) clearInterval(_eventoGlobalPollTimer);
  _eventoGlobalPollTimer = setInterval(checarEventoAtivoGlobal, 10000); // Checa a cada 10s
}

// Adiciona ao carregamento inicial do sistema (auth.js ou ui.js costumam chamar)
document.addEventListener('DOMContentLoaded', () => {
  // Atraso curto para o Supabase carregar
  setTimeout(iniciarMonitoramentoEventos, 1500);
});

function _eventoLeadLocal(slug) {
  try {
    const raw = localStorage.getItem('evento_telao_lead_' + slug);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// Extrai o placar (casa, fora) de um texto tipo "Brasil 2 x 0 Argentina"
function _eventoParsePalpite(texto) {
  const m = String(texto || '').match(/(\d+)\s*x\s*(\d+)/i);
  if (!m) return null;
  return { casa: parseInt(m[1], 10), fora: parseInt(m[2], 10) };
}

// ---- Abre a sala (chamada após o login, pelo entrarNoApp) ----
function abrirSalaEvento(slug) {
  _eventoSlugAtual = slug;
  _eventoEstavaAtivo = false;  // será marcado true pelo poll global se o evento estiver ativo
  // Ponteiro persistente do "último evento" (não some ao sair) — alimenta o
  // botão "Voltar ao Evento" na home.
  try { localStorage.setItem('evento_telao_ultimo', slug); } catch (_) {}

  const lead = _eventoLeadLocal(slug);

  // Descobre o fixture: do lead salvo ou do próprio slug (fixture_<id>)
  _eventoFixtureId = (lead && lead.fixtureId) ? lead.fixtureId
                    : (slug && slug.indexOf('fixture_') === 0 ? slug.replace('fixture_', '') : null);

  // Esconde o app do bolão e as barras de navegação; mostra o overlay
  const appScreen = document.getElementById('screen-app');
  const loginScreen = document.getElementById('screen-login');
  if (appScreen) appScreen.classList.add('hidden');
  if (loginScreen) loginScreen.classList.add('hidden');
  const nav = document.getElementById('bottom-nav');
  const gmNav = document.getElementById('gm-bottom-nav');
  if (nav) nav.classList.add('hidden');
  if (gmNav) gmNav.classList.add('hidden');

  const overlay = document.getElementById('view-evento');
  if (overlay) overlay.classList.remove('hidden');

  // Card "Seu número"
  if (lead && lead.numero) {
    document.getElementById('evento-meu-numero').textContent = lead.numero;
    document.getElementById('evento-meu-palpite').textContent = lead.palpite || '';
    document.getElementById('evento-meu-numero-card').classList.remove('hidden');
  }

  // Nomes/escudos provisórios a partir do lead (até a API responder)
  if (lead && (lead.casa || lead.fora)) {
    _eventoSetTimes(lead.casa, lead.fora, lead.casaLogo, lead.foraLogo);
  }

  // Placar ao vivo (se houver jogo vinculado)
  if (_eventoFixtureId) {
    document.getElementById('evento-placar-card').classList.remove('hidden');
    document.getElementById('evento-legenda-acerto').classList.remove('hidden');
    atualizarPlacarEvento();
    if (_eventoPollTimer) clearInterval(_eventoPollTimer);
    _eventoPollTimer = setInterval(atualizarPlacarEvento, 45000); // respeita a quota da API
  }

  carregarParticipantesEvento();

  // Inicia polling do sorteio (mais frequente: a cada 5s)
  if (_eventoSorteioTimer) clearInterval(_eventoSorteioTimer);
  _eventoSorteioTimer = setInterval(verificarSorteioEvento, 5000);
  verificarSorteioEvento(); // primeira checada imediata
}

function sairDaSalaEvento() {
  if (_eventoPollTimer) { clearInterval(_eventoPollTimer); _eventoPollTimer = null; }
  if (_eventoSorteioTimer) { clearInterval(_eventoSorteioTimer); _eventoSorteioTimer = null; }
  try { localStorage.removeItem('evento_telao_pending'); } catch (_) {}

  const overlay = document.getElementById('view-evento');
  if (overlay) overlay.classList.add('hidden');

  const appScreen = document.getElementById('screen-app');
  if (appScreen) appScreen.classList.remove('hidden');

  // Volta para a Home normal do bolão
  if (typeof switchView === 'function') switchView('view-inicio');
  if (typeof carregarGrupos === 'function') carregarGrupos();
}

// ---- Evento finalizado pelo GM: tela de encerramento + recomendação ----
function mostrarEventoFinalizado() {
  // Para os timers da sala
  if (_eventoPollTimer)   { clearInterval(_eventoPollTimer);   _eventoPollTimer = null; }
  if (_eventoSorteioTimer){ clearInterval(_eventoSorteioTimer); _eventoSorteioTimer = null; }

  // Some o evento deste aparelho (acabou — não volta mais)
  try {
    const slug = _eventoSlugAtual;
    localStorage.removeItem('evento_telao_pending');
    localStorage.removeItem('evento_telao_ultimo');
    if (slug) localStorage.removeItem('evento_telao_lead_' + slug);
  } catch (_) {}

  const room = document.getElementById('view-evento');
  if (room) room.classList.add('hidden');
  const fin = document.getElementById('evento-finalizado');
  if (fin) fin.classList.remove('hidden');
}

function finalizadoIrHome() {
  const fin = document.getElementById('evento-finalizado');
  if (fin) fin.classList.add('hidden');
  const appScreen = document.getElementById('screen-app');
  if (appScreen) appScreen.classList.remove('hidden');
  if (typeof switchView === 'function') switchView('view-inicio');
  if (typeof carregarGrupos === 'function') carregarGrupos();
  if (typeof mostrarBotaoVoltarEvento === 'function') mostrarBotaoVoltarEvento();
}

function finalizadoCriarGrupo() {
  finalizadoIrHome();
  if (typeof abrirModal === 'function') abrirModal('modal-criar-grupo');
}

function _eventoSetTimes(casa, fora, casaLogo, foraLogo) {
  if (casa) document.getElementById('evento-home-nome').textContent = casa;
  if (fora) document.getElementById('evento-away-nome').textContent = fora;
  const hl = document.getElementById('evento-home-logo');
  const al = document.getElementById('evento-away-logo');
  if (casaLogo) { hl.src = casaLogo; hl.style.visibility = 'visible'; } else { hl.style.visibility = 'hidden'; }
  if (foraLogo) { al.src = foraLogo; al.style.visibility = 'visible'; } else { al.style.visibility = 'hidden'; }
}

// ---- Placar ao vivo via API-Football ----
async function atualizarPlacarEvento() {
  if (!_eventoFixtureId) return;
  try {
    const resp = await fetch(`https://${EVENTO_API_HOST}/fixtures?id=${_eventoFixtureId}`, {
      headers: { 'x-rapidapi-host': EVENTO_API_HOST, 'x-rapidapi-key': EVENTO_API_KEY }
    });
    const json = await resp.json();
    const j = json.response && json.response[0];
    if (!j) return;

    _eventoSetTimes(j.teams.home.name, j.teams.away.name, j.teams.home.logo, j.teams.away.logo);

    const gh = j.goals.home == null ? 0 : j.goals.home;
    const ga = j.goals.away == null ? 0 : j.goals.away;
    _eventoPlacarVivo = { home: gh, away: ga };
    document.getElementById('evento-placar').textContent = `${gh} - ${ga}`;

    const short = j.fixture.status.short;   // NS, 1H, HT, 2H, ET, FT...
    const elapsed = j.fixture.status.elapsed;
    const statusEl = document.getElementById('evento-status');
    const minutoEl = document.getElementById('evento-minuto');
    const pingEl = document.getElementById('evento-ping');

    const emAndamento = ['1H', '2H', 'ET', 'LIVE', 'P', 'BT'].includes(short);
    if (short === 'NS') {
      statusEl.textContent = 'Em breve';
      statusEl.className = 'text-[10px] font-black uppercase tracking-widest text-text-muted';
      minutoEl.textContent = new Date(j.fixture.date).toLocaleString('pt-BR');
      if (pingEl) pingEl.classList.add('hidden');
    } else if (short === 'HT') {
      statusEl.textContent = 'Intervalo';
      statusEl.className = 'text-[10px] font-black uppercase tracking-widest text-amber-400';
      minutoEl.textContent = '';
      if (pingEl) pingEl.classList.remove('hidden');
    } else if (short === 'FT' || short === 'AET' || short === 'PEN') {
      statusEl.textContent = 'Encerrado';
      statusEl.className = 'text-[10px] font-black uppercase tracking-widest text-text-muted';
      minutoEl.textContent = 'Resultado final';
      if (pingEl) pingEl.classList.add('hidden');
      if (_eventoPollTimer) { clearInterval(_eventoPollTimer); _eventoPollTimer = null; }
    } else if (emAndamento) {
      statusEl.textContent = '● Ao vivo';
      statusEl.className = 'text-[10px] font-black uppercase tracking-widest text-red-500';
      minutoEl.textContent = elapsed ? elapsed + "'" : '';
      if (pingEl) pingEl.classList.remove('hidden');
    }

    _eventoRenderParticipantes();   // re-pinta quem está cravando
  } catch (e) {
    console.warn('[evento] erro ao buscar placar ao vivo:', e);
  }
}

// ---- Participantes (view pública, sem WhatsApp) ----
async function carregarParticipantesEvento() {
  if (!_eventoSlugAtual || typeof sbClient === 'undefined' || !sbClient) return;
  try {
    const { data, error } = await sbClient
      .from('evento_telao_publico')
      .select('id, nome, palpite, numero_sorte, criado_em')
      .eq('evento', _eventoSlugAtual)
      .order('criado_em', { ascending: false })
      .limit(500);
    if (error) throw error;
    _eventoParticipantes = data || [];
    _eventoRenderParticipantes();
  } catch (e) {
    console.error('[evento] erro ao carregar participantes:', e);
    document.getElementById('evento-lista-participantes').innerHTML =
      '<p class="text-text-muted text-[13px] text-center py-8">Não foi possível carregar agora. Toque em Atualizar.</p>';
  }
}

function recarregarParticipantesEvento() {
  carregarParticipantesEvento();
  if (_eventoFixtureId) atualizarPlacarEvento();
}

// ---- Sorteio (Raffle) ----
async function verificarSorteioEvento() {
  if (!_eventoSlugAtual || typeof sbClient === 'undefined' || !sbClient) return;

  try {
    const { data, error } = await sbClient
      .from('evento_sorteio_telao')
      .select('id, numero_sorte, nome')
      .eq('evento', _eventoSlugAtual)
      .order('criado_em', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log('[evento] Nenhum sorteio encontrado para:', _eventoSlugAtual);
      return;
    }

    const sorteio = data[0];
    console.log('[evento] Último sorteio detectado:', sorteio.numero_sorte, sorteio.nome);

    // Se é um sorteio novo (ID diferente do último visto)
    if (sorteio.id !== _eventoLastSorteioId) {
      _eventoLastSorteioId = sorteio.id;
      exibirVencedorEvento(sorteio);
    }
  } catch (e) {
    console.warn('[evento] erro ao checar sorteio:', e);
  }
}

function exibirVencedorEvento(sorteio) {
  const overlay = document.getElementById('evento-vencedor-overlay');
  if (!overlay) return;

  const lead = _eventoLeadLocal(_eventoSlugAtual);
  const souEu = lead && String(lead.numero) === String(sorteio.numero_sorte);

  const titulo = document.getElementById('evento-vencedor-titulo');
  const nome = document.getElementById('evento-vencedor-nome');
  const numero = document.getElementById('evento-vencedor-numero');
  const msg = document.getElementById('evento-vencedor-msg');
  const modal = document.getElementById('evento-vencedor-modal');
  const avisoGanhador = document.getElementById('evento-vencedor-aviso-ganhador');

  // Classes base do modal para manter o layout
  const baseClasses = 'relative bg-card-bg rounded-3xl p-8 w-full max-w-[320px] flex flex-col items-center ';

  if (souEu) {
    titulo.textContent = '🎉 VOCÊ GANHOU! 🎉';
    titulo.className = 'text-2xl font-black text-gold mb-2 text-center animate-bounce';
    modal.className = baseClasses + 'border-4 border-gold shadow-[0_0_50px_rgba(251,191,36,0.4)]';
    msg.textContent = 'Parabéns! Vá até o Mago para retirar seu prêmio!';
    if (avisoGanhador) avisoGanhador.classList.remove('hidden');
  } else {
    titulo.textContent = 'Temos um ganhador!';
    titulo.className = 'text-xl font-black text-white mb-2 text-center';
    modal.className = baseClasses + 'border border-white/10 shadow-2xl';
    msg.textContent = 'Fique atento, o próximo pode ser você!';
    if (avisoGanhador) avisoGanhador.classList.add('hidden');
  }

  nome.textContent = sorteio.nome;
  numero.textContent = 'Nº ' + sorteio.numero_sorte;

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');

  // Confetes se ganhou
  if (souEu && typeof confetti === 'function') {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#ffffff', '#10b981'] });
  }
}

function fecharVencedorEvento() {
  const overlay = document.getElementById('evento-vencedor-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
}

function _eventoRenderParticipantes() {
  const cont = document.getElementById('evento-lista-participantes');
  document.getElementById('evento-total').textContent = _eventoParticipantes.length;

  if (!_eventoParticipantes.length) {
    cont.innerHTML = '<p class="text-text-muted text-[13px] text-center py-8">Seja o primeiro a palpitar! 🎯</p>';
    return;
  }

  const meuNumero = (_eventoLeadLocal(_eventoSlugAtual) || {}).numero;

  cont.innerHTML = _eventoParticipantes.map(p => {
    const pp = _eventoParsePalpite(p.palpite);
    const cravando = _eventoPlacarVivo && pp &&
      pp.casa === _eventoPlacarVivo.home && pp.fora === _eventoPlacarVivo.away;
    const ehMeu = meuNumero && String(p.numero_sorte) === String(meuNumero);

    const borda = ehMeu ? 'border-gold/40' : (cravando ? 'border-brand-green/40' : 'border-white/5');
    const bg = ehMeu ? 'bg-gold/5' : (cravando ? 'bg-brand-green/5' : 'bg-card-bg');
    const dot = cravando ? '<span class="text-brand-green">🟢</span> ' : '';
    const tagMeu = ehMeu ? '<span class="text-[8px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded ml-1">você</span>' : '';

    return `
      <div class="flex items-center justify-between ${bg} border ${borda} rounded-xl p-3">
        <div class="min-w-0">
          <p class="text-[13px] font-bold text-white truncate">${dot}${_eventoEsc(p.nome)}${tagMeu}</p>
          <p class="text-[11px] text-text-muted truncate">${_eventoEsc(p.palpite)}</p>
        </div>
        <span class="text-[11px] font-black text-gold bg-gold/10 border border-gold/20 px-2 py-1 rounded-lg tracking-wider flex-shrink-0 ml-2">Nº ${_eventoEsc(p.numero_sorte)}</span>
      </div>`;
  }).join('');
}

function _eventoEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
