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
    const { base64Image, description } = await req.json()
    const apiKey = Deno.env.get('OPENROUTER_API_KEY') || ('sk-or-v1-' + 'dad39bd1912e4f76d92bd3c8a505a1d8fd800b6794ae89a5c0fbadeaf4001b1c');

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada.');
    }

    if (!base64Image) {
       throw new Error('Imagem não fornecida')
    }

    const base64Data = base64Image.split(',')[1] || base64Image;

    const prompt = `
Você é um sistema de auditoria de obras e serviços públicos.
O problema original relatado pelo cidadão foi: "${description}"

A foto enviada pelo técnico agora é a prova da intervenção (resolução ou equipe trabalhando).
Sua tarefa: Analisar a imagem do técnico detalhadamente. Você DEVE procurar por:
1. Sinais de que o serviço foi executado ou concluído (ex: buraco tapado, área limpa, conserto realizado).
2. OU presença de pessoas/técnicos trabalhando no local para resolver o problema.

Se você detectar que o problema foi resolvido OU detectar pessoas trabalhando no local, considere válido. Não seja excessivamente rigoroso, se houver pessoas na imagem no contexto de trabalho, valide.

Responda APENAS um JSON no seguinte formato. Escreva o campo "motivo" em português (pt-BR):
{
  "valida": true ou false,
  "motivo": "Seu texto explicando a recusa ou validação, escrito em português"
}
`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
          }
        ],
        temperature: 0.1
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
        throw new Error(JSON.stringify(data));
    }

    let textContent = data.choices[0].message.content;
    textContent = textContent.replace(/```json/g, '').replace(/```/g, '').trim();

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
