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
      throw new Error('OPENROUTER_API_KEY não configurada. Crie uma chave gratuita em openrouter.ai');
    }

    if (!base64Image) {
       throw new Error('Imagem não fornecida')
    }

    const base64Data = base64Image.split(',')[1] || base64Image;

    const prompt = `
Você é um sistema de moderação de conteúdo da Prefeitura Municipal.
O cidadão enviou um relato com a seguinte descrição: "${description}"
Anexa a este relato, há uma imagem.

Sua tarefa:
1. Verifique se a imagem contém conteúdo explícito, violência, nudez ou qualquer coisa ilegal (NSFW). Se sim, recuse imediatamente.
2. Verifique se a imagem parece condizer com o problema relatado na descrição (ex: se relatou um buraco, a foto deve mostrar um buraco ou asfalto danificado).

Responda APENAS um JSON no seguinte formato:
{
  "valida": true ou false,
  "motivo": "Uma frase curta explicando o porquê da sua decisão, de forma amigável ao cidadão se for recusado."
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
    
    // Limpar markdown de bloco de código (ex: ```json ... ```) se o modelo retornar assim
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
