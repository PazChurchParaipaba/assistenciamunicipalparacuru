const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSchema() {
  const { data, error } = await supabase
    .from('reports_paracuru')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log("Columns:", data.length > 0 ? Object.keys(data[0]) : "No rows to infer schema");
  }
}

testSchema();
