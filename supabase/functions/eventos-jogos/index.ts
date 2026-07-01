import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

// ======================================================================
// EVENTOS DE JOGO AO VIVO — "começou / GOOOL / terminou"
// ----------------------------------------------------------------------
// Roda via pg_cron a cada 1 min. Busca os jogos AO VIVO (/fixtures?live=all),
// filtra pras ligas que têm grupo, e compara com o último estado salvo em
// `matches` (colunas notif_*) pra detectar:
//   • COMEÇOU  -> primeira vez que vemos o jogo ao vivo (status 1H, cedo)
//   • GOL      -> goals atual > último placar avisado (notif_score_*)
//   • TERMINOU -> jogo que estava em andamento sumiu do feed ao vivo e a
//                 API confirma status final (FT/AET/PEN)
//
// "MAIS AO VIVO": o pg_cron não vai abaixo de 1 min, então a função se
// auto-repete DENTRO do minuto — até MAX_PASSADAS de INTERVALO_MS em
// INTERVALO_MS enquanto houver jogo ao vivo (a API atualiza o ao vivo a
// cada ~15s, então 15s é o ponto ótimo — mais rápido não traz gol antes).
// Sem jogo ao vivo, sai na 1ª passada (não gasta requisição à toa).
//
// Push vai pra TODOS os membros dos grupos daquela liga. Gol na
// prorrogação/pênaltis é avisado, mas marcado "não conta no bolão"; o fim
// avisa o placar de 90' que valeu pro bolão (score.fulltime).
// ======================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Mesmas chaves VAPID usadas no send-push / lembrete-jogos
const VAPID_PUBLIC_KEY = 'BKVRm4BIW81Kf0FH0q2IrdW2iwfp4Cc7LOfuz8wab89MpHMvbLYXxqubTS_pnBfdPSUdI0LgrXXQrwFnmndcU9w'
const VAPID_PRIVATE_KEY = 'DGiATYEqQ6705QmX03VmJWmtpIpyT_NOt2MYfzrGZbs'

webpush.setVapidDetails('mailto:suporte@bolaopro.com.br', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const API_FOOTBALL_KEY = '47ca2bb05eb5931347aca04964818eb5'

// "Mais ao vivo": auto-repetição dentro do minuto do cron.
// 4 passadas a cada 15s = passadas em ~0/15/30/45s, encerra ~45s (deixa
// folga pro cron do próximo minuto não sobrepor). Latência de gol ~15s.
const INTERVALO_MS = 15000
const MAX_PASSADAS = 4

// Espelha config.js: status pós-90' (prorrogação/pênaltis). O `goals` da API
// infla com a prorrogação; o placar que vale pro bolão fica em score.fulltime.
const STATUS_POS_90 = ['ET', 'BT', 'P', 'AET', 'PEN']
const STATUS_FINAL = ['FT', 'AET', 'PEN']
// Encerramentos "sem jogo" — param o tracking sem mandar push.
const STATUS_CANCELADO = ['PST', 'CANC', 'ABD', 'AWD', 'WO']

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function apiHeaders() {
  return { 'x-rapidapi-host': 'v3.football.api-sports.io', 'x-rapidapi-key': API_FOOTBALL_KEY }
}

// Placar que vale pro bolão (90'). Em pós-90', usa score.fulltime; senão goals.
function placar90(j: any): { home: number | null, away: number | null } {
  const st = j?.fixture?.status?.short
  const ft = j?.score?.fulltime
  if (STATUS_POS_90.includes(st) && ft && ft.home != null && ft.away != null) {
    return { home: ft.home, away: ft.away }
  }
  return { home: j?.goals?.home ?? null, away: j?.goals?.away ?? null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Proteção por segredo (o cron manda o header). Sem CRON_SECRET, deixa passar.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Ligas ativas (a partir dos grupos) — buscado 1x, reusado nas passadas
    const { data: grupos, error: erroGrupos } = await admin.from('groups').select('id, league_id')
    if (erroGrupos) throw erroGrupos
    const activeLeagues = new Set((grupos ?? []).map((g: any) => g.league_id || 1))

    // Cache de assinaturas por liga (várias partidas / passadas reusam)
    const subsCache = new Map<number, any[]>()
    async function subsDaLiga(leagueId: number): Promise<any[]> {
      if (subsCache.has(leagueId)) return subsCache.get(leagueId)!
      const groupIds = (grupos ?? []).filter((g: any) => (g.league_id || 1) === leagueId).map((g: any) => g.id)
      let subs: any[] = []
      if (groupIds.length > 0) {
        const { data: membros } = await admin.from('group_members').select('user_id').in('group_id', groupIds)
        const userIds = [...new Set((membros ?? []).map((m: any) => m.user_id))]
        if (userIds.length > 0) {
          const { data: s } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
          subs = s ?? []
        }
      }
      subsCache.set(leagueId, subs)
      return subs
    }

    async function enviar(leagueId: number, title: string, body: string): Promise<number> {
      const subs = await subsDaLiga(leagueId)
      const payload = JSON.stringify({ title, body, url: '/' })
      let enviados = 0
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, payload)
          enviados++
        } catch (err) {
          console.error(`[EVENTOS] Falha no push (sub ${sub.id}):`, (err as Error).message)
        }
      }
      return enviados
    }

    // --------------------------------------------------------------------
    // Uma passada: detecta início/gol/fim uma vez. Retorna quantos jogos
    // estão ao vivo (pra decidir se vale repetir) + os eventos disparados.
    // --------------------------------------------------------------------
    async function passada(): Promise<{ aoVivo: number, eventos: any[] }> {
      const eventos: any[] = []

      // 2. Jogos AO VIVO (1 request cobre o mundo todo; filtramos pras nossas ligas)
      const respLive = await fetch('https://v3.football.api-sports.io/fixtures?live=all', { headers: apiHeaders() })
      const dadosLive = await respLive.json()
      const fixturesLive = (Array.isArray(dadosLive?.response) ? dadosLive.response : [])
        .filter((j: any) => activeLeagues.has(j?.league?.id))

      const liveIds = new Set<number>(fixturesLive.map((j: any) => j.fixture.id))

      // Estado salvo desses jogos ao vivo
      const liveIdList = [...liveIds]
      const estadoMap = new Map<number, any>()
      if (liveIdList.length > 0) {
        const { data: rows } = await admin
          .from('matches')
          .select('id, notif_inicio_em, notif_fim_em, notif_score_home, notif_score_away')
          .in('id', liveIdList)
        for (const r of (rows ?? [])) estadoMap.set(r.id, r)
      }

      for (const j of fixturesLive) {
        const fid = j.fixture.id
        const leagueId = j.league.id
        const st = j.fixture.status.short
        const elapsed = j.fixture.status.elapsed ?? 0
        const home = j.teams.home.name
        const away = j.teams.away.name
        const gh = j.goals?.home ?? 0
        const ga = j.goals?.away ?? 0
        const posTempo = STATUS_POS_90.includes(st)
        const estado = estadoMap.get(fid)

        // Garante a linha em `matches` + atualiza status/minuto (útil pro cache do app)
        await admin.from('matches').upsert([{
          id: fid, league_id: leagueId, season: j.league.season,
          home_team: home, home_team_id: j.teams.home.id, home_logo: j.teams.home.logo || '',
          away_team: away, away_team_id: j.teams.away.id, away_logo: j.teams.away.logo || '',
          kickoff: j.fixture.date, status: st, minute: elapsed, round: j.league.round || null,
        }], { onConflict: 'id' })

        // -------- Primeira vez que vemos este jogo ao vivo --------
        if (!estado || !estado.notif_inicio_em) {
          // "Começou" só se pegamos bem no início (evita spam em cold start / meio de jogo)
          const cedo = (st === '1H' && elapsed <= 15)
          if (cedo) {
            const n = await enviar(leagueId, '🟢 Bola rolando!', `Começou: ${home} x ${away}. Boa sorte! 🍀`)
            eventos.push({ matchId: fid, evento: 'inicio', enviados: n })
          }
          // Baseline de placar = placar atual (não notifica gols anteriores ao tracking)
          await admin.from('matches').update({
            notif_inicio_em: new Date().toISOString(),
            notif_score_home: gh, notif_score_away: ga,
          }).eq('id', fid)
          continue
        }

        // -------- Gol? (placar aumentou vs o último avisado) --------
        const prevH = estado.notif_score_home ?? 0
        const prevA = estado.notif_score_away ?? 0
        if (gh > prevH || ga > prevA) {
          const marcou = gh > prevH ? home : away
          let body = `${marcou} marcou!  ${home} ${gh} x ${ga} ${away}`
          if (posTempo) body += ` ⏱️ prorrogação — não conta no bolão`
          const n = await enviar(leagueId, '⚽ GOOOOL!', body)
          await admin.from('matches').update({ notif_score_home: gh, notif_score_away: ga }).eq('id', fid)
          eventos.push({ matchId: fid, evento: 'gol', placar: `${gh}x${ga}`, prorrogacao: posTempo, enviados: n })
        }
      }

      // 3. TERMINOU: jogos que estávamos trackeando e sumiram do feed ao vivo.
      const { data: emAndamento } = await admin
        .from('matches')
        .select('id, league_id, home_team, away_team')
        .not('notif_inicio_em', 'is', null)
        .is('notif_fim_em', null)
      const candidatosFim = (emAndamento ?? [])
        .filter((m: any) => activeLeagues.has(m.league_id) && !liveIds.has(m.id))

      // Confirma o status final buscando esses fixtures direto (em blocos de 20).
      for (let i = 0; i < candidatosFim.length; i += 20) {
        const bloco = candidatosFim.slice(i, i + 20)
        const idsParam = bloco.map((m: any) => m.id).join('-')
        let porId = new Map<number, any>()
        try {
          const resp = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${idsParam}`, { headers: apiHeaders() })
          const dados = await resp.json()
          for (const j of (Array.isArray(dados?.response) ? dados.response : [])) porId.set(j.fixture.id, j)
        } catch (e) {
          console.error('[EVENTOS] Falha ao confirmar jogos encerrados:', (e as Error).message)
          continue
        }

        for (const m of bloco) {
          const j = porId.get(m.id)
          const st = j?.fixture?.status?.short
          if (!st) continue

          if (STATUS_FINAL.includes(st)) {
            const p = placar90(j)                       // placar que valeu (90')
            const foiPos = STATUS_POS_90.includes(st)   // passou dos 90'?
            let body = `${m.home_team} ${p.home} x ${p.away} ${m.away_team}`
            if (foiPos) body += st === 'PEN' ? ` (valeu o 90' — decidido nos pênaltis)` : ` (valeu o 90')`
            const n = await enviar(m.league_id, '🏁 Fim de jogo', body)
            await admin.from('matches').update({
              notif_fim_em: new Date().toISOString(),
              status: st, score_home: p.home, score_away: p.away,
            }).eq('id', m.id)
            eventos.push({ matchId: m.id, evento: 'fim', placar: `${p.home}x${p.away}`, enviados: n })
          } else if (STATUS_CANCELADO.includes(st)) {
            // Adiado/cancelado: para o tracking, sem push.
            await admin.from('matches').update({ notif_fim_em: new Date().toISOString(), status: st }).eq('id', m.id)
            eventos.push({ matchId: m.id, evento: 'cancelado', status: st })
          }
          // Se ainda não é final nem cancelado (glitch do feed), ignora — pega na próxima passada.
        }
      }

      return { aoVivo: fixturesLive.length, eventos }
    }

    // --------------------------------------------------------------------
    // Loop de passadas: repete de INTERVALO_MS em INTERVALO_MS enquanto
    // houver jogo ao vivo (até MAX_PASSADAS). Idle -> sai na 1ª.
    // --------------------------------------------------------------------
    const eventosTotais: any[] = []
    let aoVivo = 0
    for (let p = 0; p < MAX_PASSADAS; p++) {
      const r = await passada()
      aoVivo = r.aoVivo
      eventosTotais.push(...r.eventos)
      if (aoVivo === 0) break                       // ninguém ao vivo -> não repete
      if (p < MAX_PASSADAS - 1) await sleep(INTERVALO_MS)
    }

    return new Response(
      JSON.stringify({ message: 'Eventos processados', aoVivo, passadas: Math.min(MAX_PASSADAS, aoVivo === 0 ? 1 : MAX_PASSADAS), eventos: eventosTotais }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
