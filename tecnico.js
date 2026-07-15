import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Autenticação: Verificar se está logado e se é tecnico
  const sessionData = localStorage.getItem('tecnicoSession');
  if (!sessionData) {
    window.location.href = 'login_servidor.html';
    return;
  }
  const session = JSON.parse(sessionData);
  if (session.perfil !== 'tecnico') {
    window.location.href = 'painel.html'; // Redireciona admins para o painel completo se tentar acessar com perfil admin
    return;
  }

  document.getElementById('techNameTitle').textContent = `Olá, ${session.nome.split(' ')[0]}`;

  // Lógica de Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('tecnicoSession');
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
        <div class="task-address">📍 ${task.endereco ? task.endereco + ' - ' : ''}${task.bairro || 'Localização não informada'}</div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn-resolve" data-id="${task.id}" style="flex: 2;">Concluir</button>
          <button class="btn-chat" data-id="${task.id}" style="flex: 1; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative;">
            💬 Chat
            ${task.chat_history && task.chat_history.length > 0 && task.chat_history[task.chat_history.length - 1].sender === 'cidadao' ? '<span style="position: absolute; top: -5px; right: -5px; background: var(--danger); width: 12px; height: 12px; border-radius: 50%;"></span>' : ''}
          </button>
        </div>
      `;

      const btnResolve = card.querySelector('.btn-resolve');
      btnResolve.addEventListener('click', () => {
        openResolveModal(task);
      });

      const btnChat = card.querySelector('.btn-chat');
      btnChat.addEventListener('click', () => {
        openTechChat(task);
      });

      tasksList.appendChild(card);
    });
  }

  loadTasks();
  setupTechRealtime();

  function setupTechRealtime() {
    supabase.channel('public:reports_paracuru:tecnico:' + session.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports_paracuru', filter: `tecnico_id=eq.${session.id}` }, (payload) => {
        if (payload.new) {
          const taskIndex = myTasks.findIndex(t => t.id === payload.new.id);
          if (taskIndex !== -1) {
            myTasks[taskIndex] = payload.new;
          } else if (payload.new.status !== 'Resolvido') {
            myTasks.unshift(payload.new);
          }
          renderTasks();
          
          if (chatModal && chatModal.style.display === 'flex' && currentChatTaskId === payload.new.id) {
            renderTechChat(payload.new.chat_history || []);
          }
        }
      })
      .subscribe();
  }

  // --- MODO VALIDAÇÃO IA E CÂMERA ---
  const resolveModal = document.getElementById('resolve-modal');
  const resolveVideo = document.getElementById('resolve-video');
  const resolveCanvas = document.getElementById('resolve-canvas');
  const resolvePreview = document.getElementById('resolve-preview');
  const btnTakePhoto = document.getElementById('btn-take-photo');
  const btnSendValidation = document.getElementById('btn-send-validation');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const btnCloseResolve = document.getElementById('btn-close-resolve');
  const resolveStatusText = document.getElementById('resolve-status-text');

  let resolveStream = null;
  let currentResolveTask = null;
  let currentPhotoBase64 = null;
  let techLat = null;
  let techLon = null;

  function openResolveModal(task) {
    currentResolveTask = task;
    resolveModal.style.display = 'flex';
    resetResolveUI();
    startResolveCamera();
    
    // Pegar GPS do técnico
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          techLat = pos.coords.latitude;
          techLon = pos.coords.longitude;
        },
        (err) => {
          console.warn("GPS Indisponível", err);
          techLat = null;
          techLon = null;
        },
        { enableHighAccuracy: true }
      );
    }
  }

  function resetResolveUI() {
    resolveVideo.style.display = 'block';
    resolvePreview.style.display = 'none';
    btnTakePhoto.style.display = 'block';
    btnSendValidation.style.display = 'none';
    btnRetakePhoto.style.display = 'none';
    resolveStatusText.textContent = `Resolvendo: ${currentResolveTask.tipo}`;
    currentPhotoBase64 = null;
  }

  async function startResolveCamera() {
    try {
      resolveStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      resolveVideo.srcObject = resolveStream;
    } catch (err) {
      resolveStatusText.textContent = 'Erro ao abrir câmera: ' + err.message;
    }
  }

  function stopResolveCamera() {
    if (resolveStream) {
      resolveStream.getTracks().forEach(t => t.stop());
      resolveStream = null;
    }
  }

  btnTakePhoto.addEventListener('click', () => {
    resolveCanvas.width = resolveVideo.videoWidth;
    resolveCanvas.height = resolveVideo.videoHeight;
    resolveCanvas.getContext('2d').drawImage(resolveVideo, 0, 0);
    
    currentPhotoBase64 = resolveCanvas.toDataURL('image/jpeg');
    resolvePreview.src = currentPhotoBase64;
    
    resolveVideo.style.display = 'none';
    resolvePreview.style.display = 'block';
    
    btnTakePhoto.style.display = 'none';
    btnSendValidation.style.display = 'block';
    btnRetakePhoto.style.display = 'block';
  });

  btnRetakePhoto.addEventListener('click', resetResolveUI);

  btnCloseResolve.addEventListener('click', () => {
    stopResolveCamera();
    resolveModal.style.display = 'none';
  });

  btnSendValidation.addEventListener('click', async () => {
    // Validação de GPS (Geofence)
    if (currentResolveTask.latitude && currentResolveTask.longitude && techLat && techLon) {
      const dist = getDistance(techLat, techLon, currentResolveTask.latitude, currentResolveTask.longitude);
      if (dist > 150) { // 150 metros de tolerância
        alert(`❌ Você está muito longe do local do problema (${Math.round(dist)}m de distância). Aproxime-se do local para validar a resolução.`);
        return;
      }
    } else if (currentResolveTask.latitude && (!techLat)) {
       alert(`⚠️ Não foi possível obter sua localização atual via GPS. Ative a localização para continuar.`);
       return;
    }

    btnSendValidation.textContent = 'Analisando IA...';
    btnSendValidation.disabled = true;
    resolveStatusText.textContent = 'A Inteligência Artificial está analisando sua foto...';

    try {
      // Enviar para Edge Function
      const { data, error } = await supabase.functions.invoke('ai_valida_solucao', {
        body: {
          base64Image: currentPhotoBase64,
          description: `${currentResolveTask.tipo} - ${currentResolveTask.descricao || 'Sem descrição'}. Local: ${currentResolveTask.endereco || 'Endereço não informado'} - ${currentResolveTask.bairro || ''}`
        }
      });

      if (error) throw new Error(error.message);

      if (data && data.valida === true) {
        // IA Aprovou! Atualizar status no banco
        resolveStatusText.textContent = '✅ IA Aprovou! Fechando chamado...';
        
        const { error: updateError } = await supabase
          .from('reports_paracuru')
          .update({ status: 'Resolvido' })
          .eq('id', currentResolveTask.id);
          
        if (updateError) throw new Error(updateError.message);

        alert("Sucesso! O chamado foi marcado como resolvido.");
        stopResolveCamera();
        resolveModal.style.display = 'none';
        loadTasks();
      } else {
        // IA Reprovou
        alert(`❌ A IA recusou a foto.\nMotivo: ${data.motivo || 'Foto não corresponde à resolução.'}`);
        btnSendValidation.textContent = '✅ Enviar IA';
        btnSendValidation.disabled = false;
        resolveStatusText.textContent = 'Por favor, tire uma nova foto mais nítida do problema resolvido.';
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao validar com IA: ' + err.message);
      btnSendValidation.textContent = '✅ Enviar IA';
      btnSendValidation.disabled = false;
    }
  });

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
    
const translationMap = {
      'person': 'pessoa', 'bicycle': 'bicicleta', 'car': 'carro', 'motorcycle': 'moto',
      'airplane': 'avião', 'bus': 'ônibus', 'train': 'trem', 'truck': 'caminhão',
      'boat': 'barco', 'traffic light': 'semáforo', 'fire hydrant': 'hidrante', 'stop sign': 'placa de pare',
      'bench': 'banco', 'bird': 'pássaro', 'cat': 'gato', 'dog': 'cachorro',
      'horse': 'cavalo', 'sheep': 'ovelha', 'cow': 'vaca', 'elephant': 'elefante',
      'bear': 'urso', 'zebra': 'zebra', 'giraffe': 'girafa', 'backpack': 'mochila',
      'umbrella': 'guarda-chuva', 'handbag': 'bolsa', 'tie': 'gravata', 'suitcase': 'mala',
      'frisbee': 'frisbee', 'skis': 'esquis', 'snowboard': 'snowboard', 'sports ball': 'bola esportiva',
      'kite': 'pipa', 'baseball bat': 'taco', 'baseball glove': 'luva', 'skateboard': 'skate',
      'surfboard': 'prancha', 'tennis racket': 'raquete', 'bottle': 'garrafa', 'wine glass': 'taça',
      'cup': 'copo', 'fork': 'garfo', 'knife': 'faca', 'spoon': 'colher',
      'bowl': 'tigela', 'banana': 'banana', 'apple': 'maçã', 'sandwich': 'sanduíche',
      'orange': 'laranja', 'broccoli': 'brócolis', 'carrot': 'cenoura', 'hot dog': 'cachorro-quente',
      'pizza': 'pizza', 'donut': 'donut', 'cake': 'bolo', 'chair': 'cadeira',
      'couch': 'sofá', 'potted plant': 'planta', 'bed': 'cama', 'dining table': 'mesa',
      'toilet': 'vaso sanitário', 'tv': 'tv', 'laptop': 'laptop', 'mouse': 'mouse',
      'remote': 'controle', 'keyboard': 'teclado', 'cell phone': 'celular', 'microwave': 'microondas',
      'oven': 'forno', 'toaster': 'torradeira', 'sink': 'pia', 'refrigerator': 'geladeira',
      'book': 'livro', 'clock': 'relógio', 'vase': 'vaso', 'scissors': 'tesoura',
      'teddy bear': 'urso de pelúcia', 'hair drier': 'secador', 'toothbrush': 'escova de dentes'
    };
    
    try {
      const predictions = await arModel.detect(arVideo);
      const ignoredClasses = ['stop sign', 'frisbee', 'sports ball', 'kite', 'clock', 'vase'];
      
      predictions.forEach(pred => {
        if (ignoredClasses.includes(pred.class)) return; // Ignora os falsos positivos
        
        if (pred.score > 0.5) {
          const [x, y, width, height] = pred.bbox;
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#00FFFF';
          ctx.font = '16px Arial';
          
          const label = translationMap[pred.class] || pred.class;
          ctx.fillText(`${label} (${Math.round(pred.score * 100)}%)`, x, y > 20 ? y - 5 : 15);
        }
      });
      drawARMarkers(ctx);
    } catch (e) {
      console.warn("IA frame skip", e);
    }
    arAnimationId = requestAnimationFrame(detectFrame);
  }

  // --- LÓGICA DO CHAT COM O CIDADÃO ---
  let chatModal = document.getElementById('tech-chat-modal');
  let chatContainer, chatInput, btnSendChat, closeChat;

  function initChatUI() {
    if (!document.getElementById('tech-chat-modal')) {
      chatModal = document.createElement('div');
      chatModal.id = 'tech-chat-modal';
      chatModal.className = 'modal-overlay';
      chatModal.style = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 10002; align-items: center; justify-content: center; padding: 1rem;';
      chatModal.innerHTML = `
        <div style="background: var(--card-bg, #fff); width: 100%; max-width: 500px; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-color, #ccc);">
          <div style="padding: 1rem; border-bottom: 1px solid var(--border-color, #ccc); display: flex; justify-content: space-between; align-items: center; background: var(--bg-main, #f9f9f9);">
            <h3 style="margin: 0; color: var(--primary, #3b82f6);">💬 Chat com o Cidadão</h3>
            <button id="close-tech-chat" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted, #6b7280); cursor: pointer;">&times;</button>
          </div>
          <div id="tech-chat-container" style="padding: 1rem; flex: 1; min-height: 300px; max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; background: var(--bg-color, #f3f4f6);">
          </div>
          <div style="padding: 1rem; border-top: 1px solid var(--border-color, #ccc); display: flex; gap: 0.5rem; background: var(--card-bg, #fff);">
            <input type="text" id="tech-chat-input" placeholder="Digite sua mensagem..." style="flex: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border-color, #ccc); background: var(--bg-main, #f9f9f9); color: var(--text-main, #000);">
            <button id="btn-tech-send-chat" class="btn btn-primary" style="padding: 0 1rem; width: auto; font-weight: bold;">Enviar</button>
          </div>
        </div>
      `;
      document.body.appendChild(chatModal);
    } else {
      chatModal = document.getElementById('tech-chat-modal');
    }

    chatContainer = document.getElementById('tech-chat-container');
    chatInput = document.getElementById('tech-chat-input');
    btnSendChat = document.getElementById('btn-tech-send-chat');
    closeChat = document.getElementById('close-tech-chat');

    closeChat.addEventListener('click', () => {
      chatModal.style.display = 'none';
      currentChatTaskId = null;
    });

    btnSendChat.addEventListener('click', async () => {
      const text = chatInput.value.trim();
      if (!text || !currentChatTaskId) return;

      const taskIndex = myTasks.findIndex(t => t.id === currentChatTaskId);
      if (taskIndex === -1) return;
      const task = myTasks[taskIndex];

      const newMsg = {
        sender: 'tecnico',
        senderName: session.nome || 'Técnico',
        text: text,
        date: new Date().toISOString()
      };

      const chatHistory = task.chat_history ? [...task.chat_history] : [];
      chatHistory.push(newMsg);

      btnSendChat.disabled = true;
      btnSendChat.textContent = 'Enviando...';

      const { error } = await supabase
        .from('reports_paracuru')
        .update({ chat_history: chatHistory })
        .eq('id', currentChatTaskId);
      
      btnSendChat.disabled = false;
      btnSendChat.textContent = 'Enviar';

      if (error) {
        alert('Erro ao enviar mensagem');
      } else {
        chatInput.value = '';
        task.chat_history = chatHistory;
        renderTechChat(chatHistory);
        renderTasks(); 
      }
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnSendChat.click();
      }
    });
  }

  let currentChatTaskId = null;

  function openTechChat(task) {
    if (!chatModal || !chatContainer) {
      initChatUI();
    }
    currentChatTaskId = task.id;
    renderTechChat(task.chat_history || []);
    chatModal.style.display = 'flex';
  }

  function renderTechChat(chatHistory) {
    chatContainer.innerHTML = '';
    if (!chatHistory || chatHistory.length === 0) {
      chatContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Nenhuma mensagem. Inicie uma conversa com o cidadão!</p>';
      return;
    }

    chatHistory.forEach(msg => {
      const isTech = msg.sender === 'tecnico' || msg.sender === 'secretaria';
      const align = isTech ? 'flex-end' : 'flex-start';
      const bg = isTech ? 'var(--primary)' : 'var(--card-bg, #fff)';
      const color = isTech ? 'white' : 'var(--text-main)';
      const border = isTech ? 'none' : '1px solid var(--border-color, #ccc)';
      const d = new Date(msg.date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      
      let senderName = msg.senderName || 'Cidadão';
      if (!msg.senderName) {
        if (msg.sender === 'tecnico') senderName = 'Você (Técnico)';
        else if (msg.sender === 'secretaria') senderName = 'Secretaria';
      } else if (msg.sender === 'tecnico') {
        senderName = 'Você (' + msg.senderName + ')';
      }

      chatContainer.innerHTML += `
        <div style="align-self: ${align}; background: ${bg}; color: ${color}; border: ${border}; padding: 0.6rem 1rem; border-radius: 12px; max-width: 85%; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.2rem; font-weight: bold;">${senderName} • ${d}</div>
          <div style="font-size: 0.95rem; line-height: 1.4;">${msg.text}</div>
        </div>
      `;
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
