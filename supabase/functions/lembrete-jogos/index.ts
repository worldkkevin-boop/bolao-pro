import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

// ======================================================================
// LEMBRETE DE JOGOS — "O jogo já vai começar, não esquece de palpitar!"
// ----------------------------------------------------------------------
// Roda via pg_cron a cada ~5 min. Para cada jogo que começa dentro dos
// próximos ANTECEDENCIA_MIN minutos, manda push SÓ pra quem ainda não
// palpitou. Marca o jogo como avisado (matches.lembrete_enviado_em) pra
// não repetir.
// ======================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Mesmas chaves VAPID usadas no send-push
const VAPID_PUBLIC_KEY = 'BKVRm4BIW81Kf0FH0q2IrdW2iwfp4Cc7LOfuz8wab89MpHMvbLYXxqubTS_pnBfdPSUdI0LgrXXQrwFnmndcU9w'
const VAPID_PRIVATE_KEY = 'DGiATYEqQ6705QmX03VmJWmtpIpyT_NOt2MYfzrGZbs'

webpush.setVapidDetails(
  'mailto:suporte@bolaopro.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

// Mesma chave da API-Football usada no frontend (js/api.js)
const API_FOOTBALL_KEY = '47ca2bb05eb5931347aca04964818eb5'
const SEASON = 2026
const ANTECEDENCIA_MIN = 20

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Proteção: só roda se o segredo bater (o cron envia esse header).
  // Se CRON_SECRET não estiver setado, deixa passar (facilita o primeiro teste).
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const recebido = req.headers.get('x-cron-secret')
    if (recebido !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(supabaseUrl, supabaseServiceKey)

    const agora = new Date()
    const limite = new Date(agora.getTime() + ANTECEDENCIA_MIN * 60000)
    const agoraISO = agora.toISOString()
    const limiteISO = limite.toISOString()

    // 1. Descobre as ligas ativas (a partir dos grupos existentes)
    const { data: grupos, error: erroGrupos } = await admin
      .from('groups')
      .select('id, league_id')
    if (erroGrupos) throw erroGrupos

    const ligas = [...new Set((grupos ?? []).map((g: any) => g.league_id || 1))]

    // 2. Pra cada liga, busca os jogos na API-Football e garante que os que
    //    estão na janela (próximos ANTECEDENCIA_MIN min, ainda não iniciados)
    //    existem na tabela matches. Sem isso, jogo que ninguém abriu não teria
    //    como ser lembrado.
    for (const ligaId of ligas) {
      try {
        const url = `https://v3.football.api-sports.io/fixtures?league=${ligaId}&season=${SEASON}`
        const resp = await fetch(url, {
          headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-rapidapi-key': API_FOOTBALL_KEY,
          },
        })
        const dados = await resp.json()
        const fixtures = Array.isArray(dados?.response) ? dados.response : []

        const naJanela = fixtures.filter((j: any) => {
          if (!j?.fixture?.date || j?.fixture?.status?.short !== 'NS') return false
          const k = new Date(j.fixture.date)
          return k > agora && k <= limite
        })

        for (const j of naJanela) {
          // Upsert NÃO inclui lembrete_enviado_em, então não sobrescreve o
          // marcador de "já avisado" de quem já está na tabela.
          await admin.from('matches').upsert([{
            id:           j.fixture.id,
            league_id:    j.league.id,
            season:       j.league.season,
            home_team:    j.teams.home.name,
            home_team_id: j.teams.home.id,
            home_logo:    j.teams.home.logo || '',
            away_team:    j.teams.away.name,
            away_team_id: j.teams.away.id,
            away_logo:    j.teams.away.logo || '',
            kickoff:      j.fixture.date,
            status:       j.fixture.status.short,
          }], { onConflict: 'id' })
        }
      } catch (e) {
        console.error(`[LEMBRETE] Falha ao buscar liga ${ligaId}:`, (e as Error).message)
        // segue pras outras ligas
      }
    }

    // 3. Fonte de verdade + dedup: jogos elegíveis direto da tabela matches.
    const { data: jogos, error: erroJogos } = await admin
      .from('matches')
      .select('id, league_id, home_team, away_team, kickoff, status, lembrete_enviado_em')
      .gt('kickoff', agoraISO)
      .lte('kickoff', limiteISO)
      .is('lembrete_enviado_em', null)
      .eq('status', 'NS')
    if (erroJogos) throw erroJogos

    const resumo: any[] = []

    for (const jogo of (jogos ?? [])) {
      // Grupos dessa liga
      const gruposDaLiga = (grupos ?? []).filter((g: any) => (g.league_id || 1) === jogo.league_id)
      const groupIds = gruposDaLiga.map((g: any) => g.id)

      if (groupIds.length === 0) {
        await marcarEnviado(admin, jogo.id)
        resumo.push({ matchId: jogo.id, enviados: 0, motivo: 'sem grupos na liga' })
        continue
      }

      // Membros desses grupos
      const { data: membros } = await admin
        .from('group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds)

      // Quem já palpitou nesse jogo (por grupo)
      const { data: palpites } = await admin
        .from('guesses')
        .select('user_id, group_id')
        .eq('match_id', jogo.id)
        .in('group_id', groupIds)

      const jaPalpitou = new Set((palpites ?? []).map((p: any) => `${p.group_id}:${p.user_id}`))

      // Usuários pendentes (em pelo menos um grupo) — distintos
      const pendentes = new Set<string>()
      for (const m of (membros ?? [])) {
        if (!jaPalpitou.has(`${m.group_id}:${m.user_id}`)) {
          pendentes.add(m.user_id)
        }
      }

      if (pendentes.size === 0) {
        await marcarEnviado(admin, jogo.id)
        resumo.push({ matchId: jogo.id, enviados: 0, motivo: 'todos já palpitaram' })
        continue
      }

      // Assinaturas de push dos pendentes
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', [...pendentes])

      const payload = JSON.stringify({
        title: '⏰ Faltam 20 min!',
        body: `Corre pra palpitar em ${jogo.home_team} x ${jogo.away_team} antes de travar!`,
        url: '/',
      })

      let enviados = 0
      for (const sub of (subs ?? [])) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { auth: sub.auth, p256dh: sub.p256dh },
          }, payload)
          enviados++
        } catch (err) {
          console.error(`[LEMBRETE] Falha no push (sub ${sub.id}):`, (err as Error).message)
        }
      }

      await marcarEnviado(admin, jogo.id)
      resumo.push({ matchId: jogo.id, jogo: `${jogo.home_team} x ${jogo.away_team}`, pendentes: pendentes.size, enviados })
    }

    return new Response(
      JSON.stringify({ message: 'Lembretes processados', janelaMin: ANTECEDENCIA_MIN, jogos: resumo }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function marcarEnviado(admin: any, matchId: number) {
  const { error } = await admin
    .from('matches')
    .update({ lembrete_enviado_em: new Date().toISOString() })
    .eq('id', matchId)
  if (error) console.error(`[LEMBRETE] Falha ao marcar enviado (match ${matchId}):`, error.message)
}
