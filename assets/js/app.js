/**
 * BOHNENSPEICHER - MAIN APP CONTROLLER
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
        websiteUrl: websiteUrlInput,
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
 * Rendert Hero-Kacheln (Angepinnt) mit dynamischen Score- & Röstgrad-Badges
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
      <div class="frosted-glass p-4 rounded-xl border border-dashed border-slate-300 text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 12V4a1 1 0 00-1-1H9a1 1 0 00-1 1v8l-2 2v2h5v4l1 1 1-1v-4h5v-2l-2-2z"/>
        </svg>
        <span>Keine aktive Bohne angepinnt. Klicke bei einer Bohne im Bestand auf das Pin-Symbol, um sie hier oben anzuheften.</span>
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
              <button onclick="handlePinToggle('${item.id}', false)" title="Entpinnen" class="p-1 text-slate-900 hover:opacity-75">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4a1 1 0 00-1-1H9a1 1 0 00-1 1v8l-2 2v2h5v4l1 1 1-1v-4h5v-2l-2-2z"/></svg>
              </button>
            </div>

            <!-- Dynamisch farbige Badges -->
            <div class="flex flex-wrap gap-1 mt-1">
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRoastBadgeClass(bean.roast_level)}">
                ${escapeHtml(bean.roast_level || 'Medium')}
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 rounded text-amber-800 border border-amber-200">
                ${formatBlendText((bean && bean.arabica_percentage !== null && bean.arabica_percentage !== undefined) ? bean.arabica_percentage : 100)}
              </span>
              ${item.personal_score ? `
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded border ${getScoreBadgeClass(item.personal_score)}">
                  ⭐ ${formatNumberDisplay(item.personal_score, 1)}
                </span>
              ` : ''}
            </div>

            <!-- Tasting Notes -->
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
 * Rendert Bestands-Kacheln mit dynamisch farbigen Badges
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
        
        <div class="flex gap-3 items-start">
          ${bean.image_url ? `
            <div onclick="openDetailModal('${item.id}')" 
                 class="w-16 h-20 flex-shrink-0 bg-slate-100/60 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-lab-border/60 cursor-pointer">
              <img src="${escapeHtml(bean.image_url)}" alt="${escapeHtml(bean.name)}" class="max-h-full max-w-full object-contain filter drop-shadow-md">
            </div>
          ` : ''}

          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start gap-1">
              <div onclick="openDetailModal('${item.id}')" class="cursor-pointer min-w-0 flex-1">
                <span class="text-[10px] font-mono uppercase text-slate-400 truncate block">${escapeHtml(bean.roaster)}</span>
                <h4 class="text-sm font-bold text-slate-900 leading-tight hover:underline truncate">${escapeHtml(bean.name)}</h4>
              </div>
              
              <button onclick="handlePinToggle('${item.id}', ${!item.is_pinned})" 
                      title="${item.is_pinned ? 'Entpinnen' : 'Oben anpinnen'}"
                      class="p-1 rounded hover:bg-slate-100 flex-shrink-0 ${item.is_pinned ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}">
                <svg class="w-4 h-4" fill="${item.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 12V4a1 1 0 00-1-1H9a1 1 0 00-1 1v8l-2 2v2h5v4l1 1 1-1v-4h5v-2l-2-2z"/></svg>
              </button>
            </div>

            <!-- Dynamisch farbige Badges -->
            <div class="flex flex-wrap gap-1 mt-1.5">
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded border ${getRoastBadgeClass(bean.roast_level)}">
                ${escapeHtml(bean.roast_level || 'Medium')}
              </span>
              <span class="text-[9px] font-mono px-1.5 py-0.5 bg-amber-50 rounded text-amber-800 border border-amber-200">
                ${formatBlendText((bean && bean.arabica_percentage !== null && bean.arabica_percentage !== undefined) ? bean.arabica_percentage : 100)}
              </span>
              ${item.personal_score ? `
                <span class="text-[9px] font-mono px-1.5 py-0.5 rounded border ${getScoreBadgeClass(item.personal_score)}">
                  ⭐ ${formatNumberDisplay(item.personal_score, 1)}
                </span>
              ` : ''}
            </div>

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

    // 2. Klick auf "Neuen Bezug loggen"
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

  // SCORE STEPPER & VALIDIERUNG
  const scoreInput = document.getElementById('edit-score');
  const btnMinus = document.getElementById('btn-score-minus');
  const btnPlus = document.getElementById('btn-score-plus');
  const warningMsg = document.getElementById('score-warning-msg');

  function validateAndAdjustScore() {
    if (!scoreInput) return;
    let valStr = scoreInput.value.replace(',', '.').trim();
    if (valStr === '') {
      if (warningMsg) warningMsg.classList.add('hidden');
      return;
    }

    let val = parseFloat(valStr);
    if (isNaN(val)) return;

    if (val > 10.0) {
      scoreInput.value = '10,0';
      if (warningMsg) warningMsg.classList.remove('hidden');
    } else if (val < 0) {
      scoreInput.value = '0,0';
      if (warningMsg) warningMsg.classList.add('hidden');
    } else {
      if (warningMsg) warningMsg.classList.add('hidden');
    }
  }

  if (scoreInput) {
    scoreInput.addEventListener('blur', validateAndAdjustScore);
  }

  if (btnMinus && scoreInput) {
    btnMinus.addEventListener('click', () => {
      let current = parseFloat(scoreInput.value.replace(',', '.')) || 0;
      let next = Math.max(0, current - 0.5);
      scoreInput.value = formatNumberDisplay(next, 1);
      validateAndAdjustScore();
    });
  }

  if (btnPlus && scoreInput) {
    btnPlus.addEventListener('click', () => {
      let current = parseFloat(scoreInput.value.replace(',', '.')) || 0;
      let next = Math.min(10, current + 0.5);
      scoreInput.value = formatNumberDisplay(next, 1);
      validateAndAdjustScore();
    });
  }

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

  // Submit: Bezug bearbeiten
  const editShotForm = document.getElementById('edit-shot-form');
  const editShotModal = document.getElementById('edit-shot-modal');
  const editShotCloseBtn = document.getElementById('edit-shot-close-btn');

  if (editShotCloseBtn && editShotModal) {
    editShotCloseBtn.addEventListener('click', () => editShotModal.classList.add('hidden'));
  }

  if (editShotForm) {
    editShotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const logId = document.getElementById('edit-shot-id').value;
      const configId = document.getElementById('edit-config-id').value;

      const updatedData = {
        grindSize: document.getElementById('edit-shot-grind').value,
        timeSec: document.getElementById('edit-shot-time').value,
        notes: document.getElementById('edit-shot-notes').value
      };

      const res = await updateShotLogInDatabase(logId, updatedData);
      if (res.success) {
        editShotModal.classList.add('hidden');
        openDetailModal(configId);
      } else {
        alert('Fehler beim Aktualisieren: ' + res.error);
      }
    });
  }

  // Submit: Packung bearbeiten
  const editPackForm = document.getElementById('edit-pack-form');
  const editPackModal = document.getElementById('edit-pack-modal');
  const editPackCloseBtn = document.getElementById('edit-pack-close-btn');

  if (editPackCloseBtn && editPackModal) {
    editPackCloseBtn.addEventListener('click', () => editPackModal.classList.add('hidden'));
  }

  if (editPackForm) {
    editPackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const packId = document.getElementById('edit-pack-id').value;
      const configId = document.getElementById('edit-config-id').value;

      const updatedData = {
        packName: document.getElementById('edit-pack-name').value,
        roastDate: document.getElementById('edit-pack-roast-date').value
      };

      const res = await updateBeanPackInDatabase(packId, updatedData);
      if (res.success) {
        editPackModal.classList.add('hidden');
        openDetailModal(configId);
      } else {
        alert('Fehler beim Aktualisieren: ' + res.error);
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
      const updatedRoastLevel = document.getElementById('edit-roast') ? document.getElementById('edit-roast').value : 'Medium';

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
          websiteUrl: updatedWebsiteUrl,
          roastLevel: updatedRoastLevel
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
 * Öffnet das Modal im Read-Only Ansichtsmodus und befüllt alle Felder
 */
function openDetailModal(configId) {
  const item = userBeansData.find(b => b.id === configId);
  if (!item) return;

  const bean = item.beans || {};
  const modal = document.getElementById('detail-modal');

  const arabicaVal = (bean && bean.arabica_percentage !== undefined && bean.arabica_percentage !== null) ? bean.arabica_percentage : 100;

  const viewModeEl = document.getElementById('modal-view-mode');
  const editForm = document.getElementById('edit-bean-form');
  const btnEnableEdit = document.getElementById('btn-enable-edit');

  if (viewModeEl) viewModeEl.classList.remove('hidden');
  if (editForm) editForm.classList.add('hidden');
  if (btnEnableEdit) btnEnableEdit.classList.remove('hidden');

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

  // READ-ONLY ANSICHT BEFÜLLEN
  const viewStatus = document.getElementById('view-status-badge');
  if (viewStatus) {
    const isWishlist = item.status === 'wishlist';
    viewStatus.innerHTML = isWishlist
      ? `<svg class="w-3.5 h-3.5 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg><span>Wunschliste</span>`
      : `<svg class="w-3.5 h-3.5 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><span>Im Bestand</span>`;
  }

  // Röstgrad Badge
  const viewRoast = document.getElementById('view-roast-badge');
  if (viewRoast) {
    viewRoast.textContent = bean.roast_level || 'Medium';
    viewRoast.className = `text-xs font-mono px-2 py-1 rounded border ${getRoastBadgeClass(bean.roast_level)}`;
  }

  // Blend Text
  const viewBlend = document.getElementById('view-blend-badge');
  if (viewBlend) viewBlend.textContent = formatBlendText(arabicaVal);

  // Score Badge
  const viewScore = document.getElementById('view-score-badge');
  if (item.personal_score) {
    viewScore.textContent = `⭐ ${formatNumberDisplay(item.personal_score, 1)}`;
    viewScore.className = `text-xs font-mono px-2 py-1 rounded border ${getScoreBadgeClass(item.personal_score)}`;
    viewScore.classList.remove('hidden');
  } else {
    viewScore.classList.add('hidden');
  }

  // Tasting Notes
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

  // Extraktions-Parameter
  document.getElementById('view-single-grind').textContent = item.single_grind_size ? formatNumberDisplay(item.single_grind_size, 1) : '-';
  document.getElementById('view-single-details').textContent = `${formatNumberDisplay(item.single_yield_out)}g | ${formatNumberDisplay(item.single_time_sec, 0)}s`;

  document.getElementById('view-double-grind').textContent = item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : '-';
  document.getElementById('view-double-details').textContent = `${formatNumberDisplay(item.double_yield_out)}g | ${formatNumberDisplay(item.double_time_sec, 0)}s`;

  // EDIT-MODE FORMULAR-FELDER BEFÜLLEN
  document.getElementById('edit-status').value = item.status || 'inventory';
  document.getElementById('edit-score').value = item.personal_score ? formatNumberDisplay(item.personal_score, 1) : '';

  const editRoastInput = document.getElementById('edit-roast');
  if (editRoastInput) {
    editRoastInput.value = bean.roast_level || 'Medium';
  }

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

  // Diagramm & Historie laden
  if (item && item.beans) {
    fetchPacksAndLogsForBean(item.beans.id).then(res => {
      if (res.success && res.data) {
        if (typeof renderGrindChart === 'function') {
          renderGrindChart('grind-chart', res.data);
        }
        const recText = calculateHistoricalRecommendation(res.data);
        const recBox = document.getElementById('historical-recommendation-text');
        if (recBox) recBox.textContent = recText;

        renderPacksAndLogsHistory(res.data, configId);
      }
    });
  }

  modal.classList.remove('hidden');
}

/**
 * Berechnet die historische Trend-Analyse aus allen erfassten Packungen und Bezügen
 * @param {Array} packsData - Array der Packungen inklusive shot_logs
 * @returns {string} - Formulierte Trend-Empfehlung
 */
function calculateHistoricalRecommendation(packsData) {
  if (!packsData || packsData.length === 0) {
    return 'Lege eine erste Packung an und logge Bezüge, um eine Mahlgrad-Analyse zu erhalten.';
  }

  let allShots = [];
  packsData.forEach(pack => {
    if (pack.shot_logs && Array.isArray(pack.shot_logs)) {
      allShots = allShots.concat(pack.shot_logs);
    }
  });

  if (allShots.length < 2) {
    return 'Erfasse mindestens 2 Bezüge, um eine historische Trend-Analyse und Mahlgrad-Empfehlung zu berechnen.';
  }

  allShots.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const firstGrind = parseFloat(allShots[0].grind_size);
  const latestGrind = parseFloat(allShots[allShots.length - 1].grind_size);
  const diff = latestGrind - firstGrind;

  if (Math.abs(diff) < 0.2) {
    return `Der Mahlgrad ist über die letzten ${allShots.length} Bezüge konstant geblieben (~${latestGrind.toFixed(1)}). Die Extraktion verläuft stabil.`;
  } else if (diff < 0) {
    return `Trend: Der Mahlgrad wurde um ${Math.abs(diff).toFixed(1)} Stufen feiner gestellt (${firstGrind.toFixed(1)} → ${latestGrind.toFixed(1)}). Das entspricht dem typischen Entgasungsverhalten reifender Bohnen.`;
  } else {
    return `Trend: Der Mahlgrad wurde um ${diff.toFixed(1)} Stufen gröber gestellt (${firstGrind.toFixed(1)} → ${latestGrind.toFixed(1)}). Prüfe bei schnelleren Durchlaufzeiten Dosis und Tamping.`;
  }
}

/**
 * Rendert die Verwaltungsliste aller Packungen und Bezüge einer Bohne
 */
function renderPacksAndLogsHistory(packsData, configId) {
  const container = document.getElementById('packs-history-list');
  if (!container) return;

  if (!packsData || packsData.length === 0) {
    container.innerHTML = `
      <div class="text-xs font-mono text-slate-400 p-2 bg-slate-50 rounded border border-lab-border text-center">
        Noch keine Packungen angelegt.
      </div>
    `;
    return;
  }

  container.innerHTML = packsData.map(pack => {
    const logs = (pack.shot_logs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return `
      <div class="bg-slate-50/90 p-2.5 rounded-lg border border-lab-border space-y-2 text-xs font-mono">
        
        <!-- PACKUNG HEADER -->
        <div class="flex justify-between items-center bg-white p-1.5 rounded border border-lab-border/80">
          <div class="min-w-0 flex-1">
            <span class="font-bold text-slate-900 block truncate">${escapeHtml(pack.pack_name)}</span>
            <span class="text-[10px] text-slate-500">Röstung: ${pack.roast_date} ${pack.is_active ? ' (Aktiv)' : ''}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="openEditPackModal('${pack.id}', '${escapeHtml(pack.pack_name)}', '${pack.roast_date}')" 
                    title="Packung bearbeiten" class="p-1 hover:bg-slate-100 rounded text-slate-600">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onclick="handleDeletePack('${pack.id}', '${configId}')" 
                    title="Packung löschen" class="p-1 hover:bg-red-50 rounded text-red-600">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>

        <!-- BEZÜGE EINER PACKUNG -->
        ${logs.length > 0 ? `
          <div class="pl-2 space-y-1 border-l-2 border-slate-300">
            ${logs.map(log => {
              const days = calculateDaysSinceRoast(pack.roast_date, log.created_at);
              return `
                <div class="flex justify-between items-center bg-white/60 p-1.5 rounded text-[11px]">
                  <div class="min-w-0 flex-1">
                    <span class="font-bold text-slate-800">Tag ${days}:</span> 
                    <span>${formatNumberDisplay(log.grind_size, 1)} DF64</span> | 
                    <span>${log.time_sec}s</span>
                    ${log.notes ? `<span class="text-slate-400 block truncate text-[10px]">${escapeHtml(log.notes)}</span>` : ''}
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="openEditShotModal('${log.id}', '${log.grind_size}', '${log.time_sec}', '${escapeHtml(log.notes || '')}')" 
                            title="Bezug bearbeiten" class="p-1 hover:bg-slate-100 rounded text-slate-600">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button onclick="handleDeleteShot('${log.id}', '${configId}')" 
                            title="Bezug löschen" class="p-1 hover:bg-red-50 rounded text-red-600">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="text-[10px] text-slate-400 pl-2">Keine Bezüge für diese Packung geloggt.</div>
        `}
      </div>
    `;
  }).join('');
}

/**
 * Öffnet das Modal zum Bearbeiten eines Bezugs
 */
function openEditShotModal(logId, grind, time, notes) {
  document.getElementById('edit-shot-id').value = logId;
  document.getElementById('edit-shot-grind').value = grind;
  document.getElementById('edit-shot-time').value = time;
  document.getElementById('edit-shot-notes').value = notes;
  document.getElementById('edit-shot-modal').classList.remove('hidden');
}

/**
 * Öffnet das Modal zum Bearbeiten einer Packung
 */
function openEditPackModal(packId, name, roastDate) {
  document.getElementById('edit-pack-id').value = packId;
  document.getElementById('edit-pack-name').value = name;
  document.getElementById('edit-pack-roast-date').value = roastDate;
  document.getElementById('edit-pack-modal').classList.remove('hidden');
}

/**
 * Löscht einen Bezug nach Bestätigung
 */
async function handleDeleteShot(logId, configId) {
  if (confirm('Möchtest du diesen Bezug wirklich löschen?')) {
    const res = await deleteShotLogFromDatabase(logId);
    if (res.success) {
      openDetailModal(configId);
    } else {
      alert('Fehler beim Löschen: ' + res.error);
    }
  }
}

/**
 * Löscht eine Packung samt aller zugehörigen Bezüge nach Bestätigung
 */
async function handleDeletePack(packId, configId) {
  if (confirm('Möchtest du diese Packung und ALLE darin enthaltenen Bezüge wirklich löschen?')) {
    const res = await deleteBeanPackFromDatabase(packId);
    if (res.success) {
      openDetailModal(configId);
    } else {
      alert('Fehler beim Löschen der Packung: ' + res.error);
    }
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

function initSetupTab() {
  const exportBtn = document.getElementById('btn-export-csv');
  const importBtn = document.getElementById('btn-import-csv');
  const importInput = document.getElementById('csv-import-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportBeansToCSV(userBeansData));
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      const file = importInput.files[0];
      if (!file) {
        alert('Bitte wähle zuerst eine CSV-Datei aus.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        importBtn.disabled = true;
        importBtn.textContent = 'Importiere Daten...';

        const result = await importBeansFromCSV(text);
        
        importBtn.disabled = false;
        importBtn.textContent = 'CSV-Datei importieren';

        if (result.success) {
          alert(`${result.count} Bohnen erfolgreich importiert!`);
          importInput.value = '';
          await loadAndRenderBeans();
        } else {
          alert('Fehler beim Import: ' + result.error);
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
  }
}

/**
 * Registriert den Service Worker
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
 * Tag-Buttons (Neue Bohne)
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
 * Tag-Buttons (Edit Modal)
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
 * Wandelt Arabica-% in lesbaren Text um
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
 * Slider-Anzeige
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
