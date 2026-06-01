const SUPABASE_URL = 'https://hkiqozqqcymbhfobydoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraXFvenFxY3ltYmhmb2J5ZG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODk0NzYsImV4cCI6MjA5NTQ2NTQ3Nn0.fx31IcsivW-YjYy6Of7c_gbKq90yvE40Tqrt-jCydso';

const keyToUse = process.argv[2] || SUPABASE_ANON_KEY;

async function inspect() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: {
      'apikey': keyToUse,
      'Authorization': `Bearer ${keyToUse}`
    }
  });
  console.log(await res.json());
}
inspect();
