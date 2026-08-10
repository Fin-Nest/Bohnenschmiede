/**
 * BOHNENSCHMIEDE - MAIN APP CONTROLLER
 */

let userBeansData = [];
let processedImageFile = null; // Speichert das verarbeitete Bild-File/Blob
let selectedTastingNotes = []; // Speichert die aktuell aktivierten Tags
let modalSelectedTastingNotes = []; // Speichert die im Modal gewählten Tags

document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initAddBeanForm();
  initImageUploadHandler();
  initTastingNotesHandler();
  initModalTastingNotesHandler(); // ⬅️ Aktiviert Klicks auf die Modal-Tags
  initSearchAndFilter();
  initModalEvents();
  initSetupTab();
  registerServiceWorker();
  loadAndRenderBeans();
});

/**
 * Steuerung der Bottom Navigation Bar (Tabs)
 */
function initTabNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = {
    dashboard: document.getElementById('tab-dashboard'),
    wishlist: document.getElementById('tab-wishlist'),
    add: document.getElementById('tab-add'),
    setup: document.getElementById('tab-setup')
  };

  navButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const targetTab = button.getAttribute('data-tab');

      Object.values(sections).forEach(section => {
        if (section) section.classList.add('hidden');
      });

      if (sections[targetTab]) {
        sections[targetTab].classList.remove('hidden');
      }

      navButtons.forEach(btn => {
        btn.classList.remove('text-slate-900', 'font-semibold');
        btn.classList.add('text-slate-500');
      });

      button.classList.remove('text-slate-500');
      button.classList.add('text-slate-900', 'font-semibold');

      // Beim Wechsel auf Dashboard oder Wunschliste Daten frisch aus Supabase laden
      if (targetTab === 'dashboard' || targetTab === 'wishlist') {
        await loadAndRenderBeans();
      }
    });
  });
}

/**
 * Foto-Upload & Client-side KI-Hintergrundentfernung
 */
function initImageUploadHandler() {
  const fileInput = document.getElementById('bean-image-input');
  const bgToggle = document.getElementById('toggle-bg-removal');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');
  const spinner = document.getElementById('image-loading-spinner');

  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
      processedImageFile = null;
      previewContainer.classList.add('hidden');
      return;
    }

    previewContainer.classList.remove('hidden');

    if (bgToggle.checked && window.imglyRemoveBackground) {
      spinner.classList.remove('hidden');
      try {
        const blob = await window.imglyRemoveBackground(file);
        processedImageFile = new File([blob], `nobg_${file.name}.png`, { type: 'image/png' });
        previewImg.src = URL.createObjectURL(processedImageFile);
      } catch (err) {
        console.error('KI Freistellen fehlgeschlagen, nutze Originalbild:', err);
        alert('KI-Hintergrundentfernung fehlgeschlagen. Es wird das Originalfoto verwendet.');
        processedImageFile = file;
        previewImg.src = URL.createObjectURL(file);
      } finally {
        spinner.classList.add('hidden');
      }
    } else {
      processedImageFile = file;
      previewImg.src = URL.createObjectURL(file);
    }
  });
}

/**
 * Live-Suche & Sortier-Event-Listener
 */
function initSearchAndFilter() {
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderBeans());
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => filterAndRenderBeans());
  }
}

/**
 * Formular-Event-Listener für "Neue Bohne"
 */
function initAddBeanForm() {
  const form = document.getElementById('add-bean-form');
  const submitBtn = document.getElementById('btn-submit-bean');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      submitBtn.disabled = true;
      submitBtn.textContent = 'Speichere Bohne...';

      const customNotesInput = document.getElementById('bean-custom-notes') ? document.getElementById('bean-custom-notes').value : '';
      const customNotesArray = customNotesInput
        ? customNotesInput.split(',').map(n => n.trim()).filter(n => n.length > 0)
        : [];

      const allTastingNotes = [...new Set([...selectedTastingNotes, ...customNotesArray])];

      const formData = {
        status: form.querySelector('input[name="status"]:checked').value,
        name: document.getElementById('bean-name').value,
        roaster: document.getElementById('bean-roaster').value,
        roastLevel: document.getElementById('bean-roast').value,
        tastingNotes: allTastingNotes,
        imageFile: processedImageFile,

        singleGrind: document.getElementById('single-grind').value,
        singleYield: document.getElementById('single-yield').value,
        singleTime: document.getElementById('single-time').value,

        doubleGrind: document.getElementById('double-grind').value,
        doubleYield: document.getElementById('double-yield').value,
        doubleTime: document.getElementById('double-time').value,
      };

      const result = await saveBeanToDatabase(formData);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Bohne Speichern';

      if (result.success) {
        alert('Bohne erfolgreich gespeichert!');
        
        form.reset();
        processedImageFile = null;
        resetTastingNotesUI();

        document.getElementById('image-preview-container').classList.add('hidden');

        await loadAndRenderBeans();
        document.querySelector('[data-tab="dashboard"]').click();
      } else {
        alert('Fehler beim Speichern: ' + result.error);
      }
    });
  }
}

/**
 * Hilfsfunktion: Setzt das globale Tag-Array und die Optik der Tag-Buttons zurück
 */
function resetTastingNotesUI() {
  selectedTastingNotes = [];
  const tagButtons = document.querySelectorAll('#tasting-tags-preset .tag-btn');
  tagButtons.forEach(btn => {
    btn.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
    btn.classList.add('bg-white', 'text-slate-600', 'border-lab-border');
  });
}

/**
 * Lädt die Bohnen aus Supabase
 */
async function loadAndRenderBeans() {
  const response = await fetchUserBeans();

  if (!response.success) {
    console.error('Bohnen konnten nicht geladen werden.');
    return;
  }

  userBeansData = response.data || [];
  filterAndRenderBeans();
}

/**
 * Wendet Suchbegriffe & Sortierung an
 */
function filterAndRenderBeans() {
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const sortBy = sortSelect ? sortSelect.value : 'recent';

  let filtered = userBeansData.filter(item => {
    const bean = item.beans;
    if (!bean) return false;

    const nameMatch = bean.name ? bean.name.toLowerCase().includes(query) : false;
    const roasterMatch = bean.roaster ? bean.roaster.toLowerCase().includes(query) : false;
    const notesMatch = bean.tasting_notes ? bean.tasting_notes.some(n => n.toLowerCase().includes(query)) : false;

    return nameMatch || roasterMatch || notesMatch;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'name') {
      return (a.beans?.name || '').localeCompare(b.beans?.name || '');
    } else if (sortBy === 'score') {
      return (b.personal_score || 0) - (a.personal_score || 0);
    } else if (sortBy === 'grind') {
      return (a.double_grind_size || 0) - (b.double_grind_size || 0);
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const pinnedBeans = filtered.filter(item => item.is_pinned);
  const inventoryBeans = filtered.filter(item => item.status === 'inventory');
  const wishlistBeans = filtered.filter(item => item.status === 'wishlist');

  renderPinnedBeans(pinnedBeans);
  renderInventoryBeans(inventoryBeans);
  renderWishlistBeans(wishlistBeans);
}

/**
 * Rendert Hero-Kacheln (Angepinnt) inkl. Packungsfoto
 */
function renderPinnedBeans(pinnedList) {
  const container = document.getElementById('pinned-beans-container');
  const countDisplay = document.getElementById('pinned-count');
  
  if (countDisplay) {
    countDisplay.textContent = `${pinnedList.length}/3`;
  }

  if (!container) return;

  if (pinnedList.length === 0) {
    container.innerHTML = `
      <div class="frosted-glass p-4 rounded-xl border border-dashed border-slate-300 text-center py-6 text-slate-400 text-sm">
        Keine aktive Bohne angepinnt. Klicke bei einer Bohne im Bestand auf 📌, um sie hier oben anzuheften.
      </div>
    `;
    return;
  }

  container.innerHTML = pinnedList.map(item => {
    const bean = item.beans;
    return `
      <div class="frosted-glass p-4 rounded-xl border border-slate-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
        
        <div class="flex gap-3 items-start">
          ${bean.image_url ? `
            <div class="w-16 h-20 flex-shrink-0 bg-slate-100/50 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-lab-border">
              <img src="${escapeHtml(bean.image_url)}" alt="${escapeHtml(bean.name)}" class="max-h-full max-w-full object-contain filter drop-shadow-md">
            </div>
          ` : ''}
          
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <div onclick="openDetailModal('${item.id}')" class="cursor-pointer">
                <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">${escapeHtml(bean.roaster)}</span>
                <h3 class="text-base font-bold text-slate-900 hover:underline leading-tight">${escapeHtml(bean.name)}</h3>
              </div>
              <button onclick="handlePinToggle('${item.id}', false)" title="Entpinnen" class="text-base p-1 hover:opacity-75">
                📌
              </button>
            </div>

            <!-- Tasting Notes Badges im Hero-Bereich -->
            ${bean.tasting_notes && bean.tasting_notes.length > 0 ? `
              <div class="flex flex-wrap gap-1 mt-1.5">
                ${bean.tasting_notes.map(note => `
                  <span class="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border/60">
                    ${escapeHtml(note)}
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <div onclick="openDetailModal('${item.id}')" class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-lab-border cursor-pointer">
          <div class="bg-white/80 p-2 rounded border border-lab-border">
            <span class="text-[10px] font-mono text-slate-500 block uppercase">Single (8g)</span>
            <div class="text-lg font-mono font-bold text-slate-900">
              ${formatNumberDisplay(item.single_grind_size)} <span class="text-xs font-normal text-slate-500">DF64</span>
            </div>
            <div class="text-[11px] font-mono text-slate-500">
              ${formatNumberDisplay(item.single_yield_out)}g | ${formatNumberDisplay(item.single_time_sec, 0)}s
            </div>
          </div>

          <div class="bg-white/80 p-2 rounded border border-slate-900/20">
            <span class="text-[10px] font-mono text-slate-500 block uppercase">Double (18g)</span>
            <div class="text-lg font-mono font-bold text-slate-900">
              ${formatNumberDisplay(item.double_grind_size)} <span class="text-xs font-normal text-slate-500">DF64</span>
            </div>
            <div class="text-[11px] font-mono text-slate-500">
              ${formatNumberDisplay(item.double_yield_out)}g | ${formatNumberDisplay(item.double_time_sec, 0)}s
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Rendert Bestands-Kacheln im 3:4 Grid
 */
function renderInventoryBeans(inventoryList) {
  const container = document.getElementById('inventory-container');
  if (!container) return;

  if (inventoryList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full frosted-glass p-6 rounded-xl text-center text-slate-400 text-sm">
        Keine Bohnen im Bestand gefunden.
      </div>
    `;
    return;
  }

  container.innerHTML = inventoryList.map(item => {
    const bean = item.beans;
    return `
      <div class="frosted-glass p-3.5 rounded-xl border border-lab-border flex flex-col justify-between space-y-3">
        
        ${bean.image_url ? `
          <div onclick="openDetailModal('${item.id}')" class="w-full aspect-[3/4] bg-slate-100/60 rounded-lg overflow-hidden flex items-center justify-center p-2 border border-lab-border/40 cursor-pointer">
            <img src="${escapeHtml(bean.image_url)}" alt="${escapeHtml(bean.name)}" class="max-h-full max-w-full object-contain filter drop-shadow-md">
          </div>
        ` : ''}

        <div>
          <div class="flex justify-between items-start">
            <span class="text-[10px] font-mono uppercase text-slate-400 truncate max-w-[130px]">${escapeHtml(bean.roaster)}</span>
            <button onclick="handlePinToggle('${item.id}', ${!item.is_pinned})" 
                    title="${item.is_pinned ? 'Entpinnen' : 'Oben anpinnen'}"
                    class="text-xs p-1 rounded hover:bg-slate-100 ${item.is_pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'}">
              📌
            </button>
          </div>
          <h4 onclick="openDetailModal('${item.id}')" class="text-sm font-bold text-slate-900 leading-tight cursor-pointer hover:underline">
            ${escapeHtml(bean.name)}
          </h4>
          <span class="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border">
            ${escapeHtml(bean.roast_level || 'Medium')}
          </span>

          <!-- Tasting Notes Badges auf den Kacheln -->
          ${bean.tasting_notes && bean.tasting_notes.length > 0 ? `
            <div class="flex flex-wrap gap-1 mt-2">
              ${bean.tasting_notes.map(note => `
                <span class="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 border border-lab-border/60">
                  ${escapeHtml(note)}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div onclick="openDetailModal('${item.id}')" class="bg-white/60 p-2 rounded border border-lab-border/60 text-xs font-mono space-y-1 cursor-pointer">
          <div class="flex justify-between text-slate-600">
            <span>Single:</span>
            <span class="font-bold text-slate-900">${formatNumberDisplay(item.single_grind_size)}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Double:</span>
            <span class="font-bold text-slate-900">${formatNumberDisplay(item.double_grind_size)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Rendert Wunschlisten-Kacheln
 */
function renderWishlistBeans(wishlistList) {
  const container = document.getElementById('wishlist-container');
  if (!container) return;

  if (wishlistList.length === 0) {
    container.innerHTML = `
      <div class="frosted-glass p-6 rounded-xl text-center text-slate-400 text-sm">
        Deine Wunschliste ist zurzeit leer.
      </div>
    `;
    return;
  }

  container.innerHTML = wishlistList.map(item => {
    const bean = item.beans;
    return `
      <div class="frosted-glass p-4 rounded-xl border border-lab-border flex justify-between items-center gap-3">
        ${bean.image_url ? `
          <div class="w-12 h-16 flex-shrink-0 bg-slate-100/50 rounded overflow-hidden flex items-center justify-center p-1">
            <img src="${escapeHtml(bean.image_url)}" alt="${escapeHtml(bean.name)}" class="max-h-full max-w-full object-contain filter drop-shadow">
          </div>
        ` : ''}
        <div class="flex-1">
          <span class="text-[10px] font-mono uppercase text-slate-400 block">${escapeHtml(bean.roaster)}</span>
          <h4 class="text-sm font-bold text-slate-900">${escapeHtml(bean.name)}</h4>
        </div>
        <button onclick="moveToInventory('${item.id}')" class="bg-slate-900 text-white text-xs font-mono px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
          In Bestand
        </button>
      </div>
    `;
  }).join('');
}

/**
 * Modal Event-Handling
 */
function initModalEvents() {
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const editForm = document.getElementById('edit-bean-form');
  const deleteBtn = document.getElementById('btn-delete-bean');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const configId = document.getElementById('edit-config-id').value;

      const customNotesInput = document.getElementById('edit-custom-notes') ? document.getElementById('edit-custom-notes').value : '';
      const customNotesArray = customNotesInput
        ? customNotesInput.split(',').map(n => n.trim()).filter(n => n.length > 0)
        : [];

      const updatedTastingNotes = [...new Set([...modalSelectedTastingNotes, ...customNotesArray])];

      const item = userBeansData.find(b => b.id === configId);

      const updatedData = {
        status: document.getElementById('edit-status').value,
        personalScore: document.getElementById('edit-score').value,
        singleGrind: document.getElementById('edit-single-grind').value,
        singleYield: document.getElementById('edit-single-yield').value,
        singleTime: document.getElementById('edit-single-time').value,
        doubleGrind: document.getElementById('edit-double-grind').value,
        doubleYield: document.getElementById('edit-double-yield').value,
        doubleTime: document.getElementById('edit-double-time').value,
      };

      const result = await updateUserBeanConfig(configId, updatedData);

      if (result.success && item && item.beans) {
        await updateBeanMasterData(item.beans.id, { tastingNotes: updatedTastingNotes });
      }

      if (result.success) {
        modal.classList.add('hidden');
        await loadAndRenderBeans();
      } else {
        alert('Fehler beim Aktualisieren: ' + result.error);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const configId = document.getElementById('edit-config-id').value;
      if (confirm('Möchtest du diese Bohne wirklich löschen?')) {
        const result = await deleteUserBeanConfig(configId);
        if (result.success) {
          modal.classList.add('hidden');
          loadAndRenderBeans();
        } else {
          alert('Fehler beim Löschen: ' + result.error);
        }
      }
    });
  }
}

/**
 * Öffnet das Modal und befüllt alle Felder inkl. Tasting Notes
 */
function openDetailModal(configId) {
  const item = userBeansData.find(b => b.id === configId);
  if (!item) return;

  const bean = item.beans || {};
  const modal = document.getElementById('detail-modal');

  document.getElementById('edit-config-id').value = item.id;
  document.getElementById('modal-roaster').textContent = bean.roaster || '';
  document.getElementById('modal-bean-name').textContent = bean.name || '';
  
  document.getElementById('edit-status').value = item.status || 'inventory';
  document.getElementById('edit-score').value = item.personal_score ? formatNumberDisplay(item.personal_score, 1) : '';

  // --- TASTING NOTES IM MODAL BEFÜLLEN ---
  const existingNotes = bean.tasting_notes || [];
  modalSelectedTastingNotes = [];

  const presetTags = ['Schokolade', 'Nuss', 'Beere', 'Zitrus', 'Steinobst', 'Blumig', 'Karamell'];
  const customNotes = [];

  const tagButtons = document.querySelectorAll('#modal-tasting-tags-preset .modal-tag-btn');
  
  tagButtons.forEach(btn => {
    const tagValue = btn.getAttribute('data-tag');
    if (existingNotes.includes(tagValue)) {
      modalSelectedTastingNotes.push(tagValue);
      btn.classList.remove('bg-white', 'text-slate-600', 'border-lab-border');
      btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
    } else {
      btn.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
      btn.classList.add('bg-white', 'text-slate-600', 'border-lab-border');
    }
  });

  existingNotes.forEach(note => {
    if (!presetTags.includes(note)) {
      customNotes.push(note);
    }
  });

  const customNotesEl = document.getElementById('edit-custom-notes');
  if (customNotesEl) {
    customNotesEl.value = customNotes.join(', ');
  }

  document.getElementById('edit-single-grind').value = item.single_grind_size ? formatNumberDisplay(item.single_grind_size, 1) : '';
  document.getElementById('edit-single-yield').value = item.single_yield_out ? formatNumberDisplay(item.single_yield_out, 1) : '';
  document.getElementById('edit-single-time').value = item.single_time_sec ? formatNumberDisplay(item.single_time_sec, 0) : '';

  document.getElementById('edit-double-grind').value = item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : '';
  document.getElementById('edit-double-yield').value = item.double_yield_out ? formatNumberDisplay(item.double_yield_out, 1) : '';
  document.getElementById('edit-double-time').value = item.double_time_sec ? formatNumberDisplay(item.double_time_sec, 0) : '';

  modal.classList.remove('hidden');
}

/**
 * Verschiebt Bohne von der Wunschliste in den Bestand
 */
async function moveToInventory(configId) {
  const result = await updateUserBeanConfig(configId, { status: 'inventory' });
  if (result.success) {
    loadAndRenderBeans();
  }
}

/**
 * Toggle Pin-Status
 */
async function handlePinToggle(configId, targetState) {
  const result = await togglePinStatus(configId, targetState);
  if (result.success) {
    loadAndRenderBeans();
  } else {
    alert(result.error);
  }
}

/**
 * XSS-Schutz
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Initialisiert die Funktionen im Setup-Tab (z.B. CSV-Export)
 */
function initSetupTab() {
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportBeansToCSV(userBeansData);
    });
  }
}

/**
 * Registriert den Service Worker für PWA- und Offline-Funktionalität
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker erfolgreich registriert Scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker Registrierung fehlgeschlagen:', err);
        });
    });
  }
}

/**
 * Steuert das An- und Abwählen der Tasting-Notes-Buttons
 */
function initTastingNotesHandler() {
  const tagButtons = document.querySelectorAll('#tasting-tags-preset .tag-btn');

  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tagValue = btn.getAttribute('data-tag');

      if (selectedTastingNotes.includes(tagValue)) {
        selectedTastingNotes = selectedTastingNotes.filter(t => t !== tagValue);
        btn.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        btn.classList.add('bg-white', 'text-slate-600', 'border-lab-border');
      } else {
        selectedTastingNotes.push(tagValue);
        btn.classList.remove('bg-white', 'text-slate-600', 'border-lab-border');
        btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
      }
    });
  });
}

/**
 * Steuert das An- und Abwählen der Tasting-Notes im Edit-Modal
 */
function initModalTastingNotesHandler() {
  const tagButtons = document.querySelectorAll('#modal-tasting-tags-preset .modal-tag-btn');

  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tagValue = btn.getAttribute('data-tag');

      if (modalSelectedTastingNotes.includes(tagValue)) {
        modalSelectedTastingNotes = modalSelectedTastingNotes.filter(t => t !== tagValue);
        btn.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        btn.classList.add('bg-white', 'text-slate-600', 'border-lab-border');
      } else {
        modalSelectedTastingNotes.push(tagValue);
        btn.classList.remove('bg-white', 'text-slate-600', 'border-lab-border');
        btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
      }
    });
  });
}
