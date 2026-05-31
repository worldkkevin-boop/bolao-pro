import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Chaves VAPID geradas no projeto
const VAPID_PUBLIC_KEY = 'BKVRm4BIW81Kf0FH0q2IrdW2iwfp4Cc7LOfuz8wab89MpHMvbLYXxqubTS_pnBfdPSUdI0LgrXXQrwFnmndcU9w'
const VAPID_PRIVATE_KEY = 'DGiATYEqQ6705QmX03VmJWmtpIpyT_NOt2MYfzrGZbs'

webpush.setVapidDetails(
  'mailto:suporte@bolaopro.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Cliente administrativo com bypass de RLS para ler tokens de outros usuários
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parâmetros da requisição
    const { userId, groupId, title, body, url } = await req.json().catch(() => ({}))

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subscriptions: any[] = []

    if (groupId) {
      // 1. Busca todos os membros do grupo
      const { data: members, error: membersError } = await adminClient
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)

      if (membersError) throw membersError

      if (members && members.length > 0) {
        const userIds = members.map((m: any) => m.user_id)
        
        // 2. Busca todas as assinaturas ativas de push dos membros desse grupo
        const { data: subs, error: subsError } = await adminClient
          .from('push_subscriptions')
          .select('*')
          .in('user_id', userIds)

        if (subsError) throw subsError
        if (subs) subscriptions = subs
      }
    } else if (userId) {
      // Busca as assinaturas ativas de push do usuário específico
      const { data: subs, error: subsError } = await adminClient
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

      if (subsError) throw subsError
      if (subs) subscriptions = subs
    } else {
      return new Response(JSON.stringify({ error: 'Either userId or groupId must be provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions found. Push not sent.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/'
    })

    const results = []
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ userId: sub.user_id, status: 'success' })
      } catch (err) {
        console.error(`Error sending push to sub ID ${sub.id}:`, err.message)
        results.push({ userId: sub.user_id, status: 'failed', error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ message: 'Push sending complete', results }),
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
