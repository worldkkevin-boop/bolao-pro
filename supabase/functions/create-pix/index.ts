import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Catálogo de produtos — fonte da verdade para valores e limites
const CATALOG: Record<string, { amount: number; desc: string; type: string; limit: number }> = {
  // Planos de grupo
  grupo_serie_a:   { amount: 29.90, desc: 'Bolão Pro — Plano Série A (30 jogadores)',     type: 'grupo',  limit: 30  },
  grupo_champions: { amount: 49.90, desc: 'Bolão Pro — Plano Champions (70 jogadores)',   type: 'grupo',  limit: 70  },
  grupo_god_mode:  { amount: 99.90, desc: 'Bolão Pro — Plano God Mode (ilimitado)',        type: 'grupo',  limit: 999 },
  // Passes de jogador
  passe_camisa10:  { amount:  9.90, desc: 'Bolão Pro — Passe Camisa 10 (3 grupos)',       type: 'passe',  limit: 3   },
  passe_lenda:     { amount: 19.90, desc: 'Bolão Pro — Passe Lenda da Copa (ilimitado)',  type: 'passe',  limit: 999 },
  // Fichas
  fichas_resenha:  { amount:  1.99, desc: 'Bolão Pro — 15 Fichas',                        type: 'fichas', limit: 15  },
  fichas_sniper:   { amount:  4.90, desc: 'Bolão Pro — 40 Fichas',                        type: 'fichas', limit: 40  },
  fichas_bau:      { amount:  9.90, desc: 'Bolão Pro — 100 Fichas',                       type: 'fichas', limit: 100 },
  // Apoiador (doação verificada → selo 💛 por X dias). limit = dias de apoio.
  apoio_5:         { amount:  5.00, desc: 'Bolão Pro — Apoiador 💛 (7 dias)',             type: 'apoiador', limit: 7  },
  apoio_10:        { amount: 10.00, desc: 'Bolão Pro — Apoiador 💛 (15 dias)',            type: 'apoiador', limit: 15 },
  apoio_20:        { amount: 20.00, desc: 'Bolão Pro — Apoiador 💛 (30 dias)',            type: 'apoiador', limit: 30 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))

    // ── Nova rota: Entradas de Pote (Mercado Pago Automático) ──────────────────
    if (body.paymentType === 'pote') {
      const poteParticipanteId = body.targetId
      const amount = body.amount
      const description = body.description || 'Entrada de Pote — Bolão Pro'
      
      if (!poteParticipanteId || !amount) {
        return new Response(JSON.stringify({ error: 'targetId e amount são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Validação: Garante que o participante pertence a este usuário
      const { data: part, error: partError } = await userClient
        .from('potes_participantes')
        .select('id, user_id')
        .eq('id', poteParticipanteId)
        .single()

      if (partError || !part || part.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Inscrição no pote inválida ou de outro usuário' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return await gerarPix(user, amount, description, `pote|${poteParticipanteId}|0`)
    }

    // ── Nova rota: productId + targetId ──────────────────────────────────────
    if (body.productId) {
      const produto = CATALOG[body.productId]
      if (!produto) {
        return new Response(JSON.stringify({ error: `Produto inválido: ${body.productId}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const targetId = body.targetId || (produto.type === 'grupo' ? null : user.id)
      if (!targetId) {
        return new Response(JSON.stringify({ error: 'targetId é obrigatório para planos de grupo' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Validação de ownership para planos de grupo
      if (produto.type === 'grupo') {
        const { data: group, error: groupError } = await userClient
          .from('groups').select('id, owner_id').eq('id', targetId).single()
        if (groupError || !group || group.owner_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Apenas o dono do grupo pode fazer upgrade' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else if (targetId !== user.id) {
        return new Response(JSON.stringify({ error: 'targetId deve ser o próprio usuário' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return await gerarPix(user, produto.amount, produto.desc, `${produto.type}|${targetId}|${produto.limit}`)
    }

    // ── Rota legada: backward compat com { groupId } ─────────────────────────
    const paymentType = body.paymentType || (body.groupId ? 'grupo' : 'usuario')
    const targetId    = body.targetId || body.groupId || user.id

    let transactionAmount = 9.90
    let description       = 'Upgrade de Bolão do Mago'
    let extRef            = `grupo|${targetId}|20`

    if (paymentType === 'grupo') {
      const { data: group, error: groupError } = await userClient
        .from('groups').select('id, owner_id').eq('id', targetId).single()
      if (groupError || !group || group.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Only the group owner can generate payments' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      transactionAmount = 9.90
      description       = `Upgrade de Bolão do Mago - Grupo ${targetId}`
      extRef            = `grupo|${targetId}|20`
    } else {
      if (targetId !== user.id) {
        return new Response(JSON.stringify({ error: 'Cannot purchase for another user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      transactionAmount = 4.90
      description       = `Passe Livre do Mago - Usuário ${targetId}`
      extRef            = `usuario|${targetId}|999`
    }

    return await gerarPix(user, transactionAmount, description, extRef)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Helper compartilhado: chama MP e retorna QR Code ────────────────────────
async function gerarPix(user: any, amount: number, description: string, extRef: string) {
  const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!mpAccessToken) {
    return new Response(JSON.stringify({ error: 'Mercado Pago token não configurado' }), {
      status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    })
  }

  const idempotencyKey = crypto.randomUUID()
  const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mpAccessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      payment_method_id: 'pix',
      description,
      external_reference: extRef,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      payer: {
        email: user.email,
        first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Jogador',
        last_name:  user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'do Mago',
      },
    }),
  })

  const data = await mpResponse.json()
  if (!mpResponse.ok) {
    return new Response(JSON.stringify({ error: 'Mercado Pago API error', details: data }), {
      status: 502, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    })
  }

  const txData = data.point_of_interaction?.transaction_data
  return new Response(
    JSON.stringify({
      paymentId:      data.id,
      qr_code:        txData?.qr_code,
      qr_code_base64: txData?.qr_code_base64,
      ticket_url:     data.transaction_details?.ticket_url,
    }),
    { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
  )
}
