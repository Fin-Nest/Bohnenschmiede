/**
 * BOHNENSCHMIEDE - UTILITY FUNCTIONS
 */

/**
 * Wandelt unstrukturierte Zahleneingaben (mit Komma oder Punkt) 
 * in eine gültige JavaScript-Gleitkommazahl (Float) um.
 * 
 * Beispiele:
 * "12,5" -> 12.5
 * "12.5" -> 12.5
 * "8"    -> 8.0
 */
function parseFlexibleNumber(input) {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  // Wandelt Strings um und ersetzt Komma durch Punkt
  const sanitized = String(input).replace(',', '.').trim();
  const parsed = parseFloat(sanitized);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Formatiert eine Zahl für die deutsche Anzeige mit Komma.
 * 
 * Beispiele:
 * 12.5 -> "12,5"
 * 21.0 -> "21,0"
 */
function formatNumberDisplay(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return Number(value).toFixed(decimals).replace('.', ',');
}
/**
 * Generiert eine CSV-Datei aus den Bohnen-Daten und startet den Download im Browser.
 * Nutzt Semikolons (;) als Trenner und UTF-8 BOM für perfekte Excel-Kompatibilität.
 */
function exportBeansToCSV(beansList) {
  if (!beansList || beansList.length === 0) {
    alert('Keine Bohnendaten zum Exportieren vorhanden.');
    return;
  }

  // 1. Spalten-Headlines definieren
  const headers = [
    'Bohnenname',
    'Röster',
    'Röstgrad',
    'Status',
    'Bewertung (1-10)',
    'Single Mahlgrad (DF64)',
    'Single Yield (g)',
    'Single Zeit (s)',
    'Double Mahlgrad (DF64)',
    'Double Yield (g)',
    'Double Zeit (s)',
    'Erstellt am'
  ];

  // 2. Datenzeilen aufbauen
  const rows = beansList.map(item => {
    const bean = item.beans || {};
    return [
      escapeCSVField(bean.name),
      escapeCSVField(bean.roaster),
      escapeCSVField(bean.roast_level),
      escapeCSVField(item.status),
      escapeCSVField(item.personal_score ? formatNumberDisplay(item.personal_score, 1) : ''),
      escapeCSVField(item.single_grind_size ? formatNumberDisplay(item.single_grind_size, 1) : ''),
      escapeCSVField(item.single_yield_out ? formatNumberDisplay(item.single_yield_out, 1) : ''),
      escapeCSVField(item.single_time_sec ? formatNumberDisplay(item.single_time_sec, 0) : ''),
      escapeCSVField(item.double_grind_size ? formatNumberDisplay(item.double_grind_size, 1) : ''),
      escapeCSVField(item.double_yield_out ? formatNumberDisplay(item.double_yield_out, 1) : ''),
      escapeCSVField(item.double_time_sec ? formatNumberDisplay(item.double_time_sec, 0) : ''),
      escapeCSVField(item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '')
    ].join(';');
  });

  // 3. Header und Datenzeilen zusammenfügen (mit Windows-Zeilenumbrüchen \r\n)
  const csvContent = [headers.join(';'), ...rows].join('\r\n');

  // 4. \uFEFF ist das UTF-8 Byte Order Mark (BOM) für korrekte Umlaute in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 5. Dateiname mit tagesaktuellem Datum erzeugen
  const today = new Date().toISOString().split('T')[0];
  const fileName = `bohnenschmiede_export_${today}.csv`;

  // 6. Unsichtbaren Link erzeugen und Klick simulieren
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  
  // Aufräumen
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Hilfsfunktion: Umschließt Felder mit Anführungszeichen und verdoppelt bestehende Anführungszeichen
 */
function escapeCSVField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}
