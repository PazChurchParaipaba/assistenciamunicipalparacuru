const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('nome_completo', 'erick')
    .maybeSingle();
    
  console.log("ilike test:", { data, error });

  const { data: data2, error: error2 } = await supabase
    .from('profiles')
    .select('*')
    .eq('nome_completo', 'erick')
    .maybeSingle();
    
  console.log("eq test:", { data2, error2 });
}

testLogin();
