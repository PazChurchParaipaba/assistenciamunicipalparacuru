const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase
    .from('reports_paracuru')
    .insert([
      {
        tipo: 'Duvida',
        title: 'Teste erro',
        secretaria: 'Governo',
        description: 'Teste',
        status: 'Aberto',
        user_id: '00000000-0000-0000-0000-000000000000'
      }
    ]);

  if (error) {
    console.error('ERRO DETALHADO:', error);
  } else {
    console.log('Sucesso:', data);
  }
}

testInsert();
