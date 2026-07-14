import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Autenticação: Verificar se o servidor está logado
  const sessionData = localStorage.getItem('servidorSession');
  if (!sessionData) {
    window.location.href = 'login_servidor.html';
    return;
  }
  const session = JSON.parse(sessionData);

  // Lógica de Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      localStorage.removeItem('servidorSession');
      window.location.href = 'login_servidor.html';
    });
  }

  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;
  let isDark = localStorage.getItem('theme') === 'dark';
  
  if (isDark) {
    htmlEl.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️ Modo Claro';
  }

  themeToggle.addEventListener('click', () => {
    isDark = htmlEl.getAttribute('data-theme') === 'dark';
    htmlEl.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🌙 Modo Escuro' : '☀️ Modo Claro';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    renderCharts(); // Re-render to adjust colors
  });

  const reportsGrid = document.getElementById('reportsGrid');
  const filterSecretaria = document.getElementById('filterSecretaria');
  const filterTipo = document.getElementById('filterTipo');
  const filterStatus = document.getElementById('filterStatus');
  const filterBairro = document.getElementById('filterBairro');
  const btnClear = document.getElementById('btnClear');

  // Restringe a visualização à secretaria do servidor (se não for Admin Geral / "Todas")
  if (session && session.secretaria && session.secretaria !== 'Todas') {
    filterSecretaria.value = session.secretaria;
    filterSecretaria.disabled = true;
  }

  let secChartInstance = null;
  let statusChartInstance = null;
  let dashboardMap = null;
  let mapMarkers = [];
  let heatmapLayer = null;
  let isHeatmapActive = false;
  let latestReports = [];
  let currentReportId = null;
  let responsaveisList = [];

  // Init Map
  function initMap() {
    dashboardMap = L.map('dashboardMap').setView([-3.4143, -39.0304], 13); // Paracuru default
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(dashboardMap);
  }

  function getTextColor() {
    return isDark ? '#f9fafb' : '#111827';
  }

  async function loadDashboard() {
    const { data: allReports, error } = await supabase
      .from('reports_paracuru')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar relatos:', error);
      return;
    }
    
    // Busca os nomes dos perfis
    const { data: profilesData } = await supabase.from('profiles').select('id, nome_completo, whatsapp');
    window.profileMap = {};
    if (profilesData) {
      profilesData.forEach(p => {
        window.profileMap[p.id] = { nome: p.nome_completo, whatsapp: p.whatsapp };
      });
    }
    
    // Populate Bairro filter with unique values
    const uniqueBairros = [...new Set(allReports.filter(r => r.bairro).map(r => r.bairro.trim()))].sort();
    const currentBairroFilter = filterBairro.value;
    
    filterBairro.innerHTML = '<option value="Todos">Todos os Bairros</option>';
    uniqueBairros.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      filterBairro.appendChild(opt);
    });
    
    // Restore previous selection if it still exists
    if (currentBairroFilter && currentBairroFilter !== 'Todos' && uniqueBairros.includes(currentBairroFilter)) {
      filterBairro.value = currentBairroFilter;
    } else {
      filterBairro.value = 'Todos';
    }

    const secFilter = filterSecretaria.value;
    const statFilter = filterStatus.value;
    const bairroFilter = filterBairro.value;
    const tipoFilter = filterTipo ? filterTipo.value : 'Todos';
    
    const reports = allReports.filter(r => {
      const matchSec = secFilter === 'Todas' || r.secretaria === secFilter;
      const matchStat = statFilter === 'Todos' || r.status === statFilter;
      const matchBairro = bairroFilter === 'Todos' || (r.bairro && r.bairro.trim() === bairroFilter);
      const matchTipo = tipoFilter === 'Todos' || r.tipo === tipoFilter;
      return matchSec && matchStat && matchBairro && matchTipo;
    });

    latestReports = reports;

    // Metrics
    let open = 0, progress = 0, resolved = 0;
    reports.forEach(r => {
      if(r.status === 'Aberto') open++;
      else if(r.status === 'Em Andamento') progress++;
      else if(r.status === 'Resolvido') resolved++;
    });

    document.getElementById('totalCount').textContent = reports.length;
    document.getElementById('openCount').textContent = open;
    document.getElementById('progressCount').textContent = progress;
    document.getElementById('resolvedCount').textContent = resolved;

    renderCharts(reports, open, progress, resolved);
    renderMapMarkers(reports);
    renderCards(reports);
  }

  function renderCharts(reports, open, progress, resolved) {
    if(!reports) {
      return; // Prevenindo erros se reports não for passado
    }

    const secCounts = {};
    reports.forEach(r => {
      secCounts[r.secretaria] = (secCounts[r.secretaria] || 0) + 1;
    });

    const textColor = getTextColor();
    Chart.defaults.color = textColor;

    // Status Chart (Pie)
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Aberto', 'Em Andamento', 'Resolvido'],
        datasets: [{
          data: [open, progress, resolved],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Secretaria Chart (Bar)
    const ctxSec = document.getElementById('secretariaChart').getContext('2d');
    if (secChartInstance) secChartInstance.destroy();
    secChartInstance = new Chart(ctxSec, {
      type: 'bar',
      data: {
        labels: Object.keys(secCounts),
        datasets: [{
          label: 'Chamados',
          data: Object.values(secCounts),
          backgroundColor: '#4f46e5',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  function renderMapMarkers(filteredReports) {
    if(!dashboardMap) initMap();
    
    // Clear old markers
    mapMarkers.forEach(m => dashboardMap.removeLayer(m));
    mapMarkers = [];
    if (heatmapLayer) dashboardMap.removeLayer(heatmapLayer);

    if (isHeatmapActive) {
      const heatPoints = filteredReports
        .filter(r => r.location_lat && r.location_lng)
        .map(r => [r.location_lat, r.location_lng, 1]); // lat, lng, intensity
      
      if (heatPoints.length > 0) {
        heatmapLayer = L.heatLayer(heatPoints, {radius: 25, blur: 15}).addTo(dashboardMap);
      }
    } else {
      filteredReports.forEach(r => {
        if(r.location_lat && r.location_lng) {
          let color = r.status === 'Aberto' ? 'red' : (r.status === 'Resolvido' ? 'green' : 'orange');
          
          // Simple circle marker
          const marker = L.circleMarker([r.location_lat, r.location_lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            radius: 8
          }).addTo(dashboardMap);

          marker.bindPopup(`<b>${r.title}</b><br>${r.secretaria}${r.subcategory ? ' - ' + r.subcategory : ''}<br>Status: ${r.status}`);
          mapMarkers.push(marker);
        }
      });

      // Auto fit map to markers if there are any
      if(mapMarkers.length > 0) {
        const group = new L.featureGroup(mapMarkers);
        dashboardMap.fitBounds(group.getBounds().pad(0.5));
      }
    }
  }

  function renderCards(filtered) {
    reportsGrid.innerHTML = '';

    if (filtered.length === 0) {
      reportsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum chamado encontrado.</p>';
      return;
    }

    filtered.forEach(report => {
      const date = new Date(report.created_at).toLocaleDateString('pt-BR');
      const statusClass = 'status-' + report.status.replace(' ', '');
      
      let tipoColor = 'var(--text-muted)';
      if(report.tipo === 'Problema') tipoColor = 'var(--danger)';
      if(report.tipo === 'Duvida') tipoColor = 'var(--warning)';
      if(report.tipo === 'Feedback') tipoColor = 'var(--secondary)';
      if(report.tipo === 'Ouvidoria') tipoColor = 'var(--primary)';
      const tipoBadge = `<span style="background: ${tipoColor}; color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.5rem; display: inline-block;">${report.tipo || 'Problema'}</span>`;

      const cardImgHtml = report.photo 
        ? `<img src="${report.photo}" class="card-img" alt="Foto" style="pointer-events: none;">` 
        : `<div class="card-img" style="background: var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: bold; pointer-events: none;">Sem Foto</div>`;

      // Lógica para saber se há mensagem não respondida do cidadão
      let chatNotificationHtml = '';
      if (report.chat_history && report.chat_history.length > 0) {
        const lastMsg = report.chat_history[report.chat_history.length - 1];
        if (lastMsg.sender === 'cidadao') {
          chatNotificationHtml = `<div style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: white; padding: 0.3rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10; animation: pulse 2s infinite;">💬 Nova Mensagem</div>`;
        } else {
          chatNotificationHtml = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); color: white; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.7rem; z-index: 10;">💬 ${report.chat_history.length}</div>`;
        }
      }

      const card = document.createElement('div');
      card.className = 'card';
      card.style.position = 'relative'; // Para segurar o badge
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.height = '100%';
      card.innerHTML = `
        ${chatNotificationHtml}
        <div style="position: relative; cursor: pointer;" data-action="view-details" data-id="${report.id}" title="Clique para ver detalhes do chat">
          ${cardImgHtml}
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
            <span style="color: white; font-weight: bold; background: rgba(0,0,0,0.6); padding: 0.5rem 1rem; border-radius: 99px;">Ver Chat Completo</span>
          </div>
        </div>
        <div class="card-content" style="display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>${tipoBadge}<br><span class="status-badge ${statusClass}" style="margin-bottom:0;">${report.status}</span></div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${date}</span>
          </div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${report.title}</h3>
          ${report.tipo === 'Problema' ? `
          <p style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.5rem; font-weight: 500;">
            📍 ${report.endereco || 'Endereço não informado'} ${report.bairro ? ' - ' + report.bairro : ''}
          </p>` : ''}
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
            <b>${report.secretaria}</b> ${report.subcategory ? `> ${report.subcategory}` : ''}<br>
            ${report.description}
          </p>
          
          <div class="card-actions" style="display: flex; gap: 0.5rem; width: 100%; flex-wrap: wrap; margin-top: auto;">
            ${report.tipo === 'Problema' ? `
            <select class="quick-status-select" data-id="${report.id}" style="border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; font-size: 0.9rem; background: var(--bg-main); color: var(--text-main);">
              <option value="Aberto" ${report.status === 'Aberto' ? 'selected' : ''}>Aberto</option>
              <option value="Em Andamento" ${report.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
              <option value="Resolvido" ${report.status === 'Resolvido' ? 'selected' : ''}>Concluído</option>
            </select>
            ` : ''}
            <input type="text" class="quick-reply-input" data-id="${report.id}" placeholder="Responder ao cidadão..." style="flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; font-size: 0.9rem; background: var(--bg-main); color: var(--text-main); min-width: 150px;">
            <button class="btn btn-primary quick-reply-btn" data-id="${report.id}" style="padding: 0.5rem 1rem; width: auto; font-size: 0.9rem;">Enviar</button>
          </div>
        </div>
      `;
      reportsGrid.appendChild(card);
    });

    // Add event listeners to quick reply buttons
    document.querySelectorAll('.quick-reply-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const input = document.querySelector(`.quick-reply-input[data-id="${id}"]`);
        const text = input.value.trim();
        if (!text) return;
        
        const originalText = e.target.textContent;
        e.target.textContent = 'Enviando...';
        e.target.disabled = true;

        const report = filtered.find(r => r.id === id);
        const chatHistory = report.chat_history || [];
        chatHistory.push({
          sender: 'secretaria',
          text: text,
          date: new Date().toISOString()
        });

        const sessionData = localStorage.getItem('servidorSession');
        const sessionObj = sessionData ? JSON.parse(sessionData) : null;
        const serverEmail = sessionObj ? sessionObj.email : 'Servidor';
        
        let history = report.action_history || [];
        history.push({
          date: new Date().toISOString(),
          action: 'Enviou uma mensagem para o cidadão',
          user: serverEmail
        });

        const statusSelect = document.querySelector(`.quick-status-select[data-id="${id}"]`);
        const newStatus = statusSelect ? statusSelect.value : report.status;

        const { error } = await supabase
          .from('reports_paracuru')
          .update({ chat_history: chatHistory, action_history: history, status: newStatus })
          .eq('id', id);

        if (error) {
          alert('Erro ao enviar mensagem.');
          e.target.textContent = originalText;
          e.target.disabled = false;
        } else {
          input.value = '';
          e.target.textContent = 'Enviado!';
          setTimeout(() => {
            loadDashboard(); // Atualiza a tela
          }, 1000);
        }
      });
    });

    // Add event listeners to quick status select
    document.querySelectorAll('.quick-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const newStatus = e.target.value;
        updateStatus(id, newStatus);
      });
    });

    // Add event listeners to view details
    document.querySelectorAll('[data-action="view-details"]').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const report = filtered.find(r => r.id === id);
        if (report) showDetailsModal(report);
      });
    });
  }

  // Details Modal Logic
  const detailsModal = document.getElementById('detailsModal');
  const closeDetailsModal = document.getElementById('closeDetailsModal');
  
  if (closeDetailsModal) {
    closeDetailsModal.addEventListener('click', () => {
      detailsModal.style.display = 'none';
    });
  }

  function showDetailsModal(report) {
    currentReportId = report.id;
    document.getElementById('modalTitle').textContent = report.title;
    
    const statusEl = document.getElementById('modalStatus');
    statusEl.textContent = report.status;
    const statusColor = report.status === 'Aberto' ? 'var(--danger)' : (report.status === 'Resolvido' ? 'var(--secondary)' : 'var(--warning)');
    const date = new Date(report.created_at).toLocaleString('pt-BR');
    
    // Obtém os dados do cidadão do mapa que criamos no loadDashboard
    const citizen = (window.profileMap && window.profileMap[report.user_id]) 
      ? window.profileMap[report.user_id] 
      : { nome: 'Cidadão Desconhecido', whatsapp: '' };
      
    // Se a descrição for genérica (criada pelo app antigo), usamos o título como a mensagem real
    let displayDescription = report.description;
    if (report.description.includes('enviada via App Cidadão') && report.title.length > 20) {
       displayDescription = report.title;
    } else if (report.tipo === 'Duvida' || report.tipo === 'Feedback' || report.tipo === 'Ouvidoria') {
       // Para novos reports gerados pelo app atualizado, a descrição correta já vem no report.description!
       // Mas se o title contiver texto longo e a description estiver genérica, mesclamos.
       if (report.title && !report.title.includes('App Cidadão') && report.description.includes('App Cidadão')) {
          displayDescription = report.title;
       }
    }

    document.getElementById('modalTitle').textContent = report.title.includes('App Cidadão') ? report.tipo : report.title;
    const isProblema = report.tipo === 'Problema';
    const statusElm = document.getElementById('modalStatus');
    statusElm.textContent = report.status;
    statusElm.className = `status-badge status-${report.status.replace(' ', '').toLowerCase()}`;
    statusElm.style.display = isProblema ? 'inline-block' : 'none';
    
    // Trocamos o modalMeta para incluir o nome do cidadão
    document.getElementById('modalMeta').innerHTML = `${date} • ${report.secretaria} <span id="modalSubcategory" style="font-weight: 600; color: var(--primary);"></span><br><br><span style="background: rgba(79, 70, 229, 0.1); color: var(--primary); padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">👤 Enviado por: ${citizen.nome} ${citizen.whatsapp ? '(' + citizen.whatsapp + ')' : ''}</span>`;
    
    if (report.subcategory) {
      document.getElementById('modalSubcategory').textContent = ` > ${report.subcategory}`;
    } else {
      document.getElementById('modalSubcategory').textContent = '';
    }
    
    const photoEl = document.getElementById('modalPhoto');
    if (report.photo) {
      photoEl.src = report.photo;
      photoEl.style.display = 'block';
    } else {
      photoEl.style.display = 'none';
    }
    
    document.getElementById('modalDescription').textContent = displayDescription;
    document.getElementById('modalLocationText').textContent = `${report.endereco || 'Rua não informada'}, ${report.bairro || 'Bairro não informado'}`;
    
    if (report.location_lat != null && report.location_lng != null) {
      document.getElementById('modalLocation').textContent = `Coordenadas: Lat ${report.location_lat.toFixed(5)}, Lng ${report.location_lng.toFixed(5)}`;
    } else {
      document.getElementById('modalLocation').textContent = 'Coordenadas não fornecidas';
    }
    

    const locationContainer = document.getElementById('modalLocationContainer');
    if (locationContainer) {
      locationContainer.style.display = isProblema ? 'block' : 'none';
    }

    const descricaoContainer = document.getElementById('modalDescricaoContainer');
    if (descricaoContainer) {
      descricaoContainer.style.display = isProblema ? 'block' : 'none';
    }

    const gestaoContainer = document.getElementById('modalGestaoContainer');
    if (gestaoContainer) {
      gestaoContainer.style.display = isProblema ? 'block' : 'none';
    }
    
    const historyContainer = document.getElementById('modalHistoryContainer');
    if (historyContainer) {
      historyContainer.style.display = isProblema ? 'block' : 'none';
    }
    
    document.getElementById('modalResponsavel').value = report.responsavel || '';
    document.getElementById('modalNotas').value = report.notas_internas || '';
    
    if (typeof window.renderChat === 'function') {
      let chatToRender = report.chat_history ? [...report.chat_history] : [];
      if (!isProblema && displayDescription) {
        chatToRender.unshift({
          sender: 'cidadao',
          text: displayDescription,
          date: report.created_at
        });
      }
      window.renderChat(chatToRender);
    }
    
    const historyList = document.getElementById('modalHistory');
    historyList.innerHTML = '';
    if (report.action_history && report.action_history.length > 0) {
      report.action_history.forEach(h => {
        const d = new Date(h.date).toLocaleString('pt-BR');
        historyList.innerHTML += `<li style="margin-bottom: 0.3rem;"><b>${d}</b>: ${h.action} (<i>${h.user}</i>)</li>`;
      });
    } else {
      historyList.innerHTML = '<li>Nenhuma ação registrada ainda.</li>';
    }
    
    detailsModal.style.display = 'flex';
  }

  // Manage Responsavel Logic
  const responsavelModal = document.getElementById('responsavelModal');
  const btnManageResponsavel = document.getElementById('btnManageResponsavel');
  const closeResponsavelModal = document.getElementById('closeResponsavelModal');
  const btnAddResponsavel = document.getElementById('btnAddResponsavel');
  const newResponsavelName = document.getElementById('newResponsavelName');
  const responsavelListEl = document.getElementById('responsavelList');
  const modalResponsavelSelect = document.getElementById('modalResponsavel');

  if (btnManageResponsavel) {
    btnManageResponsavel.addEventListener('click', () => {
      responsavelModal.style.display = 'flex';
      loadResponsaveis();
    });
  }

  if (closeResponsavelModal) {
    closeResponsavelModal.addEventListener('click', () => {
      responsavelModal.style.display = 'none';
      loadResponsaveisForSelect();
    });
  }

  async function loadResponsaveis() {
    let query = supabase.from('responsaveis').select('*').order('nome');
    if (session.secretaria !== 'Todas') {
      query = query.eq('secretaria', session.secretaria);
    }
    const { data, error } = await query;
    
    responsavelListEl.innerHTML = '';
    if (error) {
      console.error('Erro ao carregar responsáveis', error);
      return;
    }
    responsaveisList = data || [];
    
    responsaveisList.forEach(resp => {
      const li = document.createElement('li');
      li.style.padding = '0.5rem';
      li.style.borderBottom = '1px solid var(--border)';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.innerHTML = `<span>${resp.nome} <small style="color: var(--text-muted)">(${resp.secretaria})</small></span>
                      <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; width: auto; font-size: 0.8rem;" onclick="deleteResponsavel('${resp.id}')">Excluir</button>`;
      responsavelListEl.appendChild(li);
    });
    loadResponsaveisForSelect();
  }

  async function loadResponsaveisForSelect() {
    if (!modalResponsavelSelect) return;
    let query = supabase.from('responsaveis').select('*').order('nome');
    if (session.secretaria !== 'Todas') {
      query = query.eq('secretaria', session.secretaria);
    }
    const { data } = await query;
    responsaveisList = data || [];
    
    const currentVal = modalResponsavelSelect.value;
    modalResponsavelSelect.innerHTML = '<option value="">Não atribuído</option>';
    responsaveisList.forEach(resp => {
      const opt = document.createElement('option');
      opt.value = resp.nome;
      opt.textContent = `${resp.nome} (${resp.secretaria})`;
      modalResponsavelSelect.appendChild(opt);
    });
    modalResponsavelSelect.value = currentVal;
  }

  if (btnAddResponsavel) {
    btnAddResponsavel.addEventListener('click', async () => {
      const nome = newResponsavelName.value.trim();
      if (!nome) return;
      const secretaria = session.secretaria === 'Todas' ? prompt('Digite a Secretaria para este responsável:') : session.secretaria;
      if (!secretaria) return;

      const { error } = await supabase.from('responsaveis').insert([{ nome, secretaria }]);
      if (error) {
         alert('Erro ao adicionar responsável (a tabela existe?)');
         console.error(error);
      } else {
         newResponsavelName.value = '';
         loadResponsaveis();
      }
    });
  }

  window.deleteResponsavel = async function(id) {
    if(confirm('Excluir este responsável?')) {
      await supabase.from('responsaveis').delete().eq('id', id);
      loadResponsaveis();
    }
  };

  loadResponsaveisForSelect();

  // Salvar Detalhes Internos
  const btnSaveDetails = document.getElementById('btnSaveDetails');
  if (btnSaveDetails) {
    btnSaveDetails.addEventListener('click', async () => {
      if (!currentReportId) return;
      
      const responsavel = document.getElementById('modalResponsavel').value;
      const notas_internas = document.getElementById('modalNotas').value;

      const { error } = await supabase
        .from('reports_paracuru')
        .update({ responsavel, notas_internas })
        .eq('id', currentReportId);

      if (error) {
        alert('Erro ao salvar detalhes internos.');
      } else {
        alert('Salvo com sucesso!');
        // Update local data
        const report = latestReports.find(r => r.id === currentReportId);
        if (report) {
          report.responsavel = responsavel;
          report.notas_internas = notas_internas;
        }
      }
    });
  }

  // Lógica de Visualização de Foto
  const modalPhoto = document.getElementById('modalPhoto');
  const photoViewerModal = document.getElementById('photoViewerModal');
  const closePhotoViewer = document.getElementById('closePhotoViewer');
  const fullScreenPhoto = document.getElementById('fullScreenPhoto');

  if (modalPhoto && photoViewerModal) {
    modalPhoto.style.cursor = 'zoom-in';
    modalPhoto.addEventListener('click', () => {
      fullScreenPhoto.src = modalPhoto.src;
      photoViewerModal.style.display = 'flex';
    });
    closePhotoViewer.addEventListener('click', () => {
      photoViewerModal.style.display = 'none';
    });
    photoViewerModal.addEventListener('click', (e) => {
      if (e.target === photoViewerModal) {
        photoViewerModal.style.display = 'none';
      }
    });
  }

  // Tecla ESC para fechar modais
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (photoViewerModal && photoViewerModal.style.display === 'flex') {
        photoViewerModal.style.display = 'none';
      } else if (detailsModal && detailsModal.style.display === 'flex') {
        detailsModal.style.display = 'none';
      }
    }
  });

  // Lógica do Chat
  const btnSendChat = document.getElementById('btnSendChat');
  const chatInput = document.getElementById('chatInput');

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnSendChat) btnSendChat.click();
      }
    });
  }

  window.renderChat = function(chatArray) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';
    if (!chatArray || chatArray.length === 0) {
      chatContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Nenhuma mensagem ainda. Inicie a conversa!</p>';
      return;
    }

    chatArray.forEach(msg => {
      const isServidor = msg.sender === 'secretaria';
      const align = isServidor ? 'flex-end' : 'flex-start';
      const bg = isServidor ? 'var(--primary)' : 'var(--bg-card)';
      const color = isServidor ? '#fff' : 'var(--text)';
      const border = isServidor ? 'none' : '1px solid var(--border)';
      
      const d = new Date(msg.date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

      chatContainer.innerHTML += `
        <div style="align-self: ${align}; background: ${bg}; color: ${color}; border: ${border}; padding: 0.5rem 1rem; border-radius: 8px; max-width: 80%;">
          <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.2rem;">${isServidor ? 'Secretaria' : 'Cidadão'} • ${d}</div>
          <div>${msg.text}</div>
        </div>
      `;
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  if (btnSendChat) {
    btnSendChat.addEventListener('click', async () => {
      const text = chatInput.value.trim();
      if (!text || !currentReportId) return;
      
      const report = latestReports.find(r => r.id === currentReportId);
      if (!report) return;

      const newMsg = {
        sender: 'secretaria',
        text: text,
        date: new Date().toISOString()
      };

      const chatHistory = report.chat_history || [];
      chatHistory.push(newMsg);

      const { error } = await supabase
        .from('reports_paracuru')
        .update({ chat_history: chatHistory })
        .eq('id', currentReportId);

      if (error) {
        alert('Erro ao enviar mensagem.');
      } else {
        chatInput.value = '';
        window.renderChat(chatHistory);
        report.chat_history = chatHistory; // update locally
      }
    });
  }

  async function updateStatus(id, newStatus) {
    const sessionData = localStorage.getItem('servidorSession');
    const sessionObj = sessionData ? JSON.parse(sessionData) : null;
    const serverEmail = sessionObj ? sessionObj.email : 'Servidor Desconhecido';
    
    const { data: currentReport } = await supabase.from('reports_paracuru').select('action_history').eq('id', id).single();
    
    let history = [];
    if (currentReport && currentReport.action_history) {
      history = currentReport.action_history;
    }

    history.push({
      date: new Date().toISOString(),
      action: `Status alterado para ${newStatus}`,
      user: serverEmail
    });

    const { error } = await supabase
      .from('reports_paracuru')
      .update({ status: newStatus, action_history: history })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status.');
    } else {
      loadDashboard(); // Refresh everything
    }
  }

  // Filters Event Listeners
  filterSecretaria.addEventListener('change', loadDashboard);
  filterStatus.addEventListener('change', loadDashboard);
  filterBairro.addEventListener('change', loadDashboard);
  if (filterTipo) filterTipo.addEventListener('change', loadDashboard);

  // Export CSV
  const btnExportCSV = document.getElementById('btnExportCSV');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', async () => {
      const secFilter = filterSecretaria.value;
      const statFilter = filterStatus.value;
      
      const { data: allReports } = await supabase.from('reports_paracuru').select('*').order('created_at', { ascending: false });
      if (!allReports) return;

      const filtered = allReports.filter(r => {
        const matchSec = secFilter === 'Todas' || r.secretaria === secFilter;
        const matchStat = statFilter === 'Todos' || r.status === statFilter;
        return matchSec && matchStat;
      });

      if (filtered.length === 0) {
        alert('Nenhum dado para exportar.');
        return;
      }

      const headers = ['ID', 'Data', 'Titulo', 'Secretaria', 'Subcategoria', 'Status', 'Descricao', 'Rua', 'Bairro', 'Lat', 'Lng'];
      const csvRows = [headers.join(',')];

      filtered.forEach(r => {
        const row = [
          r.id,
          new Date(r.created_at).toLocaleString('pt-BR'),
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.secretaria}"`,
          `"${r.subcategory || ''}"`,
          `"${r.status}"`,
          `"${r.description.replace(/"/g, '""')}"`,
          `"${(r.endereco || '').replace(/"/g, '""')}"`,
          `"${(r.bairro || '').replace(/"/g, '""')}"`,
          r.location_lat,
          r.location_lng
        ];
        csvRows.push(row.join(','));
      });

      const csvData = csvRows.join('\n');
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'chamados.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // IA Resumo Logic
  const btnResumoIA = document.getElementById('btnResumoIA');
  const iaResumoModal = document.getElementById('iaResumoModal');
  const closeIaResumoModal = document.getElementById('closeIaResumoModal');
  const iaResumoContent = document.getElementById('iaResumoContent');

  if (btnResumoIA && iaResumoModal) {
    btnResumoIA.addEventListener('click', async () => {
      iaResumoModal.style.display = 'flex';
      iaResumoContent.innerHTML = 'Gerando resumo inteligente com base nos últimos dados... ⏳<br><small style="color: var(--text-muted)">Isso pode levar alguns segundos.</small>';
      
      try {
        const { data, error } = await supabase.functions.invoke('ai_resumo_gerencial', {
          body: { reports: latestReports }
        });
        
        if (error) throw error;
        if (data && data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        
        // Formatar Markdown básico para HTML
        let htmlContent = (data.resumo || 'Nenhum resumo gerado.')
           .replace(/\n/g, '<br>')
           .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
           .replace(/\*(.*?)\*/g, '<em>$1</em>');
           
        iaResumoContent.innerHTML = htmlContent;
      } catch(err) {
        console.error('Erro na IA:', err);
        iaResumoContent.innerHTML = '<span style="color: var(--danger);">Falha ao gerar o resumo. A Inteligência Artificial pode não estar configurada no momento.</span>';
      }
    });
    
    closeIaResumoModal.addEventListener('click', () => {
      iaResumoModal.style.display = 'none';
    });
  }

  // Clear Data
  btnClear.addEventListener('click', async () => {
    if(confirm('Isso apagará TODOS os dados do sistema. Tem certeza?')) {
      // Passo 1: Buscar todos os IDs
      const { data: reportsToDelete, error: fetchError } = await supabase
        .from('reports_paracuru')
        .select('id');
        
      if (fetchError) {
         alert('Erro ao buscar relatos para apagar: ' + fetchError.message);
         return;
      }
      
      if (!reportsToDelete || reportsToDelete.length === 0) {
         alert('Não há dados para limpar.');
         return;
      }

      const ids = reportsToDelete.map(r => r.id);

      // Passo 2: Deletar usando os IDs (PostgREST costuma bloquear neq para bulk delete)
      const { error } = await supabase
        .from('reports_paracuru')
        .delete()
        .in('id', ids);

      if (error) {
         console.error('Erro ao limpar dados:', error);
         alert('Erro ao limpar dados do banco. Verifique as permissões (RLS) no Supabase. Detalhe: ' + error.message);
      } else {
         alert('Dados apagados com sucesso!');
         loadDashboard();
      }
    }
  });

  // Toggle Heatmap Logic
  const btnToggleHeatmap = document.getElementById('btnToggleHeatmap');
  if (btnToggleHeatmap) {
    btnToggleHeatmap.addEventListener('click', () => {
      isHeatmapActive = !isHeatmapActive;
      btnToggleHeatmap.textContent = isHeatmapActive ? 'Desativar Mapa de Calor' : 'Ativar Mapa de Calor';
      btnToggleHeatmap.classList.toggle('btn-primary', isHeatmapActive);
      btnToggleHeatmap.classList.toggle('btn-secondary', !isHeatmapActive);
      renderMapMarkers(latestReports);
    });
  }

  // Realtime updates
  supabase
    .channel('public:reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports_paracuru' }, payload => {
      console.log('Change received!', payload);
      loadDashboard();
      
      // Se o modal estiver aberto e for do mesmo chamado, atualiza o chat e o status
      // sem fechar o modal ou perder o texto que o servidor está digitando
      if (currentReportId && payload.new && payload.new.id === currentReportId) {
        const modal = document.getElementById('detailsModal');
        if (modal && modal.style.display === 'flex') {
          // Atualiza o status visualmente
          const statusEl = document.getElementById('modalStatus');
          if (statusEl) {
            statusEl.textContent = payload.new.status;
            statusEl.className = `status-badge status-${payload.new.status.replace(' ', '').toLowerCase()}`;
          }
          
          // Atualiza o chat
          if (typeof window.renderChat === 'function') {
            window.renderChat(payload.new.chat_history || []);
          }
        }
      }
    })
    .subscribe();

  // PWA Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('SW registrado no painel', reg))
      .catch(err => console.log('SW erro', err));
  }

  // --- Agenda do Secretário Logic ---
  const btnManageAgenda = document.getElementById('btnManageAgenda');
  const agendaModal = document.getElementById('agendaModal');
  const closeAgendaModal = document.getElementById('closeAgendaModal');
  const viewAgendamentosModal = document.getElementById('viewAgendamentosModal');
  const closeViewAgendamentosModal = document.getElementById('closeViewAgendamentosModal');
  
  if (session && session.email === 'admin@paracuru.ce.gov.br') {
    // if (btnManageAgenda) btnManageAgenda.style.display = 'inline-block';
  }

  if (btnManageAgenda) {
    btnManageAgenda.addEventListener('click', () => {
      agendaModal.style.display = 'flex';
      loadAgendasAdmin();
    });
  }

  if (closeAgendaModal) {
    closeAgendaModal.addEventListener('click', () => {
      agendaModal.style.display = 'none';
    });
  }
  
  if (closeViewAgendamentosModal) {
    closeViewAgendamentosModal.addEventListener('click', () => {
      viewAgendamentosModal.style.display = 'none';
    });
  }

  const btnAddAgenda = document.getElementById('btnAddAgenda');
  if (btnAddAgenda) {
    btnAddAgenda.addEventListener('click', async () => {
      const dataStr = document.getElementById('newAgendaDate').value;
      const horariosStr = document.getElementById('newAgendaHorarios').value.trim();

      if (!dataStr || !horariosStr) {
        alert('Preencha a data e os horários!');
        return;
      }

      // Calculate vagas from comma separated string
      const horariosArr = horariosStr.split(',').map(h => h.trim()).filter(h => h);
      const vagas = horariosArr.length;

      if (vagas === 0) {
        alert('Adicione pelo menos um horário válido.');
        return;
      }

      const { error } = await supabase.from('agendas_secretario').insert([{
        data: dataStr,
        vagas_totais: vagas,
        horarios: horariosStr,
        vagas_ocupadas: 0
      }]);

      if (error) {
        alert('Erro ao criar agenda. Certifique-se de ter rodado o script SQL.');
        console.error(error);
      } else {
        document.getElementById('newAgendaDate').value = '';
        document.getElementById('newAgendaHorarios').value = '';
        loadAgendasAdmin();
      }
    });
  }

  async function loadAgendasAdmin() {
    const listEl = document.getElementById('agendaList');
    listEl.innerHTML = '<p style="color:var(--text-muted);">Carregando...</p>';

    const { data, error } = await supabase
      .from('agendas_secretario')
      .select('*')
      .order('data', { ascending: true });

    if (error) {
      listEl.innerHTML = '<p style="color:var(--danger);">Erro ao carregar agendas.</p>';
      return;
    }

    if (!data || data.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted);">Nenhuma data configurada.</p>';
      return;
    }

    listEl.innerHTML = '';
    data.forEach(item => {
      let dStr = item.data;
      if(dStr.includes('T')) dStr = dStr.split('T')[0];
      const parts = dStr.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

      const div = document.createElement('div');
      div.style.padding = '1rem';
      div.style.background = 'var(--bg-main)';
      div.style.borderRadius = '8px';
      div.style.border = '1px solid var(--border)';
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <h4 style="color: var(--text);">${formattedDate}</h4>
          <span style="background: var(--primary); color: white; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem;">
            ${item.vagas_ocupadas} / ${item.vagas_totais} vagas
          </span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;"><b>Horários:</b> ${item.horarios || 'Não definido'}</p>
        <button class="btn btn-secondary btn-view-inscritos" data-id="${item.id}" data-date="${formattedDate}" style="width: 100%; font-size: 0.9rem; padding: 0.5rem;">Ver Inscritos</button>
      `;
      listEl.appendChild(div);
    });

    document.querySelectorAll('.btn-view-inscritos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const dateStr = e.target.getAttribute('data-date');
        showInscritos(id, dateStr);
      });
    });
  }

  async function showInscritos(agendaId, dateStr) {
    document.getElementById('viewAgendamentosSubtitle').textContent = `Data: ${dateStr}`;
    const inscritosList = document.getElementById('inscritosList');
    inscritosList.innerHTML = '<p style="color:var(--text-muted);">Carregando inscritos...</p>';
    viewAgendamentosModal.style.display = 'flex';

    // Fetch agendamentos
    const { data: agendamentos, error: errAgendamentos } = await supabase
      .from('agendamentos_cidadao')
      .select('*')
      .eq('agenda_id', agendaId);

    if (errAgendamentos) {
      inscritosList.innerHTML = '<p style="color:var(--danger);">Erro ao buscar inscritos.</p>';
      return;
    }

    if (!agendamentos || agendamentos.length === 0) {
      inscritosList.innerHTML = '<p style="color:var(--text-muted);">Nenhum cidadão agendado para esta data.</p>';
      return;
    }

    // Fetch citizens details
    const userIds = agendamentos.map(a => a.user_id);
    const { data: profiles, error: errProfiles } = await supabase
      .from('profiles')
      .select('id, nome_completo, whatsapp')
      .in('id', userIds);

    const profilesMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    inscritosList.innerHTML = '';
    agendamentos.forEach(ag => {
      const p = profilesMap[ag.user_id] || { nome_completo: 'Desconhecido', whatsapp: 'N/A' };
      const li = document.createElement('li');
      li.style.padding = '0.8rem';
      li.style.border = '1px solid var(--border)';
      li.style.borderRadius = '8px';
      li.style.background = 'var(--bg-main)';
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-weight: bold; color: var(--text);">${p.nome_completo}</div>
          <span style="background: var(--primary); color: white; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">
            ⏱️ ${ag.horario_escolhido || 'Não escolhido'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">WhatsApp: ${p.whatsapp}</div>
        <div style="font-size: 0.9rem; color: var(--text); background: rgba(0,0,0,0.05); padding: 0.5rem; border-radius: 4px;">
          <b>Pauta:</b> ${ag.pauta || 'Nenhuma pauta informada'}
        </div>
      `;
      inscritosList.appendChild(li);
    });
  }

  // Init
  initMap();
  setTimeout(loadDashboard, 100); // slight delay to ensure container width for charts
});

