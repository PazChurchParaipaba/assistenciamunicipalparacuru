import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Se já estiver logado como servidor (usando localStorage como no cidadão)
  const sessionData = localStorage.getItem('servidorSession');
  if (sessionData) {
    const session = JSON.parse(sessionData);
    if (session.perfil === 'tecnico') {
      window.location.href = 'tecnico.html';
    } else {
      window.location.href = 'painel.html';
    }
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const errorMsg = document.getElementById('errorMsg');
  const submitBtn = document.getElementById('btnSubmitAuth');
  const toggleLink = document.getElementById('toggleAuthMode');
  const groupNome = document.getElementById('groupNome');
  const groupSecretaria = document.getElementById('groupSecretaria');
  const groupPerfil = document.getElementById('groupPerfil');

  let isLoginMode = true;

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    errorMsg.style.display = 'none';
    
    if(isLoginMode) {
      groupNome.style.display = 'none';
      groupSecretaria.style.display = 'none';
      groupPerfil.style.display = 'none';
      submitBtn.textContent = 'Entrar no Painel';
      toggleLink.textContent = 'Novo servidor? Solicitar acesso';
    } else {
      groupNome.style.display = 'block';
      groupSecretaria.style.display = 'block';
      groupPerfil.style.display = 'block';
      submitBtn.textContent = 'Cadastrar Servidor';
      toggleLink.textContent = 'Já tem acesso? Entrar';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const nome = document.getElementById('nome').value.trim();
    const secretaria = document.getElementById('secretaria').value;
    const perfilSelecionado = document.getElementById('perfil') ? document.getElementById('perfil').value : 'admin';

    if (!email || !password || (!isLoginMode && (!nome || !secretaria))) {
      errorMsg.textContent = 'Erro: Preencha todos os campos obrigatórios.';
      errorMsg.style.display = 'block';
      return;
    }

    submitBtn.textContent = 'Aguarde...';
    submitBtn.disabled = true;

    if (isLoginMode) {
      // Busca na tabela servidores (nova tabela)
      const { data, error } = await supabase
        .from('servidores')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) {
        errorMsg.textContent = 'Falha no login: E-mail ou senha incorretos.';
        errorMsg.style.display = 'block';
        submitBtn.textContent = 'Entrar no Painel';
        submitBtn.disabled = false;
      } else {
        // Salva a sessão no localStorage incluindo a secretaria e perfil
        const perfil = data.perfil || 'admin';
        localStorage.setItem('servidorSession', JSON.stringify({ 
          id: data.id, 
          email: data.email, 
          nome: data.nome_completo,
          secretaria: data.secretaria,
          perfil: perfil
        }));
        
        if (perfil === 'tecnico') {
          window.location.href = 'tecnico.html';
        } else {
          window.location.href = 'painel.html';
        }
      }
    } else {
      const { data, error } = await supabase
        .from('servidores')
        .insert({
          nome_completo: nome,
          email: email,
          password: password,
          secretaria: secretaria,
          perfil: perfilSelecionado
        })
        .select()
        .single();

      if (error) {
        errorMsg.textContent = 'Erro ao cadastrar: ' + error.message;
        errorMsg.style.display = 'block';
        submitBtn.textContent = 'Cadastrar Servidor';
        submitBtn.disabled = false;
      } else {
        const perfil = data.perfil || 'admin';
        localStorage.setItem('servidorSession', JSON.stringify({ 
          id: data.id, 
          email: data.email, 
          nome: data.nome_completo,
          secretaria: data.secretaria,
          perfil: perfil
        }));
        alert('Cadastro realizado! Bem-vindo(a).');
        if (perfil === 'tecnico') {
          window.location.href = 'tecnico.html';
        } else {
          window.location.href = 'painel.html';
        }
      }
    }
  });
});
