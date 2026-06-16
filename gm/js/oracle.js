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
      const pH = parseFloat(x.home) || 0;
      const pD = parseFloat(x.draw) || 0;
      const pA = parseFloat(x.away) || 0;
      // Quando a API não tem modelo real, retorna 33/33/33 sem advice
      const predReal = !!(p.predictions.advice && Math.abs(pH - pD) > 2);
      return {
        teams: p.teams,
        winner: p.predictions.winner,
        advice: p.predictions.advice,
        predReal,
        under_over: p.predictions.under_over || null,
        win_or_draw: !!p.predictions.win_or_draw,
        percent: { home: pH, draw: pD, away: pA },
        goals: p.predictions.goals,
        comparison: predReal ? (p.comparison || null) : null,
        h2h: p.h2h || null,
        homeLast5: p.teams?.home?.last_5 || null,
        awayLast5: p.teams?.away?.last_5 || null,
        homeFixtures: p.teams?.home?.fixtures || null,
        awayFixtures: p.teams?.away?.fixtures || null,
        league: p.league || null
      };
    },

    // Busca odds (Exact Score + Goals Over/Under) e retorna { placares, gols }
    async oddsFull(fixtureId) {
      const headers = { 'x-rapidapi-host': HOST, 'x-rapidapi-key': API_KEY };
      const r = await fetch(`https://${HOST}/odds?fixture=${fixtureId}`, { headers });
      if (!r.ok) return { placares: null, gols: null };
      const j = await r.json().catch(() => ({}));
      const bks = j?.response?.[0]?.bookmakers || [];

      // Exact Score
      const acc = {};
      bks.forEach(bk => {
        const bet = (bk.bets || []).find(b => b.name === 'Exact Score');
        if (!bet) return;
        (bet.values || []).forEach(v => {
          const m = String(v.value).match(/^(\d+):(\d+)$/);
          if (!m) return;
          const odd = parseFloat(v.odd);
          if (!odd || odd <= 1) return;
          const key = `${m[1]}-${m[2]}`;
          if (!acc[key]) acc[key] = { soma: 0, n: 0, home: +m[1], away: +m[2] };
          acc[key].soma += odd; acc[key].n += 1;
        });
      });
      let placares = Object.keys(acc).map(k => {
        const a = acc[k];
        const oddMedia = a.soma / a.n;
        return { placar: k, home: a.home, away: a.away, oddMedia, prob: 1 / oddMedia,
          winner: a.home > a.away ? 'home' : (a.home < a.away ? 'away' : 'empate') };
      });
      if (placares.length === 0) {
        placares = null;
      } else {
        const s = placares.reduce((t, x) => t + x.prob, 0) || 1;
        placares.forEach(x => { x.probNorm = x.prob / s; });
        placares.sort((a, b) => b.prob - a.prob);
      }

      // Goals Over/Under
      const linhas = {};
      bks.forEach(bk => {
        const bet = (bk.bets || []).find(b => b.name === 'Goals Over/Under');
        if (!bet) return;
        (bet.values || []).forEach(v => {
          const m = String(v.value).match(/^(Over|Under)\s+([\d.]+)$/i);
          if (!m) return;
          const odd = parseFloat(v.odd);
          if (!odd || odd <= 1) return;
          const linha = m[2];
          if (!linhas[linha]) linhas[linha] = { over: [], under: [] };
          linhas[linha][m[1].toLowerCase()].push(odd);
        });
      });
      const pOver = {};
      Object.keys(linhas).forEach(l => {
        const o = linhas[l].over, u = linhas[l].under;
        if (!o.length || !u.length) return;
        const avgO = o.reduce((a, b) => a + b, 0) / o.length;
        const avgU = u.reduce((a, b) => a + b, 0) / u.length;
        const iO = 1 / avgO, iU = 1 / avgU;
        pOver[parseFloat(l)] = iO / (iO + iU);
      });
      let gols = null;
      if (Object.keys(pOver).length > 0) {
        const distK = {};
        if (pOver[0.5] != null) distK[0] = Math.max(0, 1 - pOver[0.5]);
        for (let k = 1; k <= 6; k++) {
          const lo = k - 0.5, hi = k + 0.5;
          if (pOver[lo] != null) {
            const pHi = pOver[hi] != null ? pOver[hi] : 0;
            distK[k] = Math.max(0, pOver[lo] - pHi);
          }
        }
        let esperado = 0, soma = 0, maisProv = null, maxP = -1;
        Object.keys(distK).forEach(k => {
          esperado += Number(k) * distK[k]; soma += distK[k];
          if (distK[k] > maxP) { maxP = distK[k]; maisProv = Number(k); }
        });
        if (soma > 0) gols = { esperado: esperado / soma, maisProvavel: maisProv };
      }
      return { placares, gols };
    }
  };

  if (!window.ORACLE) window.ORACLE = ORACLE;
})();
