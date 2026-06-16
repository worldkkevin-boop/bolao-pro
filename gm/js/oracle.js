/* =========================================================
   ORACULO — módulo standalone
   Usa API-Football + palpite local Supabase
   ========================================================= */
const ORACLE = (() => {
  const HOST = 'v3.football.api-sports.io';
  let KEY = null;
  let keyPromise = null;

  async function key() {
    if (KEY) return KEY;
    if (!keyPromise) keyPromise = (async () => {
      try {
        const r = await fetch('/js/config.js?v=20'); // força download
        const txt = await r.text();
        const m = txt.match(/REACT_APP_API_FOOTBALL_KEY:\s*['"]([^'"]+)['"]/);
        if (m) KEY = m[1];
      } catch (_) {}
      KEY = KEY || (function () {
        try {
          // Tenta vindo de window.__ env se app expuser (opcional)
          return '';
        } catch (_) { return ''; }
      })();
      return KEY;
    })();
    return keyPromise;
  }

  async function hdrs() {
    const k = await key();
    return {
      'x-rapidapi-host': HOST,
      'x-rapidapi-key': k
    };
  }

  // ---------------------------------------------------------
  // /fixtures H2H (para comparison + últimos jogos)
  // ---------------------------------------------------------
  async function h2h(fixtureId) {
    const j = await fetchJson(`/fixtures/headtohead?h2h=${fixtureId}`);
    return (j.response || []).slice(0, 8);
  }

  // ---------------------------------------------------------
  // /fixtures/statistics (para placares e gols, com fallback
  // ---------------------------------------------------------

  // ---------------------------------------------------------
  // Actually: predictions
  // ---------------------------------------------------------
  async function predictions(fixtureId) {
    const j = await fetchJson(`/predictions?fixture=${fixtureId}`);
    if (!j.response || !j.response.length) throw new Error('Sem predições para esta partida.');
    const p = j.response[0];
    const x = p.predictions.percent || {};
    return {
      teams: p.teams,
      winner: p.predictions.winner,
      advice: p.predictions.advice,
      under_over: p.predictions.under_over || null,
      win_or_draw: p.predictions.win_or_draw || false,
      percent: {
        home: parseFloat(x.home) || 0,
        draw: parseFloat(x.draw) || 0,
        away: parseFloat(x.away) || 0
      },
      goals: p.predictions.goals,
      comparison: p.comparison || null,
      h2h: p.h2h ? p.h2h.slice(0, 5) : (await h2h(fixtureId)),
      homeLast5: p.teams?.home?.last_5 || null,
      awayLast5: p.teams?.away?.last_5 || null,
      homeFixtures: p.teams?.home?.fixtures || null,
      awayFixtures: p.teams?.away?.fixtures || null,
      league: p.league || null
    };
  }

  async function fetchJson(path) {
    const r = await fetch(`https://${HOST}${path}`, { headers: await hdrs() });
    if (!r.ok) throw new Error(`API-Football ${r.status}`);
    return r.json().catch(() => ({}));
  }

  return {
    predictions,
    hero
  };
})();
