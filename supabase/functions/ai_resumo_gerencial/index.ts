// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reports } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY');

    if (!reports || reports.length === 0) {
       throw new Error('Nenhum relato fornecido para resumo')
    }

    // Simplificando o payload para a IA (não enviar base64 ou dados pesados, apenas os metadados essenciais)
    const simplifiedReports = reports.map((r: any) => ({
        tipo: r.tipo,
        status: r.status,
        secretaria: r.secretaria,
        subcategoria: r.subcategory,
        bairro: r.bairro,
        titulo: r.title,
        descricao: r.description
    }));

    const prompt = `
Você é um analista de dados estratégico da Prefeitura Municipal.
Abaixo estão os dados brutos dos chamados/relatos abertos recentemente pelos cidadãos:

${JSON.stringify(simplifiedReports)}

Faça um resumo executivo de 2 parágrafos focado na alta gestão (Prefeito e Secretários).
Destaque:
1. Picos incomuns de problemas (ex: muitas reclamações de buraco no bairro X).
2. O sentimento geral ou problemas reincidentes.
3. Sugestão de onde focar os esforços imediatos da prefeitura.

Use um tom profissional, direto e claro.
Retorne APENAS o texto do resumo, sem marcações markdown extra de blocos de código.
`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: JSON.stringify(data) }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           status: 200,
        });
    }

    const textContent = data.choices[0].message.content;

    return new Response(JSON.stringify({ resumo: textContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Erro Desconhecido', stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
