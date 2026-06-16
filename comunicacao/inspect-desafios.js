const supabaseUrl = 'https://hkiqozqqcymbhfobydoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraXFvenFxY3ltYmhmb2J5ZG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODk0NzYsImV4cCI6MjA5NTQ2NTQ3Nn0.fx31IcsivW-YjYy6Of7c_gbKq90yvE40Tqrt-jCydso';

async function inspect() {
  const resp = await fetch(`${supabaseUrl}/rest/v1/desafios?select=*`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await resp.json();
  console.log('Desafios count:', data.length);
  console.log('Desafios:', JSON.stringify(data, null, 2));
}

inspect();
