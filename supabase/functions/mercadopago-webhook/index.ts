import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log("Recebendo Webhook. URL:", req.url)

    let body: any = {}
    try {
      body = await req.json()
    } catch (e) {
      console.log("Corpo vazio ou não-JSON:", e.message)
    }

    const paymentId = url.searchParams.get('data.id') || url.searchParams.get('id') || body.data?.id || body.id
    const type      = url.searchParams.get('type') || body.type

    if (type && type !== 'payment') {
      return new Response(JSON.stringify({ message: 'Ignored non-payment notification' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'No payment ID found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: 'Mercado Pago token não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Simulador de teste: bypass para ID "123456"
    if (paymentId === "123456") {
      return new Response(JSON.stringify({ success: true, message: "Test mock bypassed" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` },
    })

    if (!mpResponse.ok) {
      const errText = await mpResponse.text().catch(() => '')
      console.error(`Erro MP (${mpResponse.status}):`, errText)
      return new Response(JSON.stringify({ error: 'Failed to verify payment', details: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payment = await mpResponse.json()
    console.log(`Status do pagamento ${paymentId}: ${payment.status}`)

    if (payment.status !== 'approved') {
      return new Response(JSON.stringify({ success: false, message: `Status: ${payment.status}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Aprovado — processar
    const extRef = payment.external_reference as string
    if (!extRef) {
      return new Response(JSON.stringify({ error: 'external_reference ausente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parts      = extRef.split('|')
    let paymentType  = 'grupo'
    let targetId     = ''
    let limit        = 20

    if (parts.length === 3) {
      paymentType = parts[0]
      targetId    = parts[1]
      limit       = parseInt(parts[2], 10)
    } else {
      // Legado: "groupId|20"
      paymentType = 'grupo'
      targetId    = parts[0]
      limit       = parseInt(parts[1] || '20', 10)
    }

    console.log(`Processando: tipo=${paymentType}, targetId=${targetId}, limit=${limit}`)

    const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Service key não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // ── PLANO DE GRUPO ────────────────────────────────────────────────────────
    if (paymentType === 'grupo') {
      const { error } = await adminClient
        .from('groups')
        .update({ max_participants: limit, desafios_ativados: limit >= 70 })
        .eq('id', targetId)
      if (error) {
        console.error("Erro ao atualizar grupo:", error)
        return new Response(JSON.stringify({ error: 'Falha ao atualizar grupo', details: error }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log(`✅ Grupo ${targetId} atualizado: max_participants=${limit}`)

    // ── PASSE DE JOGADOR ─────────────────────────────────────────────────────
    } else if (paymentType === 'passe' || paymentType === 'usuario') {
      const { error } = await adminClient
        .from('profiles')
        .upsert({ id: targetId, max_grupos: limit })
      if (error) {
        console.error("Erro ao atualizar passe do usuário:", error)
        return new Response(JSON.stringify({ error: 'Falha ao atualizar passe', details: error }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log(`✅ Passe do usuário ${targetId} atualizado: max_grupos=${limit}`)

    // ── FICHAS ────────────────────────────────────────────────────────────────
    } else if (paymentType === 'fichas') {
      const { data: prof, error: fetchErr } = await adminClient
        .from('profiles')
        .select('fichas_desafio')
        .eq('id', targetId)
        .maybeSingle()
      if (fetchErr) {
        console.error("Erro ao buscar fichas do usuário:", fetchErr)
        return new Response(JSON.stringify({ error: 'Falha ao buscar saldo de fichas', details: fetchErr }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const novoSaldo = (prof?.fichas_desafio || 0) + limit
      const { error: updateErr } = await adminClient
        .from('profiles')
        .upsert({ id: targetId, fichas_desafio: novoSaldo })
      if (updateErr) {
        console.error("Erro ao creditar fichas:", updateErr)
        return new Response(JSON.stringify({ error: 'Falha ao creditar fichas', details: updateErr }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log(`✅ Fichas do usuário ${targetId} atualizadas: ${prof?.fichas_desafio || 0} → ${novoSaldo}`)

    // ── APOIADOR (DOAÇÃO VERIFICADA → SELO 💛) ───────────────────────────────
    } else if (paymentType === 'apoiador') {
      const { error } = await adminClient
        .from('profiles')
        .upsert({ id: targetId, apoiador: true, apoiador_desde: new Date().toISOString() })
      if (error) {
        console.error("Erro ao marcar apoiador:", error)
        return new Response(JSON.stringify({ error: 'Falha ao marcar apoiador', details: error }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log(`✅ Usuário ${targetId} marcado como apoiador 💛`)

    // ── POTE DE DISPUTA (BOLÃO) ──────────────────────────────────────────────
    } else if (paymentType === 'pote') {
      const { error } = await adminClient
        .from('potes_participantes')
        .update({ status_pagamento: 'pago' })
        .eq('id', targetId)
      if (error) {
        console.error("Erro ao atualizar participante do pote:", error)
        return new Response(JSON.stringify({ error: 'Falha ao atualizar participante do pote', details: error }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log(`✅ Participante do pote ${targetId} atualizado para 'pago'`)

    } else {
      console.warn(`paymentType desconhecido: ${paymentType}`)
    }

    return new Response(JSON.stringify({ success: true, message: `Upgrade concluído: ${paymentType} ${targetId}` }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Exceção no webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
