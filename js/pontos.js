// ============================================================
// MOTOR DE PONTUAÇÃO V2 — "Lógica de Mercado" (SUPER UPDATE)
// Regras completas: docs/regras-pontuacao-v2.md
// Funções puras (sem DOM) — dá pra testar via node.
// Grupos legados (sistema 'classico') continuam no motor antigo (ui.js).
// ============================================================

// Knobs padrão do sistema 'mercado' (o "Personalizar" edita uma cópia disto)
const PONTOS_V2_DEFAULTS = {
  base_piso: 5,            // acertou o favorito absoluto (prob >= 90%)
  base_teto: 20,           // teto da zebra
  bonus_exato: 5,          // placar exato
  bonus_placar_vencedor: 3,// acertou os gols do vencedor
  bonus_diferenca: 2,      // acertou a diferença de gols
  bonus_gols_perdedor: 1,  // acertou os gols do perdedor
  bonus_goleada: 1,        // extra: palpitou 4+ gols num time e aconteceu
  extra_prorrogacao: 3,    // acertou quem vence na prorrogação
  extra_penaltis: 3,       // acertou quem vence nos pênaltis
  base_fixa: 5             // usado só pelo sistema 'so_vencedor'
};

// Modos de peso por fase (multiplicam TUDO: base + bônus + tempo extra)
const PESO_MODOS = {
  gradual:           { nome: 'Equilíbrio gradual',    desc: 'Grupos 1× · Mata-mata 2× · Final 4×' },
  acelerado:         { nome: 'Aumenta aceleradamente', desc: 'Rodadas 1×/2×/3× · Mata-mata 4× · Final 6×' },
  unico_final_dobro: { nome: 'Peso único, final o dobro', desc: 'Tudo 1× · Final 2×' },
  unico:             { nome: 'Peso único',            desc: 'Tudo 1×' }
};

function _v2Sinal(h, a) { return h > a ? 'home' : (a > h ? 'away' : 'empate'); }

// ---------- FASE DO JOGO (a partir do round da API-Football) ----------
// Retorna { rodada: 1|2|3|null, mataMata: bool, final: bool }
function faseDoJogoV2(round) {
  const r = (round || '').toLowerCase();
  const final = /final/.test(r) && !/semi|3rd|third|quarter|round of/.test(r);
  const mataMata = /round of|quarter|semi|3rd|third|final/.test(r);
  let rodada = null;
  const m = r.match(/group stage\s*-\s*(\d)/);
  if (m) rodada = parseInt(m[1]);
  return { rodada, mataMata, final };
}

function pesoDaFaseV2(round, modo) {
  const f = faseDoJogoV2(round);
  switch (modo) {
    case 'gradual':           return f.final ? 4 : (f.mataMata ? 2 : 1);
    case 'acelerado':         return f.final ? 6 : (f.mataMata ? 4 : (f.rodada === 3 ? 3 : (f.rodada === 2 ? 2 : 1)));
    case 'unico_final_dobro': return f.final ? 2 : 1;
    default:                  return 1; // 'unico'
  }
}

// ---------- PONTUAÇÃO BASE (o termômetro 5–20) ----------
// Calibrada nos prints de referência: 80%→6 · 21%→12 · 15%→13 · 5%→17.
// prob = probabilidade (%) do RESULTADO que o jogador cravou (casa/empate/fora).
function pontosBaseMercado(prob, cfg) {
  const c = cfg || PONTOS_V2_DEFAULTS;
  const piso = c.base_piso ?? 5, teto = c.base_teto ?? 20;
  if (!(prob > 0)) return piso;          // sem prob salva ainda → base neutra (piso)
  if (prob >= 90) return piso;           // favorito absoluto
  const pts = Math.ceil(piso + 4 * Math.log(100 / prob));
  return Math.min(teto, Math.max(piso, pts));
}

// ---------- BÔNUS DE PLACAR (cascata exclusiva + goleada à parte) ----------
// Só roda se o vencedor foi acertado (regra do produto). Retorna { total, itens }.
function bonusPlacarV2(pH, pA, rH, rA, cfg) {
  const c = cfg || PONTOS_V2_DEFAULTS;
  const itens = [];
  const vp = _v2Sinal(pH, pA), vr = _v2Sinal(rH, rA);
  if (vp !== vr) return { total: 0, itens };

  if (pH === rH && pA === rA) {
    itens.push({ label: 'Placar Exato', pts: c.bonus_exato });
  } else if (vr !== 'empate') {
    let acertouGolsVenc = false, acertouGolsPerd = false;
    if (vr === 'home') { acertouGolsVenc = pH === rH; acertouGolsPerd = pA === rA; }
    else               { acertouGolsVenc = pA === rA; acertouGolsPerd = pH === rH; }
    if (acertouGolsVenc)                                itens.push({ label: 'Placar do Vencedor', pts: c.bonus_placar_vencedor });
    else if (Math.abs(pH - pA) === Math.abs(rH - rA))   itens.push({ label: 'Diferença de Gols',  pts: c.bonus_diferenca });
    else if (acertouGolsPerd)                           itens.push({ label: 'Gols do Perdedor',   pts: c.bonus_gols_perdedor });
  } else {
    // empate não-exato: diferença (0) sempre bate → bônus de diferença
    itens.push({ label: 'Diferença de Gols', pts: c.bonus_diferenca });
  }

  // Goleada (4+): palpitou 4+ pra um time E o MESMO lado fez 4+ (extra, soma à parte)
  if (((pH >= 4 && rH >= 4) || (pA >= 4 && rA >= 4)) && (c.bonus_goleada || 0) > 0) {
    itens.push({ label: 'Goleada (4+)', pts: c.bonus_goleada });
  }

  return { total: itens.reduce((s, i) => s + (i.pts || 0), 0), itens };
}

// ---------- CÁLCULO COMPLETO DE UM PALPITE ----------
// args = {
//   sistema: 'mercado'|'so_vencedor'|'custom',
//   palpiteHome, palpiteAway, realHome, realAway,     (90')
//   probs: { home, draw, away } | null,               (matches.prob_*)
//   round: string, pesoModo: string, cfg: config_pontos | null,
//   extras: { prorrogacao: 'home'|'empate'|'away'|null, penaltis: 'home'|'away'|null,
//             vencedorProrrogacao, vencedorPenaltis }  (opcional, mata-mata)
// }
// Retorna { total, peso, detalhes: [{label, pts}] } — detalhes SEM o peso aplicado.
function calcularPontosV2(args) {
  const cfg = Object.assign({}, PONTOS_V2_DEFAULTS, args.cfg || {});
  const detalhes = [];
  let soma = 0;

  const pH = parseInt(args.palpiteHome), pA = parseInt(args.palpiteAway);
  const rH = parseInt(args.realHome),   rA = parseInt(args.realAway);
  const tem90 = !isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA);

  if (tem90) {
    const vp = _v2Sinal(pH, pA), vr = _v2Sinal(rH, rA);
    if (vp === vr) {
      // base pela probabilidade do resultado cravado
      let base;
      if (args.sistema === 'so_vencedor') {
        base = cfg.base_fixa ?? 5;
      } else {
        const p = args.probs || {};
        const prob = vr === 'home' ? p.home : (vr === 'away' ? p.away : p.draw);
        base = pontosBaseMercado(prob, cfg);
      }
      detalhes.push({ label: 'Pontos Base', pts: base });
      soma += base;

      if (args.sistema !== 'so_vencedor') {
        const b = bonusPlacarV2(pH, pA, rH, rA, cfg);
        b.itens.forEach(i => detalhes.push(i));
        soma += b.total;
      }
    }
    // errou o vencedor → 0 no 90' (mercado não tem prêmio de consolação)
  }

  // Tempo extra (independe do 90')
  const ex = args.extras || {};
  if (ex.prorrogacao && ex.vencedorProrrogacao && ex.prorrogacao === ex.vencedorProrrogacao) {
    detalhes.push({ label: 'Prorrogação', pts: cfg.extra_prorrogacao });
    soma += cfg.extra_prorrogacao;
  }
  if (ex.penaltis && ex.vencedorPenaltis && ex.penaltis === ex.vencedorPenaltis) {
    detalhes.push({ label: 'Pênaltis', pts: cfg.extra_penaltis });
    soma += cfg.extra_penaltis;
  }

  const peso = pesoDaFaseV2(args.round, args.pesoModo || 'unico');
  return { total: soma * peso, peso, detalhes };
}

// ---------- DESEMPATE (ordem estrita de 8 critérios) ----------
// stats por jogador: { pontos, acertouVencedor, placarExato, golsVencedor,
//                      diferencaGols, golsPerdedor, goleadas, entradaTs }
function compararDesempateV2(a, b) {
  if (b.pontos          !== a.pontos)          return b.pontos          - a.pontos;
  if (b.acertouVencedor !== a.acertouVencedor) return b.acertouVencedor - a.acertouVencedor;
  if (b.placarExato     !== a.placarExato)     return b.placarExato     - a.placarExato;
  if (b.golsVencedor    !== a.golsVencedor)    return b.golsVencedor    - a.golsVencedor;
  if (b.diferencaGols   !== a.diferencaGols)   return b.diferencaGols   - a.diferencaGols;
  if (b.golsPerdedor    !== a.golsPerdedor)    return b.golsPerdedor    - a.golsPerdedor;
  if (b.goleadas        !== a.goleadas)        return b.goleadas        - a.goleadas;
  return (a.entradaTs || 0) - (b.entradaTs || 0); // quem entrou primeiro fica na frente
}

// Export pra teste via node (no browser vira global mesmo)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PONTOS_V2_DEFAULTS, PESO_MODOS, pontosBaseMercado, bonusPlacarV2, calcularPontosV2, pesoDaFaseV2, faseDoJogoV2, compararDesempateV2 };
}
