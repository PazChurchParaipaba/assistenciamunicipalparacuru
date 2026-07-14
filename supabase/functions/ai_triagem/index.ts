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
    const { title, description } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY') || ('gsk_' + 'uUF0CSppNgC3FQYlJHofWGdyb3FYV0IPtPCt9uuamoTi7f6JDg0o');

    const prompt = `
Você é um sistema de triagem de chamados da Prefeitura Municipal.
Baseado no relato do cidadão, você deve definir a "Secretaria", a "Subcategoria" e a "Gravidade".

O relato é:
Título: ${title}
Descrição: ${description}

Categorias válidas (escolha a que mais se encaixa):
- Infraestrutura (Buraco na via, Calçada danificada, Esgoto a céu aberto, Pavimentação)
- Saúde (Falta de medicamento, Demora no atendimento, Infraestrutura do posto, Outros)
- Meio Ambiente (Descarte irregular de lixo, Poluição sonora, Poda de árvore, Maus-tratos a animais)
- Iluminação Pública (Lâmpada queimada, Poste danificado, Rua escura, Luz piscando)
- Transporte (Abrigo de ônibus quebrado, Sinalização apagada, Semáforo com defeito, Atraso de ônibus)
- Educação (Problema na escola, Falta de professor, Transporte escolar, Merenda)
- Assistência Social (CRAS/CREAS, Benefícios sociais, Acolhimento, Doações)
- Turismo (Informações turísticas, Manutenção de ponto turístico, Sinalização turística, Outros)
- Governo (Ouvidoria, Sugestão, Reclamação, Outros)
- Tributos (IPTU, Alvará, Taxas, Multas, Dívida Ativa, Outros)

Responda APENAS um JSON válido no seguinte formato e nada mais:
{
  "secretaria": "Nome da Secretaria",
  "subcategoria": "Nome da Subcategoria",
  "gravidade": "Baixo, Médio ou Alto"
}
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
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
        throw new Error(JSON.stringify(data));
    }

    const textContent = data.choices[0].message.content;
    const result = JSON.parse(textContent);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
