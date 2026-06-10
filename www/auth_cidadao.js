import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const authContainer = document.getElementById('authContainer');
  const LocalNotifications = window.Capacitor ? window.Capacitor.Plugins.LocalNotifications : null;

  if (LocalNotifications) {
    LocalNotifications.requestPermissions();
  }

  async function renderAuthStatus() {
    const sessionData = localStorage.getItem('cidadaoSession');
    const session = sessionData ? JSON.parse(sessionData) : null;
    
    if (session) {
      authContainer.innerHTML = `
        <button id="btnMeusRelatos" style="background:none; border:none; color: var(--primary); cursor:pointer; font-weight:bold; margin-right: 15px;">Meus Relatos</button>
        <span style="color: var(--text-muted); margin-right: 10px;">${session.nome || session.whatsapp}</span>
        <button id="btnSairCidadao" style="background:none; border:none; color: var(--danger); cursor:pointer; font-weight:bold;">Sair</button>
      `;
      document.getElementById('btnSairCidadao').addEventListener('click', () => {
        localStorage.removeItem('cidadaoSession');
        renderAuthStatus();
      });
      document.getElementById('btnMeusRelatos').addEventListener('click', () => {
        showMeusRelatosModal(session.id);
      });
      // Show form when logged in
      const wizardForm = document.getElementById('wizardForm');
      const stepper = document.getElementById('stepperIndicator');
      if (wizardForm) wizardForm.style.display = 'block';
      if (stepper) stepper.style.display = 'flex';
      
      setupCitizenRealtime(session.id);
    } else {
      authContainer.innerHTML = `
        <button id="btnEntrarCidadao" style="background:none; border:none; color: var(--primary); cursor:pointer; font-weight:bold;">Entrar / Cadastrar</button>
      `;
      document.getElementById('btnEntrarCidadao').addEventListener('click', () => {
        showAuthModal();
      });
      // Hide form if not logged in
      const wizardForm = document.getElementById('wizardForm');
      const stepper = document.getElementById('stepperIndicator');
      if (wizardForm) wizardForm.style.display = 'none';
      if (stepper) stepper.style.display = 'none';
      
      // Auto show modal
      showAuthModal();
    }
  }

  function showAuthModal() {
    if (document.getElementById('authModal')) return;
    
    const modalHtml = `
      <div id="authModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeIn 0.3s ease;">
        <div style="background: var(--card-bg); padding: 2.5rem; border-radius: 24px; width: 90%; max-width: 420px; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid var(--border-color); backdrop-filter: blur(12px); animation: slideUp 0.4s ease-out;">
          <h2 id="authModalTitle" style="margin-bottom: 0.5rem; color: var(--primary); font-size: 1.8rem; font-weight: 700; text-align: center;">Acesso Obrigatório</h2>
          <p id="authModalDesc" style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 2rem; text-align: center;">Faça o login para enviar e acompanhar relatos.</p>
          
          <div id="authModalError" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 0.75rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); display: none;"></div>

          <div id="groupNome" class="form-group" style="margin-bottom: 1.2rem; display: flex; flex-direction: column;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Nome Completo</label>
            <input type="text" id="authNome" placeholder="João da Silva" style="width: 100%; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: 12px; box-sizing: border-box; background: transparent; color: var(--text-main); font-size: 1rem; transition: border-color 0.3s;">
          </div>
          
          <div id="groupWhatsapp" class="form-group" style="margin-bottom: 1.2rem; display: none; flex-direction: column;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">WhatsApp</label>
            <input type="tel" id="authWhatsapp" placeholder="(85) 90000-0000" style="width: 100%; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: 12px; box-sizing: border-box; background: transparent; color: var(--text-main); font-size: 1rem; transition: border-color 0.3s;">
          </div>

          <div class="form-group" style="margin-bottom: 2rem; display: flex; flex-direction: column;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Senha</label>
            <input type="password" id="authPassword" placeholder="••••••••" style="width: 100%; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: 12px; box-sizing: border-box; background: transparent; color: var(--text-main); font-size: 1rem; transition: border-color 0.3s;">
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            <button id="btnSubmitAuth" class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem;">Entrar</button>
            <div style="text-align: center; margin-top: 0.5rem;">
              <a href="#" id="toggleAuthMode" style="color: var(--primary); text-decoration: none; font-size: 0.95rem; font-weight: 600;">Não tem conta? Cadastre-se</a>
            </div>
          </div>
          
          <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            #authModal input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
          </style>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeModal = () => document.getElementById('authModal').remove();

    let isLoginMode = true;
    const nomeInput = document.getElementById('authNome');
    const whatsappInput = document.getElementById('authWhatsapp');
    const passInput = document.getElementById('authPassword');
    const errorDiv = document.getElementById('authModalError');
    const groupNome = document.getElementById('groupNome');
    const groupWhatsapp = document.getElementById('groupWhatsapp');
    const btnSubmit = document.getElementById('btnSubmitAuth');
    const toggleLink = document.getElementById('toggleAuthMode');
    const title = document.getElementById('authModalTitle');
    const desc = document.getElementById('authModalDesc');

    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      errorDiv.style.display = 'none';
      
      if(isLoginMode) {
        groupWhatsapp.style.display = 'none';
        title.textContent = 'Acesso Obrigatório';
        desc.textContent = 'Faça o login para enviar e acompanhar relatos.';
        btnSubmit.textContent = 'Entrar';
        toggleLink.textContent = 'Não tem conta? Cadastre-se';
      } else {
        groupWhatsapp.style.display = 'flex';
        title.textContent = 'Criar Conta';
        desc.textContent = 'Cadastre-se gratuitamente para ajudar sua cidade.';
        btnSubmit.textContent = 'Cadastrar';
        toggleLink.textContent = 'Já tem conta? Entrar';
      }
    });

    btnSubmit.addEventListener('click', async () => {
      errorDiv.style.display = 'none';
      const whatsapp = whatsappInput.value.trim();
      const password = passInput.value.trim();
      const nome = nomeInput.value.trim();

      if (!nome || !password || (!isLoginMode && !whatsapp)) {
        errorDiv.textContent = 'Erro: Preencha todos os campos obrigatórios.';
        errorDiv.style.display = 'block';
        return;
      }

      btnSubmit.textContent = 'Aguarde...';
      btnSubmit.disabled = true;

      if (isLoginMode) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('nome_completo', nome)
          .eq('password', password)
          .limit(1);

        if (error || !data || data.length === 0) {
          errorDiv.textContent = 'Erro ao entrar: Nome ou senha incorretos.';
          errorDiv.style.display = 'block';
          btnSubmit.textContent = 'Entrar';
          btnSubmit.disabled = false;
        } else {
          const user = data[0];
          localStorage.setItem('cidadaoSession', JSON.stringify({ id: user.id, whatsapp: user.whatsapp, nome: user.nome_completo }));
          closeModal();
          renderAuthStatus();
        }
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            nome_completo: nome,
            whatsapp: whatsapp,
            password: password
          })
          .select()
          .maybeSingle();

        if (error) {
          errorDiv.textContent = 'Erro ao cadastrar: ' + error.message;
          errorDiv.style.display = 'block';
          btnSubmit.textContent = 'Cadastrar';
          btnSubmit.disabled = false;
        } else {
          localStorage.setItem('cidadaoSession', JSON.stringify({ id: data.id, whatsapp: data.whatsapp, nome: data.nome_completo }));
          alert('Cadastro realizado! Bem-vindo(a).');
          closeModal();
          renderAuthStatus();
        }
      }
    });
  }

  async function showMeusRelatosModal(userId) {
    const modalHtml = `
      <div id="relatosModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeIn 0.3s ease;">
        <div style="background: var(--card-bg); padding: 2.5rem; border-radius: 24px; width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; position: relative; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); backdrop-filter: blur(12px); animation: slideUp 0.4s ease-out;">
          <button id="closeRelatosModal" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--text-muted); transition: color 0.3s;">&times;</button>
          <h2 style="margin-bottom: 2rem; color: var(--text-main); font-size: 1.8rem; font-weight: 700; text-align: center;">Meus Relatos</h2>
          <div id="relatosList" style="display: flex; flex-direction: column; gap: 1.2rem;">
            <p style="text-align: center; color: var(--text-muted);">Carregando...</p>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeModal = () => document.getElementById('relatosModal').remove();
    document.getElementById('closeRelatosModal').addEventListener('click', closeModal);

    const { data: reports, error } = await supabase
      .from('reports_paracuru')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const listContainer = document.getElementById('relatosList');
    
    if (error) {
      listContainer.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">Erro ao carregar relatos.</p>`;
      return;
    }

    if (reports.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <span style="font-size: 3rem; margin-bottom: 1rem; display: block;">📝</span>
          <p style="color: var(--text-muted); font-size: 1.1rem;">Você ainda não enviou nenhum relato.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = reports.map(r => {
      const date = new Date(r.created_at).toLocaleDateString('pt-BR');
      const statusColor = r.status === 'Aberto' ? 'var(--danger)' : (r.status === 'Resolvido' ? 'var(--secondary)' : 'var(--warning)');
      return `
        <div class="relato-card-cidadao" data-id="${r.id}" style="cursor: pointer; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); padding: 1.2rem; border-radius: 16px; display: flex; gap: 1.2rem; align-items: center; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <img src="${r.photo}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <div style="flex: 1;">
            <h3 style="margin-bottom: 0.3rem; font-size: 1.1rem; color: var(--text-main); font-weight: 600;">${r.title}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.8rem;">📅 ${date} • 🏢 ${r.secretaria}</p>
            <span style="display: inline-block; padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.8rem; font-weight: bold; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">
              ${r.status}
            </span>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.relato-card-cidadao').forEach(card => {
      card.addEventListener('click', () => {
         const id = card.getAttribute('data-id');
         const report = reports.find(x => x.id === id);
         openCidadaoChatModal(report);
      });
    });
  }

  function openCidadaoChatModal(report) {
    const modalHtml = `
      <div id="cidadaoChatModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.3s ease;">
        <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 20px; width: 90%; max-width: 500px; max-height: 90vh; display: flex; flex-direction: column; position: relative;">
          <button id="closeCidadaoChat" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
          <h3 style="margin-bottom: 0.5rem; color: var(--text-main); padding-right: 20px;">${report.title}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Status: <strong style="color: var(--primary);">${report.status}</strong></p>
          
          <div id="cidadaoChatContainer" style="flex: 1; min-height: 250px; overflow-y: auto; background: var(--bg-main); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid var(--border-color);">
            <!-- Messages -->
          </div>
          
          <div style="display: flex; gap: 0.5rem;">
             <input type="text" id="cidadaoChatInput" placeholder="Digite sua mensagem..." style="flex: 1; margin: 0; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main);">
             <button id="btnSendCidadaoChat" class="btn btn-primary" style="width: auto; padding: 0.8rem 1.2rem;">Enviar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeCidadaoChat').addEventListener('click', () => {
      document.getElementById('cidadaoChatModal').remove();
    });

    const chatContainer = document.getElementById('cidadaoChatContainer');
    const btnSend = document.getElementById('btnSendCidadaoChat');
    const chatInput = document.getElementById('cidadaoChatInput');

    function renderMessages() {
      chatContainer.innerHTML = '';
      const chatArray = report.chat_history || [];
      if (chatArray.length === 0) {
        chatContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Envie uma mensagem para a secretaria.</p>';
        return;
      }
      chatArray.forEach(msg => {
        const isMe = msg.sender === 'cidadao';
        const align = isMe ? 'flex-end' : 'flex-start';
        const bg = isMe ? 'var(--primary)' : 'rgba(255,255,255,0.1)';
        const color = isMe ? '#fff' : 'var(--text-main)';
        const d = new Date(msg.date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        chatContainer.innerHTML += `
          <div style="align-self: ${align}; background: ${bg}; color: ${color}; padding: 0.5rem 1rem; border-radius: 12px; max-width: 85%; border: 1px solid var(--border-color);">
            <div style="font-size: 0.7rem; opacity: 0.8; margin-bottom: 0.2rem;">${isMe ? 'Você' : 'Secretaria'} • ${d}</div>
            <div style="font-size: 0.95rem;">${msg.text}</div>
          </div>
        `;
      });
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    renderMessages();

    btnSend.addEventListener('click', async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      
      const newMsg = {
        sender: 'cidadao',
        text: text,
        date: new Date().toISOString()
      };

      const chatHistory = report.chat_history || [];
      chatHistory.push(newMsg);

      const { error } = await supabase
        .from('reports_paracuru')
        .update({ chat_history: chatHistory })
        .eq('id', report.id);

      if (!error) {
        chatInput.value = '';
        renderMessages();
      } else {
        alert('Erro ao enviar mensagem.');
      }
    });
  }

  function setupCitizenRealtime(userId) {
    supabase
      .channel('public:reports_cidadao')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports_paracuru', filter: `user_id=eq.${userId}` }, payload => {
        const newRecord = payload.new;
        const oldRecord = payload.old;
        
        // Notify on status change
        if (newRecord.status !== oldRecord.status && (newRecord.status === 'Em Andamento' || newRecord.status === 'Resolvido')) {
          sendLocalNotification(`Status Atualizado`, `Seu relato "${newRecord.title}" mudou para ${newRecord.status}`);
        }

        // Notify on new message from secretaria
        const oldChatLen = oldRecord.chat_history ? oldRecord.chat_history.length : 0;
        const newChatLen = newRecord.chat_history ? newRecord.chat_history.length : 0;
        if (newChatLen > oldChatLen) {
           const lastMsg = newRecord.chat_history[newChatLen - 1];
           if (lastMsg.sender === 'secretaria') {
             sendLocalNotification(`Nova Mensagem da Secretaria`, lastMsg.text);
           }
        }
      })
      .subscribe();
  }

  function sendLocalNotification(title, body) {
    if (LocalNotifications) {
      LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: new Date().getTime(),
            schedule: { at: new Date(Date.now() + 1000) },
            smallIcon: "ic_stat_icon_config_sample", // Uses default app icon
          }
        ]
      });
    } else {
      // Fallback for browser testing
      if (Notification.permission === 'granted') {
         new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
         Notification.requestPermission().then(permission => {
           if (permission === 'granted') new Notification(title, { body });
         });
      }
    }
  }

  renderAuthStatus();
});

