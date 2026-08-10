/**
 * BOHNENSCHMIEDE - MAIN APP CONTROLLER
 */

// Haupt-Initialisierung, sobald das HTML vollständig geladen ist
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initAddBeanForm();
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

      // Alle Abschnitte ausblenden
      Object.values(sections).forEach(section => {
        if (section) section.classList.add('hidden');
      });

      // Aktiven Abschnitt einblenden
      if (sections[targetTab]) {
        sections[targetTab].classList.remove('hidden');
      }

      // Button Highlighting aktualisieren
      navButtons.forEach(btn => {
        btn.classList.remove('text-slate-900', 'font-semibold');
        btn.classList.add('text-slate-500');
      });

      button.classList.remove('text-slate-500');
      button.classList.add('text-slate-900', 'font-semibold');
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

      // Formularwerte auslesen
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

      // In Supabase speichern
      const result = await saveBeanToDatabase(formData);
      
      if (result.success) {
        alert('Bohne erfolgreich gespeichert!');
        form.reset();
        // Wechsel zurück zum Dashboard
        document.querySelector('[data-tab="dashboard"]').click();
      } else {
        alert('Fehler beim Speichern: ' + result.error);
      }
    });
  }
}
