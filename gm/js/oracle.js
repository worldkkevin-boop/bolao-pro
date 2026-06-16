/* =========================================================
   ORACULO — módulo standalone
   Usa API-Football + palpite local Supabase
   ========================================================= */

// Stub inicial para evitar ReferenceError antes da inicialização.
const ORACLE = window.ORACLE || {
  async predictions(fixtureId) {
    throw new Error('ORACLE.predictions nao inicializado');
  }
};

(() => {
  const HOST = 'v3.football.api-sports.io';
  const API_KEY = '47ca2bb05eb5931347aca04964818eb5';

  async function fetchJson(path) {
    const headers = {
      'x-rapidapi-host': HOST,
      'x-rapidapi-key': API_KEY
    };

    const r = await fetch(`https://${HOST}${path}`, { headers });
    if (!r.ok) {
      throw new Error(`API-Football ${r.status}`);
    }
    const data = await r.json().catch(() => ({}));
    return data;
  }

  async function predictions(fixtureId) {
    const j = await fetchJson(`/predictions?fixture=${fixtureId}`);

    if (!j.response || !j.response.length) {
      throw new Error('Sem predicoes para esta partida.');
    }

    const pred = j.response[0];
    const pct = pred.predictions.percent || {};

    return {
      teams: pred.teams,
      winner: pred.predictions.winner,
      advice: pred.predictions.advice,
      under_over: pred.predictions.under_over || null,
      win_or_draw: !!pred.predictions.win_or_draw,
      percent: {
        home: parseFloat(pct.home) || 0,
        draw: parseFloat(pct.draw) || 0,
        away: parseFloat(pct.away) || 0
      },
      goals: pred.predictions.goals,
      comparison: pred.comparison || null,
      h2h: pred.h2h || null,
      homeLast5: pred.teams?.home?.last_5 || null,
      awayLast5: pred.teams?.away?.last_5 || null,
      homeFixtures: pred.teams?.home?.fixtures || null,
      awayFixtures: pred.teams?.away?.fixtures || null,
      league: pred.league || null
    };
  }

  // Hidrata o objeto global.
  window.ORACLE = Object.assign(window.ORACLE || {}, {
    predictions
  });
})();
