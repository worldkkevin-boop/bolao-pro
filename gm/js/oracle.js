/* =========================================================
   ORACULO — módulo standalone
   Usa API-Football + palpite local Supabase
   ========================================================= */
(() => {
  const HOST = 'v3.football.api-sports.io';
  const API_KEY='47ca2bb05eb5931347aca04964818eb5';

  const ORACLE = {
    async predictions(fixtureId) {
      const headers = {
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': API_KEY
      };
      const r = await fetch(`https://${HOST}/predictions?fixture=${fixtureId}`, { headers });
      if (!r.ok) throw new Error(`API-Football ${r.status}`);
      const j = await r.json().catch(() => ({}));
      if (!j.response || !j.response.length) throw new Error('Sem predicoes para esta partida.');
      const p = j.response[0];
      const x = p.predictions.percent || {};
      return {
        teams: p.teams,
        winner: p.predictions.winner,
        advice: p.predictions.advice,
        under_over: p.predictions.under_over || null,
        win_or_draw: !!p.predictions.win_or_draw,
        percent: {
          home: parseFloat(x.home) || 0,
          draw: parseFloat(x.draw) || 0,
          away: parseFloat(x.away) || 0
        },
        goals: p.predictions.goals,
        comparison: p.comparison || null,
        h2h: p.h2h || null,
        homeLast5: p.teams?.home?.last_5 || null,
        awayLast5: p.teams?.away?.last_5 || null,
        homeFixtures: p.teams?.home?.fixtures || null,
        awayFixtures: p.teams?.away?.fixtures || null,
        league: p.league || null
      };
    }
  };

  if (!window.ORACLE) window.ORACLE = ORACLE;
})();
