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
    'Governo': ['Ouvidoria', 'Sugestão', 'Reclamação', 'Outros']
  };

  const titleInput = document.getElementById('title');
  const secInput = document.getElementById('secretaria');
  const subInput = document.getElementById('subcategory');
  const subGroup = document.getElementById('subcategoryGroup');

  titleInput.addEventListener('input', (e) => {
    const text = e.target.value.toLowerCase();
    let changed = false;
    if (text.includes('luz') || text.includes('lâmpada') || text.includes('poste') || text.includes('escuro')) {
      secInput.value = 'Iluminação Pública'; changed = true;
    } else if (text.includes('buraco') || text.includes('asfalto') || text.includes('rua') || text.includes('calçada')) {
      secInput.value = 'Infraestrutura'; changed = true;
    } else if (text.includes('lixo') || text.includes('árvore') || text.includes('animal') || text.includes('mato')) {
      secInput.value = 'Meio Ambiente'; changed = true;
    } else if (text.includes('médico') || text.includes('remédio') || text.includes('posto') || text.includes('saúde')) {
      secInput.value = 'Saúde'; changed = true;
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
    btn.addEventListener('click', () => {
      // Basic validation for Step 1
      if (currentStep === 1) {
        const title = document.getElementById('title').value;
        const secretaria = document.getElementById('secretaria').value;
        if (!title || !secretaria) {
          alert('Preencha os campos obrigatórios primeiro.');
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
          alert('Erro ao obter GPS. Arraste o pino no mapa manualmente.');
          btnMyLocation.textContent = '📍 Usar Minha Localização GPS';
        }
      );
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
      if (!navigator.onLine) {
        // Modo offline
        const offlineData = {
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
            title: document.getElementById('title').value,
            secretaria: document.getElementById('secretaria').value,
            description: document.getElementById('description').value,
            photo: publicUrl,
            location_lat: markerLocation.lat,
            location_lng: markerLocation.lng,
            status: 'Aberto',
            user_id: userId,
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

