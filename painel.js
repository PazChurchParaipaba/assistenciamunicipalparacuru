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

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="position: relative; cursor: pointer;" data-action="view-details" data-id="${report.id}" title="Clique para ver detalhes">
          ${cardImgHtml}
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
            <span style="color: white; font-weight: bold; background: rgba(0,0,0,0.6); padding: 0.5rem 1rem; border-radius: 99px;">Ver Detalhes</span>
          </div>
        </div>
        <div class="card-content">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>${tipoBadge}<br><span class="status-badge ${statusClass}" style="margin-bottom:0;">${report.status}</span></div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${date}</span>
          </div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${report.title}</h3>
          <p style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.5rem; font-weight: 500;">
            📍 ${report.endereco || 'Endereço não informado'} ${report.bairro ? ' - ' + report.bairro : ''}
          </p>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
            <b>${report.secretaria}</b> ${report.subcategory ? `> ${report.subcategory}` : ''}<br>
            ${report.description}
          </p>
          
          <div class="card-actions">
            <select class="status-update" data-id="${report.id}">
              <option value="Aberto" ${report.status === 'Aberto' ? 'selected' : ''}>Aberto</option>
              <option value="Em Andamento" ${report.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
              <option value="Resolvido" ${report.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
            </select>
          </div>
        </div>
      `;
      reportsGrid.appendChild(card);
    });

    // Add event listeners to new selects
    document.querySelectorAll('.status-update').forEach(select => {
      select.addEventListener('change', (e) => {
        updateStatus(e.target.getAttribute('data-id'), e.target.value);
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
    statusEl.style.background = `${statusColor}20`;
    statusEl.style.color = statusColor;

    document.getElementById('modalMeta').textContent = `${new Date(report.created_at).toLocaleDateString('pt-BR')} - ${report.secretaria}`;
    const subEl = document.getElementById('modalSubcategory');
    if (subEl) subEl.textContent = report.subcategory ? `> ${report.subcategory}` : '';

    const modalPhoto = document.getElementById('modalPhoto');
    if (report.photo) {
      modalPhoto.src = report.photo;
      modalPhoto.style.display = 'block';
    } else {
      modalPhoto.style.display = 'none';
    }
    
    document.getElementById('modalDescription').textContent = report.description;
    document.getElementById('modalLocationText').textContent = `${report.endereco || 'Rua não informada'}, ${report.bairro || 'Bairro não informado'}`;
    document.getElementById('modalLocation').textContent = `Coordenadas: Lat ${report.location_lat.toFixed(5)}, Lng ${report.location_lng.toFixed(5)}`;
    
    document.getElementById('modalResponsavel').value = report.responsavel || '';
    document.getElementById('modalNotas').value = report.notas_internas || '';
    
    if (typeof window.renderChat === 'function') {
      window.renderChat(report.chat_history || []);
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

  // Lógica do Chat
  const btnSendChat = document.getElementById('btnSendChat');
  const chatInput = document.getElementById('chatInput');

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

  // Clear Data
  btnClear.addEventListener('click', async () => {
    if(confirm('Isso apagará TODOS os dados do sistema. Tem certeza?')) {
      const { error } = await supabase
        .from('reports_paracuru')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      if (error) {
         console.error('Erro ao limpar dados:', error);
      } else {
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
    })
    .subscribe();

  // PWA Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('SW registrado no painel', reg))
      .catch(err => console.log('SW erro', err));
  }

  // Init
  initMap();
  setTimeout(loadDashboard, 100); // slight delay to ensure container width for charts
});

