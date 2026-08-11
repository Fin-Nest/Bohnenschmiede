/**
 * BOHNENSCHMIEDE - MAIN APP CONTROLLER
 */

let userBeansData = [];
let processedImageFile = null;
let selectedTastingNotes = [];
let modalSelectedTastingNotes = [];
let modalProcessedImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initAddBeanForm();
  initImageUploadHandler();
  initTastingNotesHandler();
  initModalTastingNotesHandler();
  initBlendSliderHandler();
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
      const websiteUrlInput = document.getElementById('bean-website') ? document.getElementById('bean-website').value.trim() : '';

      const formData = {
        status: form.querySelector('input[name="status"]:checked').value,
        name: document.getElementById('bean-name').value,
        roaster: document.getElementById('bean-roaster').value,
        roastLevel: document.getElementById('bean-roast').value,
        arabicaPercentage: parseInt(document.getElementById('bean-arabica-slider').value, 10),
        websiteUrl: websiteUrlInput, // ⬅️ NEU
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
        document.getElementById('bean-arabica-slider').value = 100;
        document.getElementById('bean-blend-display').textContent = '100% Arabica';
        if (document.getElementById('bean-website')) document.getElementById('bean-website').value = '';

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
 * Rendert Hero-Kacheln (Angepinnt) inkl. Rating-Badge
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

            <!-- Badges: Röstgrad, Mischung & SCORE (RATING) -->
            <div class="flex flex-wrap gap-1 mt-1">
              <span class="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border">
                ${escapeHtml(bean.roast_level || 'Medium')}
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 rounded text-amber-800 border border-amber-200">
                ${formatBlendText((bean && bean.arabica_percentage !== null && bean.arabica_percentage !== undefined) ? bean.arabica_percentage : 100)}
              </span>
              ${item.personal_score ? `
                <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-yellow-100 rounded text-yellow-900 border border-yellow-300">
                  ⭐ ${formatNumberDisplay(item.personal_score, 1)}
                </span>
              ` : ''}
            </div>

            <!-- Tasting Notes Badges -->
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
 * Rendert Bestands-Kacheln im kompakten Horizontal-Layout (Bild links, Details rechts)
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
        
        <!-- OBERER BEREICH: BILD LINKS, STAMMDATEN & BADGES RECHTS -->
        <div class="flex gap-3 items-start">
          
          <!-- Bild links (max 1/3 der Höhe, fester Rahmen) -->
          ${bean.image_url ? `
            <div onclick="openDetailModal('${item.id}')" 
                 class="w-16 h-20 flex-shrink-0 bg-slate-100/60 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-lab-border/60 cursor-pointer">
              <img src="${escapeHtml(bean.image_url)}" alt="${escapeHtml(bean.name)}" class="max-h-full max-w-full object-contain filter drop-shadow-md">
            </div>
          ` : ''}

          <!-- Text-Inhalte & Badges rechts -->
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start gap-1">
              <div onclick="openDetailModal('${item.id}')" class="cursor-pointer min-w-0 flex-1">
                <span class="text-[10px] font-mono uppercase text-slate-400 truncate block">${escapeHtml(bean.roaster)}</span>
                <h4 class="text-sm font-bold text-slate-900 leading-tight hover:underline truncate">${escapeHtml(bean.name)}</h4>
              </div>
              
              <!-- Pin Button -->
              <button onclick="handlePinToggle('${item.id}', ${!item.is_pinned})" 
                      title="${item.is_pinned ? 'Entpinnen' : 'Oben anpinnen'}"
                      class="text-xs p-1 rounded hover:bg-slate-100 flex-shrink-0 ${item.is_pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'}">
                📌
              </button>
            </div>

            <!-- Badges: Röstgrad, Mischungsverhältnis & Rating -->
            <div class="flex flex-wrap gap-1 mt-1.5">
              <span class="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border">
                ${escapeHtml(bean.roast_level || 'Medium')}
              </span>
              <span class="text-[9px] font-mono px-1.5 py-0.5 bg-amber-50 rounded text-amber-800 border border-amber-200">
                ${formatBlendText((bean && bean.arabica_percentage !== null && bean.arabica_percentage !== undefined) ? bean.arabica_percentage : 100)}
              </span>
              ${item.personal_score ? `
                <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-yellow-100 rounded text-yellow-900 border border-yellow-300">
                  ⭐ ${formatNumberDisplay(item.personal_score, 1)}
                </span>
              ` : ''}
            </div>

            <!-- Tasting Notes Badges -->
            ${bean.tasting_notes && bean.tasting_notes.length > 0 ? `
              <div class="flex flex-wrap gap-1 mt-1.5">
                ${bean.tasting_notes.map(note => `
                  <span class="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100/80 rounded text-slate-500 border border-lab-border/60">
                    ${escapeHtml(note)}
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- UNTERER BEREICH: DF64 DIAL-IN PARAMETER (2-SPALTEN GRID) -->
        <div onclick="openDetailModal('${item.id}')" class="bg-white/60 p-2 rounded border border-lab-border/60 text-xs font-mono grid grid-cols-2 gap-2 cursor-pointer pt-2 border-t border-lab-border/40">
          <div>
            <span class="text-[9px] font-mono text-slate-400 block uppercase">Single (8g)</span>
            <div class="font-bold text-slate-900">
              ${formatNumberDisplay(item.single_grind_size)} <span class="text-[10px] font-normal text-slate-500">DF64</span>
            </div>
            <div class="text-[10px] text-slate-500">
              ${formatNumberDisplay(item.single_yield_out)}g | ${formatNumberDisplay(item.single_time_sec, 0)}s
            </div>
          </div>

          <div>
            <span class="text-[9px] font-mono text-slate-400 block uppercase">Double (18g)</span>
            <div class="font-bold text-slate-900">
              ${formatNumberDisplay(item.double_grind_size)} <span class="text-[10px] font-normal text-slate-500">DF64</span>
            </div>
            <div class="text-[10px] text-slate-500">
              ${formatNumberDisplay(item.double_yield_out)}g | ${formatNumberDisplay(item.double_time_sec, 0)}s
            </div>
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
 * Registriert alle Klick- & Formular-Events im Detail-Modal sowie den Unter-Modals
 */
function initModalEvents() {
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const editForm = document.getElementById('edit-bean-form');
  const deleteBtn = document.getElementById('btn-delete-bean');
  const deleteImageBtn = document.getElementById('btn-delete-modal-image');
  const modalFileInput = document.getElementById('modal-bean-image-input');

  const btnEnableEdit = document.getElementById('btn-enable-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const viewModeEl = document.getElementById('modal-view-mode');

  // Unter-Modals
  const newPackModal = document.getElementById('new-pack-modal');
  const newPackCloseBtn = document.getElementById('new-pack-close-btn');
  const newPackForm = document.getElementById('new-pack-form');

  const shotLogModal = document.getElementById('shot-log-modal');
  const shotLogCloseBtn = document.getElementById('shot-log-close-btn');
  const shotLogForm = document.getElementById('shot-log-form');

  // --- GLOBALE KLICK-STEUERUNG (Event Delegation) ---
  document.addEventListener('click', (e) => {
    // 1. Klick auf "+ Neue Packung"
    if (e.target.closest('#btn-open-new-pack-modal')) {
      const today = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('pack-roast-date-input');
      if (dateInput) dateInput.value = today;
      if (newPackModal) newPackModal.classList.remove('hidden');
    }

    // 2. Klick auf "⏱️ Neuen Bezug loggen"
    if (e.target.closest('#btn-open-shot-logger')) {
      const configId = document.getElementById('edit-config-id') ? document.getElementById('edit-config-id').value : null;
      const item = userBeansData.find(b => b.id === configId);
      
      if (item) {
        const grindInput = document.getElementById('log-grind-size');
        if (grindInput) {
          grindInput.value = item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : '';
        }
      }
      if (shotLogModal) shotLogModal.classList.remove('hidden');
    }
  });

  // Modus-Umschaltung Read-Only / Bearbeiten
  if (btnEnableEdit) {
    btnEnableEdit.addEventListener('click', () => {
      if (viewModeEl) viewModeEl.classList.add('hidden');
      if (editForm) editForm.classList.remove('hidden');
      if (btnEnableEdit) btnEnableEdit.classList.add('hidden');
    });
  }

  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      if (editForm) editForm.classList.add('hidden');
      if (viewModeEl) viewModeEl.classList.remove('hidden');
      if (btnEnableEdit) btnEnableEdit.classList.remove('hidden');
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (newPackCloseBtn && newPackModal) newPackCloseBtn.addEventListener('click', () => newPackModal.classList.add('hidden'));
  if (shotLogCloseBtn && shotLogModal) shotLogCloseBtn.addEventListener('click', () => shotLogModal.classList.add('hidden'));

  // Formular: Neue Packung speichern
  if (newPackForm) {
    newPackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const configId = document.getElementById('edit-config-id').value;
      const item = userBeansData.find(b => b.id === configId);
      if (!item || !item.beans) return;

      const packName = document.getElementById('pack-name-input').value.trim() || 'Neue Packung';
      const roastDate = document.getElementById('pack-roast-date-input').value;

      const result = await createBeanPack(item.beans.id, roastDate, packName);
      if (result.success) {
        alert('Neue Packung wurde erfolgreich aktiviert!');
        newPackModal.classList.add('hidden');
        newPackForm.reset();
        openDetailModal(configId);
      } else {
        alert('Fehler beim Anlegen der Packung: ' + result.error);
      }
    });
  }

  // Formular: Bezug speichern
  if (shotLogForm) {
    shotLogForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const configId = document.getElementById('edit-config-id').value;
      const item = userBeansData.find(b => b.id === configId);
      if (!item || !item.beans) return;

      const packsRes = await fetchPacksAndLogsForBean(item.beans.id);
      if (!packsRes.success || !packsRes.data || packsRes.data.length === 0) {
        alert('Bitte lege zuerst eine aktive Packung mit Röstdatum an!');
        shotLogModal.classList.add('hidden');
        if (newPackModal) newPackModal.classList.remove('hidden');
        return;
      }

      const activePack = packsRes.data.find(p => p.is_active) || packsRes.data[packsRes.data.length - 1];

      const grindSize = document.getElementById('log-grind-size').value;
      const timeSec = document.getElementById('log-time-sec').value;
      const notes = document.getElementById('log-notes').value;

      const logRes = await saveShotLog(activePack.id, grindSize, timeSec, notes);

      if (logRes.success) {
        await updateUserBeanConfig(configId, { doubleGrind: grindSize });
        alert('Bezug erfolgreich geloggt!');
        shotLogModal.classList.add('hidden');
        shotLogForm.reset();
        await loadAndRenderBeans();
        openDetailModal(configId);
      } else {
        alert('Fehler beim Speichern des Bezugs: ' + logRes.error);
      }
    });
  }

  // Foto löschen
  if (deleteImageBtn) {
    deleteImageBtn.addEventListener('click', async () => {
      const configId = document.getElementById('edit-config-id').value;
      const item = userBeansData.find(b => b.id === configId);

      if (item && item.beans && confirm('Möchtest du das Foto dieser Bohne wirklich löschen?')) {
        const result = await updateBeanMasterData(item.beans.id, { imageUrl: null });
        if (result.success) {
          document.getElementById('modal-image-preview-box').classList.add('hidden');
          document.getElementById('modal-image-container').classList.add('hidden');
          await loadAndRenderBeans();
          alert('Foto wurde erfolgreich entfernt!');
        } else {
          alert('Fehler beim Löschen des Bildes: ' + result.error);
        }
      }
    });
  }

  // Edit Formular speichern
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const configId = document.getElementById('edit-config-id').value;
      const item = userBeansData.find(b => b.id === configId);

      let newImageUrl = undefined;
      if (modalProcessedImageFile) {
        try {
          newImageUrl = await uploadBeanImage(modalProcessedImageFile);
        } catch (imgErr) {
          console.error('Fehler beim Upload des neuen Bildes:', imgErr);
        }
      }

      const customNotesInput = document.getElementById('edit-custom-notes') ? document.getElementById('edit-custom-notes').value : '';
      const customNotesArray = customNotesInput
        ? customNotesInput.split(',').map(n => n.trim()).filter(n => n.length > 0)
        : [];
      const updatedTastingNotes = [...new Set([...modalSelectedTastingNotes, ...customNotesArray])];
      const updatedArabica = parseInt(document.getElementById('edit-arabica-slider').value, 10);
      const updatedWebsiteUrl = document.getElementById('edit-website') ? document.getElementById('edit-website').value.trim() : '';

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
        const masterPayload = { 
          tastingNotes: updatedTastingNotes,
          arabicaPercentage: updatedArabica,
          websiteUrl: updatedWebsiteUrl
        };
        if (newImageUrl !== undefined) {
          masterPayload.imageUrl = newImageUrl;
        }
        await updateBeanMasterData(item.beans.id, masterPayload);
      }

      if (result.success) {
        modalProcessedImageFile = null;
        if (modalFileInput) modalFileInput.value = '';
        modal.classList.add('hidden');
        await loadAndRenderBeans();
      } else {
        alert('Fehler beim Aktualisieren: ' + result.error);
      }
    });
  }

  // Bohne löschen
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
 * Öffnet das Modal und befüllt alle Felder
 */
/**
 * Öffnet das Modal im Read-Only Ansichtsmodus und befüllt alle Felder
 */
function openDetailModal(configId) {
  const item = userBeansData.find(b => b.id === configId);
  if (!item) return;

  const bean = item.beans || {};
  const modal = document.getElementById('detail-modal');

  // 1. Standardmäßig immer im Ansichtsmodus (Read-Only) starten
  const viewModeEl = document.getElementById('modal-view-mode');
  const editForm = document.getElementById('edit-bean-form');
  const btnEnableEdit = document.getElementById('btn-enable-edit');

  if (viewModeEl) viewModeEl.classList.remove('hidden');
  if (editForm) editForm.classList.add('hidden');
  if (btnEnableEdit) btnEnableEdit.classList.remove('hidden');

  // Inputs im Edit-Formular zurücksetzen
  modalProcessedImageFile = null;
  const modalFileInput = document.getElementById('modal-bean-image-input');
  if (modalFileInput) modalFileInput.value = '';

  // Header & Stammdaten
  document.getElementById('edit-config-id').value = item.id;
  document.getElementById('modal-roaster').textContent = bean.roaster || '';
  document.getElementById('modal-bean-name').textContent = bean.name || '';

  // Website-Link Button
  const websiteContainer = document.getElementById('modal-website-container');
  const websiteBtn = document.getElementById('modal-website-btn');
  const editWebsiteInput = document.getElementById('edit-website');

  if (bean.website_url && websiteContainer && websiteBtn) {
    websiteBtn.href = bean.website_url;
    websiteContainer.classList.remove('hidden');
  } else if (websiteContainer) {
    websiteContainer.classList.add('hidden');
  }
  if (editWebsiteInput) editWebsiteInput.value = bean.website_url || '';

  // Packungsfoto
  const previewBox = document.getElementById('modal-image-preview-box');
  const currentPreviewImg = document.getElementById('modal-image-current-preview');
  const headerImgContainer = document.getElementById('modal-image-container');
  const headerImgEl = document.getElementById('modal-bean-image');

  if (bean.image_url) {
    if (currentPreviewImg) currentPreviewImg.src = bean.image_url;
    if (previewBox) previewBox.classList.remove('hidden');
    if (headerImgEl) headerImgEl.src = bean.image_url;
    if (headerImgContainer) headerImgContainer.classList.remove('hidden');
  } else {
    if (previewBox) previewBox.classList.add('hidden');
    if (headerImgContainer) headerImgContainer.classList.add('hidden');
  }

  // --- READ-ONLY ANSICHT BEFÜLLEN (#modal-view-mode) ---
  const viewStatus = document.getElementById('view-status-badge');
  if (viewStatus) viewStatus.textContent = item.status === 'wishlist' ? '📋 Wunschliste' : '📦 Im Bestand';

  const viewRoast = document.getElementById('view-roast-badge');
  if (viewRoast) viewRoast.textContent = bean.roast_level || 'Medium';

  const arabicaVal = (bean && bean.arabica_percentage !== undefined && bean.arabica_percentage !== null) ? bean.arabica_percentage : 100;
  const viewBlend = document.getElementById('view-blend-badge');
  if (viewBlend) viewBlend.textContent = formatBlendText(arabicaVal);

  const viewScore = document.getElementById('view-score-badge');
  if (item.personal_score) {
    viewScore.textContent = `⭐ ${formatNumberDisplay(item.personal_score, 1)}`;
    viewScore.classList.remove('hidden');
  } else {
    viewScore.classList.add('hidden');
  }

  // Tasting Notes Read-Only Liste
  const viewNotesList = document.getElementById('view-tasting-notes-list');
  if (viewNotesList) {
    if (bean.tasting_notes && bean.tasting_notes.length > 0) {
      viewNotesList.innerHTML = bean.tasting_notes.map(note => `
        <span class="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border">
          ${escapeHtml(note)}
        </span>
      `).join('');
      document.getElementById('view-tasting-notes-container').classList.remove('hidden');
    } else {
      document.getElementById('view-tasting-notes-container').classList.add('hidden');
    }
  }

  // Extraktions-Parameter Read-Only
  document.getElementById('view-single-grind').textContent = item.single_grind_size ? formatNumberDisplay(item.single_grind_size, 1) : '-';
  document.getElementById('view-single-details').textContent = `${formatNumberDisplay(item.single_yield_out)}g | ${formatNumberDisplay(item.single_time_sec, 0)}s`;

  document.getElementById('view-double-grind').textContent = item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : '-';
  document.getElementById('view-double-details').textContent = `${formatNumberDisplay(item.double_yield_out)}g | ${formatNumberDisplay(item.double_time_sec, 0)}s`;

  // --- FORMULAR-FELDER BEFÜLLEN FOR EDIT MODE ---
  document.getElementById('edit-status').value = item.status || 'inventory';
  document.getElementById('edit-score').value = item.personal_score ? formatNumberDisplay(item.personal_score, 1) : '';

  const editSlider = document.getElementById('edit-arabica-slider');
  const editDisplay = document.getElementById('edit-blend-display');
  if (editSlider) editSlider.value = arabicaVal;
  if (editDisplay) editDisplay.textContent = formatBlendText(arabicaVal);

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
    if (!presetTags.includes(note)) customNotes.push(note);
  });

  const customNotesEl = document.getElementById('edit-custom-notes');
  if (customNotesEl) customNotesEl.value = customNotes.join(', ');

  document.getElementById('edit-single-grind').value = item.single_grind_size ? formatNumberDisplay(item.single_grind_size, 1) : '';
  document.getElementById('edit-single-yield').value = item.single_yield_out ? formatNumberDisplay(item.single_yield_out, 1) : '';
  document.getElementById('edit-single-time').value = item.single_time_sec ? formatNumberDisplay(item.single_time_sec, 0) : '';

  document.getElementById('edit-double-grind').value = item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : '';
  document.getElementById('edit-double-yield').value = item.double_yield_out ? formatNumberDisplay(item.double_yield_out, 1) : '';
  document.getElementById('edit-double-time').value = item.double_time_sec ? formatNumberDisplay(item.double_time_sec, 0) : '';

  modal.classList.remove('hidden');

  // Innerhalb von openDetailModal(configId) am Ende einfügen:
  if (item && item.beans) {
    fetchPacksAndLogsForBean(item.beans.id).then(res => {
      if (res.success && res.data) {
        // Diagramm rendern
        renderGrindChart('grind-chart', res.data);

        // Historische Empfehlung berechnen & anzeigen
        const recText = calculateHistoricalRecommendation(res.data);
        const recBox = document.getElementById('historical-recommendation-text');
        if (recBox) recBox.textContent = recText;
      }
    });
  }
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

/**
 * Wandelt einen Prozentwert für Arabica in lesbaren Text um.
 */
function formatBlendText(arabicaVal) {
  let arabica = parseInt(arabicaVal, 10);
  
  if (isNaN(arabica)) {
    arabica = 100;
  }

  arabica = Math.max(0, Math.min(100, arabica));
  const robusta = 100 - arabica;

  if (arabica === 100) return '100% Arabica';
  if (arabica === 0) return '100% Robusta';
  return `${arabica}% Arabica / ${robusta}% Robusta`;
}

/**
 * Steuert die Live-Textanzeige bei Bewegung der Schieberegler
 */
function initBlendSliderHandler() {
  const addSlider = document.getElementById('bean-arabica-slider');
  const addDisplay = document.getElementById('bean-blend-display');

  if (addSlider && addDisplay) {
    addSlider.addEventListener('input', (e) => {
      addDisplay.textContent = formatBlendText(e.target.value);
    });
  }

  const editSlider = document.getElementById('edit-arabica-slider');
  const editDisplay = document.getElementById('edit-blend-display');

  if (editSlider && editDisplay) {
    editSlider.addEventListener('input', (e) => {
      editDisplay.textContent = formatBlendText(e.target.value);
    });
  }
}
