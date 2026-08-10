/**
 * BOHNENSCHMIEDE - MAIN APP CONTROLLER
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
});

/**
 * Steuerung der Bottom Navigation Bar
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
