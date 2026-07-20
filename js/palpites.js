// ============================================================
// PALPITES V2 (SUPER UPDATE) — a aba de palpites repaginada
// Carrossel de dias + cards agrupados por data + peso dos jogos.
// Lê os globais que o carregarJogos já preenche (todosOsJogos,
// palpitesUsuario, distribuicaoPalpitesGrupo). O clique no card
// continua caindo no fluxo existente (abrirTelaPalpite).
// Sub-aba "Responder" (perguntas) = Em breve.
// ============================================================

let _palAba = 'palpitar';     // palpitar | responder
let _palFiltro = 'proximos';  // proximos | finalizados

const _PAL_FIM = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'];
const _PAL_VIVO = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT', 'SUSP'];
const _PAL_DIAS_SEMANA = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];
const _PAL_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function _palSigla(nome) {
  if (!nome) return '???';
  const especiais = { 'South Korea': 'KOR', 'Korea Republic': 'KOR', 'United States': 'USA', 'USA': 'USA', 'New Zealand': 'NZL', 'Saudi Arabia': 'KSA', 'South Africa': 'RSA', 'Cape Verde Islands': 'CPV', 'Cape Verde': 'CPV', 'Ivory Coast': 'CIV', 'Czech Republic': 'CZE', 'Curacao': 'CUW' };
  if (especiais[nome]) return especiais[nome];
  return nome.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

function _palDataKey(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _palHoje() { return _palDataKey(new Date().toISOString()); }

function _palMeuPalpite(matchId) {
  return (palpitesUsuario || []).find(p => p.match_id === matchId) || null;
}

function _palJogoEncerrado(j) { return _PAL_FIM.includes(j.fixture.status.short); }
function _palJogoAoVivo(j) { return _PAL_VIVO.includes(j.fixture.status.short); }

// Rodada "atual": a de um jogo ao vivo (prioridade), senão a do próximo jogo a
// rolar, senão (tudo encerrado) a do último jogo. `jogos` precisa vir ordenado
// cronologicamente. Funciona pra liga ("Regular Season - N") e mata-mata.
function _palRodadaAtual(jogos) {
  const aoVivo = jogos.find(j => _palJogoAoVivo(j));
  if (aoVivo) return (aoVivo.league && aoVivo.league.round) || null;
  const proximo = jogos.find(j => !_palJogoEncerrado(j) && !_palJogoAoVivo(j));
  if (proximo) return (proximo.league && proximo.league.round) || null;
  const ultimo = jogos.slice().reverse().find(j => _palJogoEncerrado(j));
  return ultimo ? ((ultimo.league && ultimo.league.round) || null) : null;
}

// ---------- render principal ----------
function renderPalpitesV2() {
  const el = document.getElementById('palpites-v2');
  if (!el) return;

  const ABA_A = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-black transition-all border-brand-green/40 bg-brand-green/10 text-brand-green';
  const ABA_I = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-black transition-all border-amber-400/30 bg-card-bg text-amber-300/80';

  let html = `
    <div class="flex gap-2 mb-4 mt-3">
      <button onclick="palSetAba('palpitar')" class="${_palAba === 'palpitar' ? ABA_A : ABA_A.replace(/border-brand-green\/40 bg-brand-green\/10 text-brand-green/, 'border-white/5 bg-card-bg text-text-muted')}">📝 Palpitar</button>
      <button onclick="palSetAba('responder')" class="${_palAba === 'responder' ? ABA_A : ABA_I}">💬 Responder</button>
    </div>`;

  if (_palAba === 'responder') {
    el.innerHTML = html + `
      <div class="bg-card-bg border border-white/5 rounded-3xl p-8 text-center mt-4">
        <div class="text-5xl mb-3">💬</div>
        <span class="inline-block bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">Em breve</span>
        <h3 class="font-black text-white text-lg mb-2">Perguntas da Copa</h3>
        <p class="text-text-muted text-[13px] leading-relaxed max-w-[280px] mx-auto">Dezenas de perguntas especiais pra responder antes e durante o torneio — valendo um ranking próprio. Enquanto isso, as Perguntas Bônus do grupo continuam valendo!</p>
      </div>`;
    return;
  }

  const jogos = (todosOsJogos || []).slice().sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  if (!jogos.length) {
    el.innerHTML = html + '<p class="text-text-muted text-[13px] text-center py-10 animate-pulse">Carregando os jogos...</p>';
    return;
  }

  // ---------- carrossel de dias ----------
  const hoje = _palHoje();
  const dias = {};
  jogos.forEach(j => {
    const k = _palDataKey(j.fixture.date);
    if (!dias[k]) dias[k] = { jogos: 0, palpitados: 0, encerrados: 0, data: new Date(j.fixture.date) };
    dias[k].jogos++;
    if (_palMeuPalpite(j.fixture.id)) dias[k].palpitados++;
    if (_palJogoEncerrado(j)) dias[k].encerrados++;
  });
  const chavesDias = Object.keys(dias).sort();

  html += `<div id="pal-dias" class="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">`;
  chavesDias.forEach(k => {
    const d = dias[k];
    const ehHoje = k === hoje;
    const passado = k < hoje;
    let statusDot;
    if (d.palpitados >= d.jogos) statusDot = '<span class="w-4 h-4 rounded-full bg-brand-green text-black text-[9px] font-black flex items-center justify-center">✓</span>';
    else if (passado || d.encerrados > 0) statusDot = '<span class="w-3.5 h-3.5 rounded-full bg-zinc-500/60"></span>';
    else statusDot = '<span class="w-3.5 h-3.5 rounded-full border-2 border-zinc-500"></span>';
    html += `
      <button id="pal-dia-btn-${k}" onclick="palIrParaDia('${k}')"
        class="shrink-0 w-14 py-2.5 rounded-[1.4rem] flex flex-col items-center gap-1 border transition-all
        ${ehHoje ? 'border-brand-green border-dashed bg-brand-green/5' : 'border-white/10 bg-card-bg'}">
        <span class="text-[9px] font-black text-text-muted">${_PAL_DIAS_SEMANA[d.data.getDay()]}</span>
        <span class="text-[15px] font-black ${ehHoje ? 'text-brand-green' : ''}">${d.data.getDate()}</span>
        ${statusDot}
      </button>`;
  });
  html += `</div>`;

  // ---------- toggle Próximos / Rodada atual / Finalizados ----------
  const rodadaAtual = _palRodadaAtual(jogos);
  const TG_A = 'flex-1 py-2.5 rounded-full text-[12.5px] font-black bg-brand-green/15 text-brand-green transition-all';
  const TG_I = 'flex-1 py-2.5 rounded-full text-[12.5px] font-bold text-text-muted transition-all';
  html += `
    <div class="flex bg-card-bg border border-white/5 rounded-full p-1 mb-5 max-w-[360px] mx-auto">
      <button onclick="palSetFiltro('proximos')" class="${_palFiltro === 'proximos' ? TG_A : TG_I}">Próximos</button>
      ${rodadaAtual ? `<button onclick="palSetFiltro('rodada')" class="${_palFiltro === 'rodada' ? TG_A : TG_I}">📍 Rodada atual</button>` : ''}
      <button onclick="palSetFiltro('finalizados')" class="${_palFiltro === 'finalizados' ? TG_A : TG_I}">Finalizados</button>
    </div>`;

  // ---------- jogos filtrados + agrupados por data ----------
  let filtrados;
  if (_palFiltro === 'finalizados') {
    filtrados = jogos.filter(j => _palJogoEncerrado(j));
    filtrados.reverse(); // mais recentes primeiro
  } else if (_palFiltro === 'rodada' && rodadaAtual) {
    filtrados = jogos.filter(j => (j.league && j.league.round) === rodadaAtual);
  } else {
    filtrados = jogos.filter(j => !_palJogoEncerrado(j));
  }

  if (!filtrados.length) {
    const msg = _palFiltro === 'finalizados' ? 'Nenhum jogo finalizado ainda.'
      : _palFiltro === 'rodada' ? 'Nenhum jogo nessa rodada.'
      : 'Nenhum jogo por vir — campeonato encerrado! 🏆';
    html += `<p class="text-text-muted text-[13px] text-center py-10">${msg}</p>`;
    el.innerHTML = html; return;
  }

  let dataAtual = null, primeiroGrupo = true;
  filtrados.forEach(j => {
    const k = _palDataKey(j.fixture.date);
    if (k !== dataAtual) {
      // card do peso dos jogos depois do 1º grupo de datas (como na referência)
      if (!primeiroGrupo && dataAtual !== null && _palFiltro === 'proximos' && !html.includes('id="pal-peso-card"')) {
        html += _palCardPeso();
      }
      dataAtual = k; primeiroGrupo = false;
      const d = new Date(j.fixture.date);
      const qtd = filtrados.filter(x => _palDataKey(x.fixture.date) === k).length;
      html += `
        <div id="pal-dia-${k}" class="flex items-center justify-between mb-3 mt-5">
          <p class="font-black text-[16px] flex items-center gap-2">📅 ${d.getDate()} De ${_PAL_MESES[d.getMonth()]}</p>
          <span class="bg-card-bg border border-white/5 text-text-muted text-[11px] font-bold px-3 py-1 rounded-full">${qtd} jogo${qtd > 1 ? 's' : ''}</span>
        </div>`;
    }
    html += _palCardJogo(j);
  });

  el.innerHTML = html;

  // auto-scroll do carrossel pro dia de hoje (ou o primeiro futuro)
  const alvo = document.getElementById('pal-dia-btn-' + (dias[hoje] ? hoje : (chavesDias.find(c => c >= hoje) || chavesDias[0])));
  if (alvo) alvo.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---------- card de jogo ----------
function _palCardJogo(j) {
  const id = j.fixture.id;
  const kickoff = new Date(j.fixture.date);
  const meu = _palMeuPalpite(id);
  const encerrado = _palJogoEncerrado(j);
  const aoVivo = _palJogoAoVivo(j);
  const trava = new Date(kickoff.getTime() - 10 * 60 * 1000);
  const fechado = new Date() > trava;

  const hora = kickoff.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const h = j.teams.home, a = j.teams.away;
  const nomeIndef = (n) => /winner|loser|match \d+/i.test(n || '');

  // canto direito do header: countdown / ao vivo / encerrado
  let canto;
  if (aoVivo) canto = `<span class="text-red-400 font-black text-[11px] animate-pulse">● AO VIVO ${j.fixture.status.elapsed || ''}'</span>`;
  else if (encerrado) canto = `<span class="text-text-muted font-bold text-[11px]">ENCERRADO</span>`;
  else {
    const min = Math.max(0, Math.round((kickoff - new Date()) / 60000));
    canto = `<span class="text-text-muted font-bold text-[11px]">${min < 60 ? 'EM ' + min + 'MIN' : 'EM ' + Math.round(min / 60) + 'H'}</span>`;
  }

  const flag = (t) => nomeIndef(t.name)
    ? `<div class="w-14 h-14 rounded-2xl bg-zinc-300/20 border border-white/10"></div>`
    : `<div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2"><img src="${t.logo}" class="w-full h-full object-contain drop-shadow"></div>`;

  // centro: placar real (encerrado/vivo) ou VS
  let centro = `<span class="text-text-muted font-black italic text-lg opacity-60">VS</span>`;
  if (encerrado || aoVivo) {
    const r = (typeof placarValido === 'function') ? placarValido(j) : { home: j.goals.home, away: j.goals.away };
    centro = `<span class="font-black text-2xl ${aoVivo ? 'text-red-300' : 'text-white'}">${r.home ?? '–'} <span class="text-text-muted text-base">×</span> ${r.away ?? '–'}</span>`;
  }

  // status box (direita)
  const statusBox = meu
    ? `<div class="flex flex-col items-center gap-1"><span class="text-[9px] font-black text-text-muted uppercase">Status</span>
        <div class="w-10 h-10 rounded-xl bg-brand-green/15 border border-brand-green/50 flex items-center justify-center text-brand-green font-black">✓</div>
        <span class="text-[9px] text-brand-green font-bold leading-tight text-center">Palpite<br>feito</span></div>`
    : `<div class="flex flex-col items-center gap-1"><span class="text-[9px] font-black text-text-muted uppercase">Status</span>
        <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/15"></div>
        <span class="text-[9px] text-text-muted font-bold leading-tight text-center">Sem<br>palpite</span></div>`;

  // rodapé: total de palpites do grupo + seu palpite / CTA
  const dist = (typeof distribuicaoPalpitesGrupo !== 'undefined' && distribuicaoPalpitesGrupo[id]) || null;
  const totalPalpites = dist ? dist.total : null;

  let rodape = '';
  if (meu) {
    // pontos ganhos (se encerrado)
    let ptsBadge = '';
    if (encerrado) {
      const r = (typeof placarValido === 'function') ? placarValido(j) : { home: j.goals.home, away: j.goals.away };
      if (r.home != null && r.away != null) {
        const vr = r.home > r.away ? 'home' : (r.home < r.away ? 'away' : 'empate');
        const pct = dist ? dist[vr] : 100;
        const pts = (typeof calcularPontosPalpite === 'function') ? calcularPontosPalpite(meu.score_home, meu.score_away, r.home, r.away, j.league.round, pct) : 0;
        ptsBadge = `<span class="ml-auto font-black text-[13px] ${pts > 0 ? 'text-brand-green' : 'text-zinc-500'}">${pts > 0 ? '+' + pts + ' pts' : '0 pts'}</span>`;
      }
    }
    rodape = `
      <div onclick="event.stopPropagation(); palAbrirPalpite(${id})" class="mt-3 flex items-center gap-2.5 bg-black/25 border border-white/5 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-brand-green/30">
        <span class="text-[10px] font-black text-text-muted uppercase tracking-wider">Seu palpite:</span>
        <img src="${h.logo}" class="w-5 h-5 object-contain"><span class="font-black text-[14px]">${meu.score_home}</span>
        <span class="text-[10px] text-text-muted font-bold">vs</span>
        <span class="font-black text-[14px]">${meu.score_away}</span><img src="${a.logo}" class="w-5 h-5 object-contain">
        ${!fechado ? '<span class="text-brand-green text-[13px]">✏️</span>' : ''}
        ${ptsBadge}
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-text-muted ${ptsBadge ? '' : 'ml-auto'}"><path d="M9 5l7 7-7 7"/></svg>
      </div>`;
  } else if (!encerrado) {
    rodape = fechado
      ? `<div class="mt-3 text-center bg-white/5 border border-white/10 rounded-xl py-3 text-[12px] font-bold text-text-muted">🔒 Palpites fechados</div>`
      : `<button onclick="event.stopPropagation(); palAbrirPalpite(${id})" class="mt-3 w-full bg-brand-green/90 hover:bg-brand-green text-black font-black py-3 rounded-xl text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all">Enviar Palpite <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>`;
  } else {
    rodape = `<div class="mt-3 text-center text-[12px] text-text-muted">Você não palpitou neste jogo</div>`;
  }

  return `
    <div onclick="palAbrirPalpite(${id})" class="bg-card-bg rounded-3xl border border-white/5 p-4 mb-3 cursor-pointer hover:border-brand-green/20 transition-all">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[12px] font-bold text-zinc-300">🕐 ${hora}</span>
        ${canto}
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4 flex-1 justify-center">
          <div class="flex flex-col items-center gap-1.5 w-20">${flag(h)}<span class="text-[11px] font-black">${nomeIndef(h.name) ? h.name.replace('Winner Match', 'Venc. #').replace('Loser Match', 'Perd. #') : _palSigla(h.name)}</span></div>
          ${centro}
          <div class="flex flex-col items-center gap-1.5 w-20">${flag(a)}<span class="text-[11px] font-black">${nomeIndef(a.name) ? a.name.replace('Winner Match', 'Venc. #').replace('Loser Match', 'Perd. #') : _palSigla(a.name)}</span></div>
        </div>
        ${statusBox}
      </div>
      ${totalPalpites ? `<p class="text-[11px] text-text-muted mt-2.5 flex items-center gap-1.5">👥 ${totalPalpites} palpite${totalPalpites > 1 ? 's' : ''} no grupo</p>` : ''}
      ${rodape}
    </div>`;
}

// ---------- card + modal "O peso dos jogos" ----------
function _palPesoInfo() {
  // Grupo V2 (wizard) usa peso_modo; grupos legados usam mult_fase_final
  const g = grupoAtual || {};
  const ehV2 = g.sistema_pontos && g.sistema_pontos !== 'classico' && g.peso_modo;
  const modo = ehV2 ? g.peso_modo : ((g.mult_fase_final || 1) > 1 ? 'legado' : 'unico');
  const nome = ehV2 && typeof PESO_MODOS !== 'undefined' && PESO_MODOS[modo] ? PESO_MODOS[modo].nome
    : (modo === 'legado' ? `Mata-mata ${g.mult_fase_final}×` : 'Peso único');

  // blocos por peso a partir dos jogos carregados
  const blocos = {};
  (todosOsJogos || []).forEach(j => {
    const round = (j.league && j.league.round) || '';
    let peso, rot;
    if (ehV2 && typeof pesoDaFaseV2 === 'function') {
      peso = pesoDaFaseV2(round, modo);
      const f = faseDoJogoV2(round);
      rot = f.final ? 'A Final' : (f.mataMata ? 'Fase Final' : (f.rodada ? f.rodada + 'ª Rodada' : 'Fase Grupos'));
    } else {
      const mata = /round of|oitavas|quartas|semi|final/i.test(round);
      peso = mata ? (g.mult_fase_final || 1) : 1;
      rot = mata ? 'Mata-mata' : 'Fase Grupos';
    }
    const key = rot + '|' + peso;
    if (!blocos[key]) blocos[key] = { rotulo: rot, peso, jogos: 0 };
    blocos[key].jogos++;
  });
  return { nome, blocos: Object.values(blocos).sort((x, y) => x.peso - y.peso) };
}

function _palCardPeso() {
  const info = _palPesoInfo();
  const chips = info.blocos.slice(0, 3).map(b => `
    <span class="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-bold">${b.rotulo} <b class="text-brand-green">${b.peso}×</b></span>`).join('');
  return `
    <div id="pal-peso-card" onclick="palModalPeso()" class="bg-card-bg rounded-3xl border border-brand-green/15 p-4 mb-3 mt-4 cursor-pointer flex items-center gap-3 hover:border-brand-green/30 transition-all">
      <div class="flex-1">
        <p class="font-black text-[15px] mb-0.5">O peso dos jogos</p>
        <p class="text-text-muted text-[12px]">A emoção está só começando! Veja como esse grupo está configurado.</p>
      </div>
      <div class="flex flex-col gap-1.5 items-end shrink-0">${chips}</div>
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-text-muted shrink-0"><path d="M9 5l7 7-7 7"/></svg>
    </div>`;
}

function palModalPeso() {
  const info = _palPesoInfo();
  const CORES = { 1: 'text-slate-300 border-slate-500/50', 2: 'text-teal-300 border-teal-500/50', 3: 'text-emerald-300 border-emerald-500/50', 4: 'text-amber-300 border-amber-500/50', 6: 'text-red-300 border-red-500/50' };
  const blocosHtml = info.blocos.map(b => `
    <div class="rounded-2xl border ${CORES[b.peso] || 'border-white/10'} bg-black/20 p-3">
      <p class="text-[10px] font-black uppercase leading-tight mb-2">${b.rotulo}</p>
      <span class="inline-block rounded-lg border ${CORES[b.peso] || ''} px-2 py-0.5 text-[12px] font-black">${b.peso}×</span>
      <p class="text-2xl font-black mt-2">${b.jogos}</p>
      <p class="text-[10px] text-zinc-500">jogo${b.jogos > 1 ? 's' : ''}</p>
    </div>`).join('');

  _mmModal('O peso dos jogos', `
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4 mb-3">
      <p class="text-[13px] text-zinc-400 mb-2">Este grupo usa o sistema de peso:</p>
      <span class="inline-block bg-brand-green/15 text-brand-green border border-brand-green/30 font-black text-[14px] px-4 py-2 rounded-xl">${info.nome}</span>
    </div>
    <div class="rounded-2xl bg-card-bg border border-white/5 p-4 mb-3">
      <p class="font-black text-lg mb-0.5">A regra para todos</p>
      <p class="text-zinc-400 text-[12px] mb-4">O peso de pontos de cada fase da competição.</p>
      <div class="grid grid-cols-3 gap-2">${blocosHtml}</div>
    </div>
    <div class="rounded-2xl border border-brand-green/25 bg-brand-green/5 p-4 mb-3">
      <p class="text-brand-green text-[11px] font-black uppercase tracking-widest mb-1.5">Ninguém fica confortável</p>
      <p class="text-[13px] text-zinc-300 leading-relaxed">O sistema começa suave e vai pegando fogo. A fase de grupos testa o palpiteiro, o mata-mata separa quem é craque de quem tá passeando — e a final decide tudo. Aqui ninguém relaxa até o último jogo. 🔥</p>
    </div>
    <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex gap-2.5">
      <span class="text-amber-400">⚠️</span>
      <p class="text-amber-200/90 text-[12px]">O sistema de pontos e o peso dos jogos <b>não podem ser editados</b> depois que o grupo é criado.</p>
    </div>`);
}

// ---------- interações ----------
function palSetAba(a) { _palAba = a; renderPalpitesV2(); }
function palSetFiltro(f) { _palFiltro = f; renderPalpitesV2(); }
function palIrParaDia(k) {
  // se o dia não está no filtro atual, troca o filtro automaticamente
  const jogosDia = (todosOsJogos || []).filter(j => _palDataKey(j.fixture.date) === k);
  const todosEncerrados = jogosDia.length && jogosDia.every(j => _palJogoEncerrado(j));
  const filtroCerto = todosEncerrados ? 'finalizados' : 'proximos';
  if (filtroCerto !== _palFiltro) { _palFiltro = filtroCerto; renderPalpitesV2(); }
  const alvo = document.getElementById('pal-dia-' + k);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
