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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase Client with user's JWT to verify authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get user details
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get parameters
    const body = await req.json().catch(() => ({}))
    const paymentType = body.paymentType || (body.groupId ? 'grupo' : 'usuario')
    const targetId = body.targetId || body.groupId || user.id

    if (!targetId) {
      return new Response(JSON.stringify({ error: 'Target ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let transactionAmount = 9.90
    let description = `Upgrade de Bolão do Mago`
    let extRef = `grupo|${targetId}|20`

    if (paymentType === 'grupo') {
      transactionAmount = 9.90
      description = `Upgrade de Bolão do Mago - Grupo ${targetId}`
      extRef = `grupo|${targetId}|20`
      
      // Verify if user is the owner of the group
      const { data: group, error: groupError } = await userClient
        .from('groups')
        .select('id, owner_id')
        .eq('id', targetId)
        .single()

      if (groupError || !group || group.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Only the group owner can generate payments', details: groupError }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (paymentType === 'usuario') {
      transactionAmount = 4.90
      description = `Passe Livre do Mago - Usuário ${targetId}`
      extRef = `usuario|${targetId}|999`
      
      // Verify targetId matches calling user
      if (targetId !== user.id) {
        return new Response(JSON.stringify({ error: 'Cannot purchase Passe Livre for another user' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid paymentType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate Mercado Pago Pix Payment
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: 'Mercado Pago token configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const idempotencyKey = crypto.randomUUID()
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: transactionAmount,
        payment_method_id: 'pix',
        description: description,
        external_reference: extRef,
        payer: {
          email: user.email,
          first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Jogador',
          last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'do Mago'
        }
      })
    })

    const data = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Mercado Pago API error', details: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transactionData = data.point_of_interaction?.transaction_data
    return new Response(
      JSON.stringify({
        paymentId: data.id,
        qr_code: transactionData?.qr_code,
        qr_code_base64: transactionData?.qr_code_base64,
        ticket_url: data.transaction_details?.ticket_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
