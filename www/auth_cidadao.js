import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const authContainer = document.getElementById('authContainer');

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
          .maybeSingle();

        if (error || !data) {
          errorDiv.textContent = 'Erro ao entrar: Nome ou senha incorretos.';
          errorDiv.style.display = 'block';
          btnSubmit.textContent = 'Entrar';
          btnSubmit.disabled = false;
        } else {
          localStorage.setItem('cidadaoSession', JSON.stringify({ id: data.id, whatsapp: data.whatsapp, nome: data.nome_completo }));
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
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); padding: 1.2rem; border-radius: 16px; display: flex; gap: 1.2rem; align-items: center; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
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
  }

  renderAuthStatus();
});

