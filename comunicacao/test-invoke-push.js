const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hkiqozqqcymbhfobydoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraXFvenFxY3ltYmhmb2J5ZG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODk0NzYsImV4cCI6MjA5NTQ2NTQ3Nn0.fx31IcsivW-YjYy6Of7c_gbKq90yvE40Tqrt-jCydso';

const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Testando invocação da Edge Function send-push...');
  try {
    const { data, error } = await sbClient.functions.invoke('send-push', {
      body: { 
        userId: '7b18cd4e-e293-4d90-863b-572262590e20',
        title: '⏰ Teste de Invocação',
        body: 'Esta é uma notificação disparada invocando a Edge Function!',
        url: '/'
      }
    });

    if (error) {
      console.error('Erro retornado pela função:', error);
    } else {
      console.log('Sucesso! Resposta:', data);
    }
  } catch (err) {
    console.error('Erro de rede:', err);
  }
}

test();
