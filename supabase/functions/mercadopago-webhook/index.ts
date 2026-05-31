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
    const body = await req.json().catch(() => ({}))
    
    // Mercado Pago webhook can send payment id in query param or body
    const paymentId = url.searchParams.get('data.id') || url.searchParams.get('id') || body.data?.id || body.id
    const type = url.searchParams.get('type') || body.type

    // If it's not a payment type, we can return 200 to acknowledge
    if (type && type !== 'payment') {
      return new Response(JSON.stringify({ message: 'Ignored non-payment notification' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'No payment ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get Mercado Pago Access Token
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: 'Mercado Pago token configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify payment status directly on Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    })

    if (!mpResponse.ok) {
      const errData = await mpResponse.json()
      return new Response(JSON.stringify({ error: 'Failed to verify payment with Mercado Pago', details: errData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payment = await mpResponse.json()
    
    if (payment.status === 'approved') {
      const extRef = payment.external_reference // e.g. "groupId|20"
      if (!extRef) {
        return new Response(JSON.stringify({ error: 'external_reference missing from payment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const parts = extRef.split('|')
      const groupId = parts[0]
      const newLimit = parseInt(parts[1] || '20', 10)

      // Initialize Supabase Client with service role key to bypass RLS
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)

      const { error: updateError } = await adminClient
        .from('groups')
        .update({ max_participants: newLimit })
        .eq('id', groupId)

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update group max_participants', details: updateError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, message: `Group ${groupId} upgraded to limit ${newLimit}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: false, message: `Payment status: ${payment.status}` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
