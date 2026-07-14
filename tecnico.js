import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Autenticação: Verificar se está logado e se é tecnico
  const sessionData = localStorage.getItem('servidorSession');
  if (!sessionData) {
    window.location.href = 'login_servidor.html';
    return;
  }
  const session = JSON.parse(sessionData);
  if (session.perfil !== 'tecnico') {
    window.location.href = 'painel.html'; // Redireciona admins para o painel completo
    return;
  }

  document.getElementById('techNameTitle').textContent = `Olá, ${session.nome.split(' ')[0]}`;

  // Lógica de Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
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
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', () => {
    isDark = htmlEl.getAttribute('data-theme') === 'dark';
    htmlEl.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  // Lista de Chamados do Técnico
  const tasksList = document.getElementById('tasksList');
  let myTasks = [];

  async function loadTasks() {
    tasksList.innerHTML = '<p style="text-align: center;">Carregando...</p>';
    
    // Busca chamados atribuídos a este técnico que não estejam resolvidos
    const { data, error } = await supabase
      .from('reports_paracuru')
      .select('*')
      .eq('tecnico_id', session.id)
      .neq('status', 'Resolvido')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      tasksList.innerHTML = '<p style="color: red;">Erro ao carregar tarefas.</p>';
      return;
    }

    myTasks = data || [];
    renderTasks();
  }

  function renderTasks() {
    if (myTasks.length === 0) {
      tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Nenhuma tarefa atribuída no momento. Bom descanso!</p>';
      return;
    }

    tasksList.innerHTML = '';
    myTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      
      card.innerHTML = `
        <div class="task-header">
          <span class="task-type">${task.tipo || 'Problema'}</span>
          <span class="task-status">${task.status}</span>
        </div>
        <p style="margin-bottom: 0.5rem;">${task.descricao || 'Sem descrição'}</p>
        <div class="task-address">📍 ${task.bairro || 'Localização não informada'}</div>
        <button class="btn-resolve" data-id="${task.id}">Marcar como Resolvido</button>
      `;

      const btnResolve = card.querySelector('.btn-resolve');
      btnResolve.addEventListener('click', async () => {
        btnResolve.textContent = 'Atualizando...';
        btnResolve.disabled = true;
        
        const { error } = await supabase
          .from('reports_paracuru')
          .update({ status: 'Resolvido' })
          .eq('id', task.id);
          
        if (error) {
          alert('Erro ao atualizar: ' + error.message);
          btnResolve.textContent = 'Marcar como Resolvido';
          btnResolve.disabled = false;
        } else {
          loadTasks(); // recarrega a lista
        }
      });

      tasksList.appendChild(card);
    });
  }

  loadTasks();

  // --- MODO INSPEÇÃO AR ---
  // Mesma lógica construída no painel.js, mas operando com a lista myTasks
  const btnARMode = document.getElementById('btnARMode');
  const arContainer = document.getElementById('ar-container');
  const arVideo = document.getElementById('ar-video');
  const arCanvas = document.getElementById('ar-canvas');
  const arBtnClose = document.getElementById('ar-btn-close');
  const arStatusText = document.getElementById('ar-status-text');
  
  let arStream = null;
  let arModel = null;
  let arAnimationId = null;
  let arWatchId = null;
  let arCurrentLat = null;
  let arCurrentLon = null;
  let arCurrentHeading = 0;
  
  if (btnARMode) {
    btnARMode.addEventListener('click', async () => {
      arContainer.style.display = 'block';
      arStatusText.textContent = 'Solicitando Câmera e GPS...';
      
      try {
        arStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        arVideo.srcObject = arStream;
        
        if (navigator.geolocation) {
          arWatchId = navigator.geolocation.watchPosition((pos) => {
            arCurrentLat = pos.coords.latitude;
            arCurrentLon = pos.coords.longitude;
          }, (err) => {
            console.error('Erro de GPS', err);
            arStatusText.textContent = 'Erro de GPS. Verifique permissões.';
          }, { enableHighAccuracy: true });
        }
        
        window.addEventListener('deviceorientation', handleOrientation, true);
        arStatusText.textContent = 'Carregando IA (COCO-SSD)...';
        
        if (!arModel && window.cocoSsd) {
          arModel = await cocoSsd.load();
        }
        
        arStatusText.textContent = 'Modo AR Ativo! Apontando câmera...';
        
        arVideo.onloadedmetadata = () => {
          arCanvas.width = arVideo.videoWidth;
          arCanvas.height = arVideo.videoHeight;
          detectFrame();
        };
        
      } catch (err) {
        console.error('Erro ao iniciar AR', err);
        arStatusText.textContent = 'Erro ao iniciar AR: ' + err.message;
      }
    });
  }
  
  if (arBtnClose) {
    arBtnClose.addEventListener('click', stopARMode);
  }
  
  function stopARMode() {
    arContainer.style.display = 'none';
    if (arStream) {
      arStream.getTracks().forEach(t => t.stop());
      arStream = null;
    }
    if (arAnimationId) {
      cancelAnimationFrame(arAnimationId);
    }
    if (arWatchId) {
      navigator.geolocation.clearWatch(arWatchId);
    }
    window.removeEventListener('deviceorientation', handleOrientation, true);
  }
  
  function handleOrientation(event) {
    let heading = event.alpha;
    if (event.webkitCompassHeading) {
      heading = event.webkitCompassHeading;
    } else if (heading !== null) {
      heading = 360 - heading; 
    }
    arCurrentHeading = heading || 0;
  }
  
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  function getBearing(startLat, startLng, destLat, destLng) {
    startLat = startLat * Math.PI / 180;
    startLng = startLng * Math.PI / 180;
    destLat = destLat * Math.PI / 180;
    destLng = destLng * Math.PI / 180;
    
    let y = Math.sin(destLng - startLng) * Math.cos(destLat);
    let x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }
  
  function drawARMarkers(ctx) {
    document.querySelectorAll('.ar-marker').forEach(el => el.remove());
    if (!arCurrentLat || !arCurrentLon) return;
    
    const uiContainer = document.getElementById('ar-ui');
    
    // O técnico só vê os pinos das TAREFAS DELE
    myTasks.forEach(report => {
      if (report.latitude && report.longitude) {
        const dist = getDistance(arCurrentLat, arCurrentLon, report.latitude, report.longitude);
        if (dist < 1000) {
          const bearing = getBearing(arCurrentLat, arCurrentLon, report.latitude, report.longitude);
          
          let angleDiff = bearing - arCurrentHeading;
          if (angleDiff < -180) angleDiff += 360;
          if (angleDiff > 180) angleDiff -= 360;
          
          if (Math.abs(angleDiff) < 45) {
            const screenX = 50 + (angleDiff / 45) * 50; 
            
            const markerEl = document.createElement('div');
            markerEl.className = 'ar-marker';
            markerEl.textContent = `${report.tipo || 'Tarefa'} (${Math.round(dist)}m)`;
            markerEl.style.left = `${screenX}%`;
            markerEl.style.top = `${50 + (dist / 1000) * 20}%`;
            
            uiContainer.appendChild(markerEl);
          }
        }
      }
    });
  }
  
  async function detectFrame() {
    if (!arModel || arContainer.style.display === 'none') return;
    
    arCanvas.width = arVideo.videoWidth;
    arCanvas.height = arVideo.videoHeight;
    const ctx = arCanvas.getContext('2d');
    ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
    
    try {
      const predictions = await arModel.detect(arVideo);
      predictions.forEach(pred => {
        if (pred.score > 0.5) {
          const [x, y, width, height] = pred.bbox;
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#00FFFF';
          ctx.font = '16px Arial';
          ctx.fillText(`${pred.class} (${Math.round(pred.score * 100)}%)`, x, y > 20 ? y - 5 : 15);
        }
      });
      drawARMarkers(ctx);
    } catch (e) {
      console.warn("IA frame skip", e);
    }
    arAnimationId = requestAnimationFrame(detectFrame);
  }
});
