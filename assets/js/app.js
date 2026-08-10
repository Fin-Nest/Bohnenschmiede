/**
 * BOHNENSCHMIEDE - MAIN APP CONTROLLER
 */

// Globale Variable für den lokalen Speicher der geladenen Bohnen
let userBeansData = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initAddBeanForm();
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
    button.addEventListener('click', () => {
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

      // Beim Wechsel auf das Dashboard Daten neu laden
      if (targetTab === 'dashboard') {
        loadAndRenderBeans();
      }
    });
  });
}

/**
 * Formular-Event-Listener für "Neue Bohne"
 */
function initAddBeanForm() {
  const form = document.getElementById('add-bean-form');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        status: form.querySelector('input[name="status"]:checked').value,
        name: document.getElementById('bean-name').value,
        roaster: document.getElementById('bean-roaster').value,
        roastLevel: document.getElementById('bean-roast').value,
        
        singleGrind: document.getElementById('single-grind').value,
        singleYield: document.getElementById('single-yield').value,
        singleTime: document.getElementById('single-time').value,
        
        doubleGrind: document.getElementById('double-grind').value,
        doubleYield: document.getElementById('double-yield').value,
        doubleTime: document.getElementById('double-time').value,
      };

      const result = await saveBeanToDatabase(formData);
      
      if (result.success) {
        alert('Bohne erfolgreich gespeichert!');
        form.reset();
        document.querySelector('[data-tab="dashboard"]').click();
      } else {
        alert('Fehler beim Speichern: ' + result.error);
      }
    });
  }
}

/**
 * Lädt die Bohnen aus Supabase und rendert Hero-Bereich (Pinned) sowie Bestand
 */
async function loadAndRenderBeans() {
  const response = await fetchUserBeans();

  if (!response.success) {
    console.error('Bohnen konnten nicht geladen werden.');
    return;
  }

  userBeansData = response.data || [];
  
  // 1. Pinned Beans Filtern (Aktuell in Benutzung, status = 'active' oder is_pinned = true)
  const pinnedBeans = userBeansData.filter(item => item.is_pinned);
  
  // 2. Bestands-Bohnen Filtern (Status 'inventory')
  const inventoryBeans = userBeansData.filter(item => item.status === 'inventory');

  renderPinnedBeans(pinnedBeans);
  renderInventoryBeans(inventoryBeans);
}

/**
 * Rendert die Hero-Kacheln für morgens (Aktuell in Benutzung)
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
        Keine aktive Bohne angepinnt. Klicke bei einer Bohne im Bestand auf 📌, um den DF64-Mahlgrad hier sofort abzulesen.
      </div>
    `;
    return;
  }

  container.innerHTML = pinnedList.map(item => {
    const bean = item.beans;
    return `
      <div class="frosted-glass p-4 rounded-xl border border-slate-900 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-start mb-2">
          <div>
            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">${escapeHtml(bean.roaster)}</span>
            <h3 class="text-base font-bold text-slate-900">${escapeHtml(bean.name)}</h3>
          </div>
          <button onclick="handlePinToggle('${item.id}', false)" title="Gepinnt entfernen" class="text-base p-1 hover:opacity-75">
            📌
          </button>
        </div>

        <!-- DF64 Quick Readout Grid -->
        <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-lab-border">
          <!-- Single Shot -->
          <div class="bg-white/80 p-2 rounded border border-lab-border">
            <span class="text-[10px] font-mono text-slate-500 block uppercase">Single (8g)</span>
            <div class="text-lg font-mono font-bold text-slate-900">
              ${formatNumberDisplay(item.single_grind_size)} <span class="text-xs font-normal text-slate-500">DF64</span>
            </div>
            <div class="text-[11px] font-mono text-slate-500">
              ${formatNumberDisplay(item.single_yield_out)}g | ${formatNumberDisplay(item.single_time_sec, 0)}s
            </div>
          </div>

          <!-- Double Shot -->
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
 * Rendert das Kachel-Raster für den gesamten Bohnen-Bestand
 */
function renderInventoryBeans(inventoryList) {
  const container = document.getElementById('inventory-container');
  if (!container) return;

  if (inventoryList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full frosted-glass p-6 rounded-xl text-center text-slate-400 text-sm">
        Noch keine Bohnen im Bestand. Erfasse eine neue Bohne über das [➕ Neu] Menü.
      </div>
    `;
    return;
  }

  container.innerHTML = inventoryList.map(item => {
    const bean = item.beans;
    return `
      <div class="frosted-glass p-3.5 rounded-xl border border-lab-border flex flex-col justify-between space-y-3">
        <div>
          <div class="flex justify-between items-start">
            <span class="text-[10px] font-mono uppercase text-slate-400 truncate max-w-[130px]">${escapeHtml(bean.roaster)}</span>
            <button onclick="handlePinToggle('${item.id}', ${!item.is_pinned})" 
                    title="${item.is_pinned ? 'Entpinnen' : 'Oben anpinnen'}"
                    class="text-xs p-1 rounded hover:bg-slate-100 ${item.is_pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'}">
              📌
            </button>
          </div>
          <h4 class="text-sm font-bold text-slate-900 leading-tight">${escapeHtml(bean.name)}</h4>
          <span class="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-lab-border">
            ${escapeHtml(bean.roast_level || 'Medium')}
          </span>
        </div>

        <!-- DF64 Mini Parameters -->
        <div class="bg-white/60 p-2 rounded border border-lab-border/60 text-xs font-mono space-y-1">
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
 * Event-Handler für das Anpinnen / Entpinnen
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
 * Hilfsfunktion zum Schutz vor XSS in Textausgaben
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
