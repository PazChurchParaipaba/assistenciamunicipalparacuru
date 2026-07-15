import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;
  
  if (localStorage.getItem('theme') === 'dark') {
    htmlEl.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️ Modo Claro';
  }

  themeToggle.addEventListener('click', () => {
    const isDark = htmlEl.getAttribute('data-theme') === 'dark';
    htmlEl.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🌙 Modo Escuro' : '☀️ Modo Claro';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  // UX - Auto-Suggest e Subcategorias
  const subcategoriesMap = {
    'Infraestrutura': ['Buraco na via', 'Calçada danificada', 'Esgoto a céu aberto', 'Pavimentação'],
    'Saúde': ['Falta de medicamento', 'Demora no atendimento', 'Infraestrutura do posto', 'Outros'],
    'Meio Ambiente': ['Descarte irregular de lixo', 'Poluição sonora', 'Poda de árvore', 'Maus-tratos a animais'],
    'Iluminação Pública': ['Lâmpada queimada', 'Poste danificado', 'Rua escura', 'Luz piscando'],
    'Transporte': ['Abrigo de ônibus quebrado', 'Sinalização apagada', 'Semáforo com defeito', 'Atraso de ônibus'],
    'Educação': ['Problema na escola', 'Falta de professor', 'Transporte escolar', 'Merenda'],
    'Assistência Social': ['CRAS/CREAS', 'Benefícios sociais', 'Acolhimento', 'Doações'],
    'Turismo': ['Informações turísticas', 'Manutenção de ponto turístico', 'Sinalização turística', 'Outros'],
    'Governo': ['Ouvidoria', 'Sugestão', 'Reclamação', 'Outros'],
    'Tributos': ['IPTU', 'Alvará', 'Taxas', 'Multas', 'Dívida Ativa', 'Outros']
  };

  const titleInput = document.getElementById('title');
  const secInput = document.getElementById('secretaria');
  const subInput = document.getElementById('subcategory');
  const subGroup = document.getElementById('subcategoryGroup');

  titleInput.addEventListener('input', (e) => {
    const text = e.target.value.toLowerCase();
    let changed = false;
    if (/\b(luz|lâmpada|lampada|poste|escuro|apagado)\b/i.test(text)) {
      secInput.value = 'Iluminação Pública'; changed = true;
    } else if (/\b(buraco|asfalto|rua|calçada|pavimento)\b/i.test(text)) {
      secInput.value = 'Infraestrutura'; changed = true;
    } else if (/\b(lixo|árvore|arvore|animal|animais|mato|entulho)\b/i.test(text)) {
      secInput.value = 'Meio Ambiente'; changed = true;
    } else if (/\b(médico|medico|remédio|remedio|posto|saúde|saude|exame|hospital)\b/i.test(text)) {
      secInput.value = 'Saúde'; changed = true;
    } else if (/\b(ônibus|onibus|transporte|escola|professor|matrícula|matricula|creche)\b/i.test(text)) {
      secInput.value = 'Educação'; changed = true;
    } else if (/\b(imposto|iptu|taxa|tributo|multa|alvará|alvara|dívida|divida)\b/i.test(text)) {
      secInput.value = 'Tributos'; changed = true;
    }
    if (changed) secInput.dispatchEvent(new Event('change'));
  });

  secInput.addEventListener('change', (e) => {
    const sec = e.target.value;
    const subs = subcategoriesMap[sec];
    
    subInput.innerHTML = '<option value="" disabled selected>Selecione...</option>';
    
    if (subs && subs.length > 0) {
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subInput.appendChild(opt);
      });
      subGroup.style.display = 'block';
    } else {
      subGroup.style.display = 'none';
    }
  });

  // --- NEW MENU LOGIC ---
  const actionMenu = document.getElementById('actionMenu');
  const wizardForm = document.getElementById('wizardForm');
  const stepperIndicator = document.getElementById('stepperIndicator');
  const quickForm = document.getElementById('quickForm');

  const btnActionProblema = document.getElementById('btnActionProblema');
  const btnActionDuvida = document.getElementById('btnActionDuvida');
  const btnActionFeedback = document.getElementById('btnActionFeedback');
  const btnActionOuvidoria = document.getElementById('btnActionOuvidoria');
  const btnActionAgenda = document.getElementById('btnActionAgenda');

  const quickFormTitle = document.getElementById('quickFormTitle');
  const quickFormType = document.getElementById('quickFormType');
  const quickTitle = document.getElementById('quickTitle');
  const quickSecBadge = document.getElementById('quickSecBadge');
  const quickSecretaria = document.getElementById('quickSecretaria');
  const quickSecGroup = document.getElementById('quickSecGroup');

  if (btnActionProblema) {
    btnActionProblema.addEventListener('click', () => {
      actionMenu.style.display = 'none';
      wizardForm.style.display = 'block';
      stepperIndicator.style.display = 'flex';
      setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    });
  }

  function showQuickForm(tipo, titulo) {
    actionMenu.style.display = 'none';
    quickForm.style.display = 'block';
    quickFormTitle.textContent = titulo;
    quickFormType.value = tipo;
    quickTitle.value = '';
    quickSecretaria.value = 'Governo'; // default fallback
    quickSecBadge.textContent = 'Governo';
    
    if (tipo === 'Duvida') {
      quickSecGroup.style.display = 'block';
      quickTitle.placeholder = 'Qual a sua dúvida? Ex: Como faço para renovar minha CNH?';
    } else if (tipo === 'Feedback') {
      quickSecGroup.style.display = 'none';
      quickTitle.placeholder = 'Deixe sua sugestão ou crítica...';
    } else {
      quickSecGroup.style.display = 'none';
      quickTitle.placeholder = 'Escreva para a ouvidoria...';
    }
  }

  if (btnActionDuvida) btnActionDuvida.addEventListener('click', () => showQuickForm('Duvida', '❓ Enviar Dúvida'));
  if (btnActionFeedback) btnActionFeedback.addEventListener('click', () => showQuickForm('Feedback', '💬 Enviar Feedback'));
  if (btnActionOuvidoria) btnActionOuvidoria.addEventListener('click', () => showQuickForm('Ouvidoria', '🏛️ Ouvidoria Geral'));

  // --- Agenda Logic ---
  const modalAgendaCidadao = document.getElementById('modalAgendaCidadao');
  const closeModalAgendaCidadao = document.getElementById('closeModalAgendaCidadao');
  const listaAgendasDisponiveis = document.getElementById('listaAgendasDisponiveis');

  if (btnActionAgenda) {
    btnActionAgenda.addEventListener('click', () => {
      if (modalAgendaCidadao) {
        modalAgendaCidadao.style.display = 'flex';
        loadAgendasDisponiveis();
      }
    });
  }

  if (closeModalAgendaCidadao) {
    closeModalAgendaCidadao.addEventListener('click', () => {
      modalAgendaCidadao.style.display = 'none';
    });
  }

  async function loadAgendasDisponiveis() {
    if (!listaAgendasDisponiveis) return;
    listaAgendasDisponiveis.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Carregando datas disponíveis...</p>';

    // Hoje formatado como YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('agendas_secretario')
      .select('*')
      .gte('data', today)
      .order('data', { ascending: true });

    if (error) {
      listaAgendasDisponiveis.innerHTML = '<p style="color: var(--danger); text-align: center;">Erro ao carregar datas.</p>';
      return;
    }

    if (data.length === 0) {
      listaAgendasDisponiveis.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Não há datas configuradas no momento.</p>';
      return;
    }

    listaAgendasDisponiveis.innerHTML = '<div id="calendarioGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;"></div>';
    const grid = document.getElementById('calendarioGrid');

    data.forEach(item => {
      let dStr = item.data;
      if(dStr.includes('T')) dStr = dStr.split('T')[0];
      const parts = dStr.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}`; // DD/MM
      const isEsgotado = item.vagas_ocupadas >= item.vagas_totais;

      const div = document.createElement('div');
      div.style.background = isEsgotado ? 'var(--warning)' : 'var(--primary)';
      div.style.color = 'white';
      div.style.padding = '1rem';
      div.style.borderRadius = '12px';
      div.style.textAlign = 'center';
      div.style.cursor = isEsgotado ? 'not-allowed' : 'pointer';
      div.style.transition = 'transform 0.2s';
      div.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      
      div.onmouseover = () => { if(!isEsgotado) div.style.transform = 'scale(1.05)'; };
      div.onmouseout = () => { if(!isEsgotado) div.style.transform = 'scale(1)'; };

      div.innerHTML = `
        <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">${formattedDate}</h3>
        <p style="font-size: 0.8rem; font-weight: bold;">
          ${isEsgotado ? 'Esgotado' : (item.vagas_totais - item.vagas_ocupadas) + ' vagas'}
        </p>
      `;

      if (!isEsgotado) {
        div.addEventListener('click', () => showTimeSelection(item));
      }
      grid.appendChild(div);
    });
  }

  async function showTimeSelection(agendaItem) {
    listaAgendasDisponiveis.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Carregando horários...</p>';

    // Obter horários já agendados para esta data
    const { data: agendamentos, error } = await supabase
      .from('agendamentos_cidadao')
      .select('horario_escolhido')
      .eq('agenda_id', agendaItem.id);

    const takenTimes = agendamentos ? agendamentos.map(a => a.horario_escolhido) : [];
    
    // Todos os horários da agenda
    const allTimes = (agendaItem.horarios || '').split(',').map(h => h.trim()).filter(h => h);
    
    let dStr = agendaItem.data;
    if(dStr.includes('T')) dStr = dStr.split('T')[0];
    const parts = dStr.split('-');
    const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

    listaAgendasDisponiveis.innerHTML = `
      <button id="btnVoltarAgenda" class="btn" style="background: var(--bg-main); color: var(--text-main); margin-bottom: 1rem;">&larr; Voltar para Datas</button>
      <h3 style="color: var(--primary); margin-bottom: 1rem; text-align: center;">📅 ${formattedDate}</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">Escolha um horário:</p>
      <div id="timeChips" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;"></div>
      
      <div id="pautaContainer" style="display: none;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: var(--text-main);">Pauta da Reunião:</label>
        <textarea id="pautaInput" rows="3" placeholder="Qual será o assunto principal?" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color); padding: 0.8rem; background: var(--bg-main); color: var(--text-main); margin-bottom: 1rem;"></textarea>
        <button id="btnConfirmarAgendamento" class="btn btn-primary" style="width: 100%;">Confirmar Agendamento</button>
      </div>
    `;

    document.getElementById('btnVoltarAgenda').addEventListener('click', loadAgendasDisponiveis);

    const timeChips = document.getElementById('timeChips');
    const pautaContainer = document.getElementById('pautaContainer');
    let selectedTime = null;

    if (allTimes.length === 0) {
      timeChips.innerHTML = '<p style="color:var(--text-muted);">Nenhum horário definido pelo Secretário.</p>';
      return;
    }

    allTimes.forEach(time => {
      const isTaken = takenTimes.includes(time);
      const chip = document.createElement('div');
      chip.textContent = time;
      chip.style.padding = '0.5rem 1rem';
      chip.style.borderRadius = '99px';
      chip.style.fontWeight = 'bold';
      chip.style.cursor = isTaken ? 'not-allowed' : 'pointer';
      
      if (isTaken) {
        chip.style.background = 'var(--bg-main)';
        chip.style.color = 'var(--text-muted)';
        chip.style.border = '1px solid var(--border-color)';
        chip.style.textDecoration = 'line-through';
      } else {
        chip.style.background = 'var(--secondary)';
        chip.style.color = 'white';
        chip.style.border = '1px solid var(--secondary)';
        chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        
        chip.addEventListener('click', () => {
          // Reset all available chips
          Array.from(timeChips.children).forEach(c => {
            if (c.style.cursor !== 'not-allowed') {
              c.style.background = 'var(--secondary)';
              c.style.color = 'white';
            }
          });
          // Highlight selected
          chip.style.background = 'var(--primary)';
          selectedTime = time;
          pautaContainer.style.display = 'block';
        });
      }
      timeChips.appendChild(chip);
    });

    document.getElementById('btnConfirmarAgendamento').addEventListener('click', async (e) => {
      const pauta = document.getElementById('pautaInput').value.trim();
      if (!pauta) {
        alert('Por favor, informe a pauta da reunião.');
        return;
      }
      await agendarAtendimento(agendaItem.id, selectedTime, pauta, e.target);
    });
  }

  async function agendarAtendimento(agendaId, horario, pauta, btnElement) {
    const sessionData = localStorage.getItem('cidadaoSession');
    const session = sessionData ? JSON.parse(sessionData) : null;
    
    if (!session) {
      alert('Você precisa estar logado para agendar!');
      return;
    }

    const originalText = btnElement.textContent;
    btnElement.textContent = 'Aguarde...';
    btnElement.disabled = true;

    // Verificar se já tem agendamento para este dia (opcional, ou podemos deixar marcar múltiplos, mas o normal é 1)
    const { data: existente } = await supabase
      .from('agendamentos_cidadao')
      .select('id')
      .eq('agenda_id', agendaId)
      .eq('user_id', session.id);

    if (existente && existente.length > 0) {
      alert('Você já possui um agendamento para esta data!');
      btnElement.textContent = originalText;
      btnElement.disabled = false;
      return;
    }

    // Buscar vaga atual para incrementar
    const { data: agenda } = await supabase
      .from('agendas_secretario')
      .select('vagas_ocupadas, vagas_totais')
      .eq('id', agendaId)
      .single();

    if (agenda.vagas_ocupadas >= agenda.vagas_totais) {
      alert('Vagas esgotadas para esta data!');
      loadAgendasDisponiveis();
      return;
    }

    const newVagasOcupadas = agenda.vagas_ocupadas + 1;

    // Inserir agendamento
    const { error: errInsert } = await supabase
      .from('agendamentos_cidadao')
      .insert([{
        agenda_id: agendaId,
        user_id: session.id,
        horario_escolhido: horario,
        pauta: pauta
      }]);

    if (errInsert) {
      alert('Erro ao agendar.');
      btnElement.textContent = originalText;
      btnElement.disabled = false;
      return;
    }

    // Atualizar vagas
    await supabase
      .from('agendas_secretario')
      .update({ vagas_ocupadas: newVagasOcupadas })
      .eq('id', agendaId);

    alert('Agendamento confirmado com sucesso!');
    document.getElementById('modalAgendaCidadao').style.display = 'none';
  }
  // --- Fim Agenda Logic ---

  const btnCancelQuickForm = document.getElementById('btnCancelQuickForm');
  if (btnCancelQuickForm) {
    btnCancelQuickForm.addEventListener('click', () => {
      quickForm.style.display = 'none';
      actionMenu.style.display = 'grid';
    });
  }

  const btnCancelWizard = document.getElementById('btnCancelWizard');
  if (btnCancelWizard) {
    btnCancelWizard.addEventListener('click', () => {
      wizardForm.style.display = 'none';
      stepperIndicator.style.display = 'none';
      actionMenu.style.display = 'grid';
      currentStep = 1;
      showStep(currentStep);
    });
  }

  // Auto-detect secretaria for QuickForm (Dúvidas)
  if (quickTitle) {
    quickTitle.addEventListener('input', (e) => {
      if (quickFormType.value !== 'Duvida') return;
      const text = e.target.value.toLowerCase();
      let sec = 'Governo';
      
      if (/\b(luz|lâmpada|lampada|poste|escuro|apagado)\b/i.test(text)) sec = 'Iluminação Pública';
      else if (/\b(buraco|asfalto|rua|calçada|pavimento)\b/i.test(text)) sec = 'Infraestrutura';
      else if (/\b(lixo|árvore|arvore|animal|animais|mato|entulho)\b/i.test(text)) sec = 'Meio Ambiente';
      else if (/\b(médico|medico|remédio|remedio|posto|saúde|saude|exame|hospital)\b/i.test(text)) sec = 'Saúde';
      else if (/\b(ônibus|onibus|transporte|escola|professor|matrícula|matricula|creche)\b/i.test(text)) sec = 'Educação';
      else if (/\b(imposto|iptu|taxa|tributo|multa|alvará|alvara|dívida|divida)\b/i.test(text)) sec = 'Tributos';
      
      quickSecretaria.value = sec;
      quickSecBadge.textContent = sec;
    });
  }

  const btnSubmitQuickForm = document.getElementById('btnSubmitQuickForm');
  if (btnSubmitQuickForm) {
    btnSubmitQuickForm.addEventListener('click', async () => {
      const text = quickTitle.value.trim();
      if (!text) {
        alert('Por favor, digite sua mensagem.');
        return;
      }

      const sessionData = localStorage.getItem('cidadaoSession');
      const session = sessionData ? JSON.parse(sessionData) : null;
      if (!session) {
        alert('Você precisa estar logado!');
        return;
      }

      const originalText = btnSubmitQuickForm.textContent;
      btnSubmitQuickForm.textContent = 'Enviando...';
      btnSubmitQuickForm.disabled = true;

      try {
        const titleStr = text;
        const secretariaStr = quickFormType.value === 'Duvida' ? quickSecretaria.value : 'Governo';
        const user = session;

        const report = {
          title: `${quickFormType.value} - App Cidadão`,
          secretaria: secretariaStr,
          description: titleStr,
          status: 'Aberto',
          tipo: quickFormType.value,
          user_id: user.id
        };

        const { error } = await supabase
          .from('reports_paracuru')
          .insert([report]);

        if (error) throw error;

        quickForm.innerHTML = `
          <div style="text-align: center; padding: 1rem;">
            <h3 style="color: var(--success); margin-bottom: 1rem;">✅ Enviado com Sucesso!</h3>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Acompanhe em "Meus Relatos".</p>
            <button onclick="window.location.reload()" class="btn btn-primary" style="width: 100%;">Voltar ao Início</button>
          </div>
        `;
      } catch (err) {
        alert('Erro ao enviar. Tente novamente.');
        btnSubmitQuickForm.textContent = originalText;
        btnSubmitQuickForm.disabled = false;
      }
    });
  }
  // --- END MENU LOGIC ---

  // Wizard Logic
  let currentStep = 1;
  const totalSteps = 3;

  function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    
    document.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i < step);
    });

    // Refresh Map size if step 2 is active
    if (step === 2 && map) {
      setTimeout(() => map.invalidateSize(), 200);
    }
  }

  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      // Basic validation for Step 1
      if (currentStep === 1) {
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const secretariaInput = document.getElementById('secretaria');
        
        if (!title) {
          alert('Preencha o título do problema primeiro.');
          return;
        }

        // AI Triagem
        if (!secretariaInput.value && description) {
          const originalText = e.target.textContent;
          e.target.textContent = 'Aguarde (IA Analisando)...';
          e.target.disabled = true;

          try {
            const { data, error } = await supabase.functions.invoke('ai_triagem', {
              body: { title, description }
            });
            
            if (!error && data && data.secretaria) {
               secretariaInput.value = data.secretaria;
               secretariaInput.dispatchEvent(new Event('change')); // load subcategories
               setTimeout(() => {
                  const subInput = document.getElementById('subcategory');
                  if (data.subcategoria) {
                     Array.from(subInput.options).forEach(opt => {
                       if(opt.value === data.subcategoria) subInput.value = data.subcategoria;
                     });
                  }
               }, 100);
            }
          } catch(err) {
             console.log('AI Triagem falhou (talvez a edge function não esteja publicada), usando fallback manual', err);
          } finally {
             e.target.textContent = originalText;
             e.target.disabled = false;
          }
        }
        
        if (!secretariaInput.value) {
          alert('Preencha a secretaria.');
          return;
        }
      } else if (currentStep === 2) {
        const endereco = document.getElementById('endereco').value.trim();
        const bairro = document.getElementById('bairro').value.trim();
        if (!endereco || !bairro) {
          alert('Por favor, preencha a Rua e o Bairro para a prefeitura encontrar o local!');
          return;
        }
      }
      
      if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
      }
    });
  });

  document.querySelectorAll('.prev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
      }
    });
  });

  // Leaflet Map Initialization
  // Default to Paracuru Coordinates (approximate center)
  let initialLat = -3.4143;
  let initialLng = -39.0304;
  let markerLocation = { lat: initialLat, lng: initialLng }; 
  
  const map = L.map('map').setView([markerLocation.lat, markerLocation.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const marker = L.marker([markerLocation.lat, markerLocation.lng], { draggable: true }).addTo(map);

  async function fetchAddress(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        
        const street = address.road || address.pedestrian || address.path || address.street || '';
        const suburb = address.suburb || address.neighbourhood || address.city_district || address.village || address.town || '';
        
        if (street) document.getElementById('endereco').value = street;
        if (suburb) document.getElementById('bairro').value = suburb;
      }
    } catch(e) {
      console.log('Reverse geocoding falhou', e);
    }
  }

  marker.on('dragend', function (e) {
    const position = marker.getLatLng();
    markerLocation = { lat: position.lat, lng: position.lng };
    fetchAddress(position.lat, position.lng);
  });

  // GPS Location
  const btnMyLocation = document.getElementById('btnMyLocation');
  btnMyLocation.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      btnMyLocation.textContent = '⏳ Buscando...';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          markerLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          map.setView([markerLocation.lat, markerLocation.lng], 16);
          marker.setLatLng([markerLocation.lat, markerLocation.lng]);
          fetchAddress(markerLocation.lat, markerLocation.lng);
          
          btnMyLocation.textContent = '✅ GPS Capturado';
          btnMyLocation.style.background = 'var(--secondary)';
          btnMyLocation.style.borderColor = 'var(--secondary)';
          btnMyLocation.style.color = '#fff';
        },
        (err) => {
          console.warn(`GPS Error(${err.code}): ${err.message}`);
          alert(`Erro ao obter GPS: ${err.message}. Verifique as permissões do navegador ou arraste o pino no mapa manualmente.`);
          btnMyLocation.textContent = '📍 Usar Minha Localização GPS';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      alert('Seu navegador não suporta geolocalização.');
    }
  });

  // Image Upload and Compression (To save LocalStorage space)
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photoPreview');
  const uploadWrapper = document.getElementById('uploadWrapper');
  let currentPhotoData = null;

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress Image using Canvas
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          currentPhotoData = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
          photoPreview.src = currentPhotoData;
          photoPreview.style.display = 'block';
          uploadWrapper.style.display = 'none';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Form Submission
  const form = document.getElementById('wizardForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentPhotoData) {
      alert('A foto é obrigatória!');
      return;
    }

    const sessionData = localStorage.getItem('cidadaoSession');
    const session = sessionData ? JSON.parse(sessionData) : null;
    if (!session) {
      alert('Você precisa estar logado para enviar um relato!');
      window.location.reload();
      return;
    }
    const userId = session.id;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;

    try {
      if (navigator.onLine) {
        submitBtn.textContent = 'IA Analisando Foto...';
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke('ai_analise_imagem', {
            body: { base64Image: currentPhotoData, description: document.getElementById('description').value }
          });
          if (aiError) throw aiError;
          if (aiData && aiData.error) throw new Error(aiData.error);

          if (aiData) {
            if (aiData.valida === false) {
              alert(`Foto recusada pela Inteligência Artificial:\n${aiData.motivo}`);
              submitBtn.textContent = originalText;
              submitBtn.disabled = false;
              return;
            }
          }
        } catch(err) {
          console.warn('AI Análise de Imagem falhou ou está fora do ar, prosseguindo com o envio normal:', err);
          // Não damos return aqui. O código segue silenciosamente.
        }
        submitBtn.textContent = 'Enviando Relato...';
      }

      if (!navigator.onLine) {
        // Modo offline
        const offlineData = {
          tipo: 'Problema',
          title: document.getElementById('title').value,
          secretaria: document.getElementById('secretaria').value,
          description: document.getElementById('description').value,
          photoBase64: currentPhotoData,
          location_lat: markerLocation.lat,
          location_lng: markerLocation.lng,
          endereco: document.getElementById('endereco').value.trim() || null,
          bairro: document.getElementById('bairro').value.trim() || null,
          subcategory: document.getElementById('subcategory').value || null
        };
        const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
        queue.push(offlineData);
        localStorage.setItem('offlineQueue', JSON.stringify(queue));
        
        alert('Você está sem internet. O relato foi salvo no seu celular e será enviado automaticamente quando a conexão voltar!');
        window.location.reload();
        return;
      }

      // 1. Converter Base64 para Blob para upload
      const response = await fetch(currentPhotoData);
      const blob = await response.blob();
      
      // 2. Gerar nome único para o arquivo
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;

      // 3. Fazer upload para o Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatos-fotos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.error('Erro no upload da foto:', uploadError);
        alert('Erro ao enviar a foto. Verifique se o bucket "relatos-fotos" foi criado.');
        throw uploadError;
      }

      // 4. Obter a URL pública da foto
      const { data: { publicUrl } } = supabase.storage
        .from('relatos-fotos')
        .getPublicUrl(fileName);

      // 5. Inserir os dados no banco usando a URL pública
      const { error } = await supabase
        .from('reports_paracuru')
        .insert([
          {
            tipo: 'Problema',
            title: document.getElementById('title').value,
            secretaria: document.getElementById('secretaria').value,
            description: document.getElementById('description').value,
            photo: publicUrl,
            location_lat: markerLocation.lat,
            location_lng: markerLocation.lng,
            status: 'Aberto',
            user_id: userId,
            endereco: document.getElementById('endereco').value.trim() || null,
            bairro: document.getElementById('bairro').value.trim() || null,
            subcategory: document.getElementById('subcategory').value || null
          }
        ]);

      if (error) throw error;

      const whatsText = encodeURIComponent(`Acabei de reportar um problema: *${document.getElementById('title').value}* pelo Paracuru Alerta! Faça sua parte também.`);
      
      form.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h2 style="color: var(--success); margin-bottom: 1rem;">✅ Relato Enviado!</h2>
          <p style="margin-bottom: 2rem; color: var(--text-muted);">Muito obrigado por ajudar a nossa cidade.</p>
          <a href="https://wa.me/?text=${whatsText}" target="_blank" class="btn" style="background-color: #25D366; color: white; display: inline-block; width: 100%; margin-bottom: 1rem; text-decoration: none;">📱 Compartilhar no WhatsApp</a>
          <button onclick="window.location.reload()" class="btn btn-secondary" style="width: 100%;">Enviar outro relato</button>
        </div>
      `;

    } catch(err) {
      alert('Erro ao salvar no banco de dados. Tente novamente mais tarde.');
      console.error(err);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Offline Sync
  window.addEventListener('online', async () => {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;

    alert('Internet voltou! Enviando relatos salvos offline...');
    
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const response = await fetch(item.photoBase64);
        const blob = await response.blob();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
        
        const { error: uploadError } = await supabase.storage.from('relatos-fotos').upload(fileName, blob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('relatos-fotos').getPublicUrl(fileName);
        
        await supabase.from('reports_paracuru').insert([{
          tipo: item.tipo || 'Problema',
          title: item.title,
          secretaria: item.secretaria,
          description: item.description,
          photo: publicUrl,
          location_lat: item.location_lat,
          location_lng: item.location_lng,
          subcategory: item.subcategory,
          status: 'Aberto'
        }]);
      } catch (err) {
        console.error('Erro ao syncar relato offline', err);
      }
    }
    
    localStorage.removeItem('offlineQueue');
    alert('Relatos offline enviados com sucesso!');
    window.location.reload();
  });

  // PWA Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('SW registrado', reg))
      .catch(err => console.log('SW erro', err));
  }
});

