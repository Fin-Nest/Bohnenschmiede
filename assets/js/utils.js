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

let grindChartInstance = null;

/**
 * Berechnet die Tage zwischen Röstdatum und Bezugsdatum
 */
function calculateDaysSinceRoast(roastDateStr, shotDateStr) {
  const rDate = new Date(roastDateStr);
  const sDate = new Date(shotDateStr);
  const diffTime = sDate - rDate;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Rendert das Chart.js Liniendiagramm mit einer eigenen Linie pro Packung
 */
function renderGrindChart(canvasId, packsData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (grindChartInstance) {
    grindChartInstance.destroy();
  }

  const colors = ['#0f172a', '#d97706', '#2563eb', '#16a34a', '#dc2626', '#9333ea'];

  const datasets = packsData.map((pack, index) => {
    const sortedLogs = (pack.shot_logs || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const points = sortedLogs.map(log => ({
      x: calculateDaysSinceRoast(pack.roast_date, log.created_at),
      y: parseFloat(log.grind_size)
    }));

    const color = colors[index % colors.length];

    return {
      label: `${pack.pack_name} (Röstung: ${pack.roast_date})`,
      data: points,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  });

  grindChartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Tage seit Röstdatum', font: { family: 'JetBrains Mono', size: 10 } },
          ticks: { stepSize: 2, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          title: { display: true, text: 'DF64 Mahlgrad', font: { family: 'JetBrains Mono', size: 10 } },
          ticks: { font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      plugins: {
        legend: { labels: { font: { family: 'JetBrains Mono', size: 10 } } }
      }
    }
  });
}

/**
 * Berechnet den historischen Alterungstrend über alle bisherigen Packungen
 */
function calculateHistoricalRecommendation(packsData) {
  let totalDriftPerDay = 0;
  let packCountWithDrift = 0;

  packsData.forEach(pack => {
    const logs = (pack.shot_logs || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (logs.length >= 2) {
      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];
      
      const dayStart = calculateDaysSinceRoast(pack.roast_date, firstLog.created_at);
      const dayEnd = calculateDaysSinceRoast(pack.roast_date, lastLog.created_at);
      const dayDiff = dayEnd - dayStart;

      if (dayDiff > 0) {
        const grindDiff = parseFloat(lastLog.grind_size) - parseFloat(firstLog.grind_size);
        const driftPerDay = grindDiff / dayDiff;
        totalDriftPerDay += driftPerDay;
        packCountWithDrift++;
      }
    }
  });

  if (packCountWithDrift === 0) {
    return "Nötige Datenbasis wird aufgebaut. Logge mindestens 2 Bezüge über mehrere Tage, um historische Empfehlungen zu erhalten.";
  }

  const avgDriftPerDay = totalDriftPerDay / packCountWithDrift;
  const daysForHalfStep = Math.abs(Math.round(0.5 / (avgDriftPerDay || 0.001)));

  if (Math.abs(avgDriftPerDay) < 0.01) {
    return "Diese Bohnensorte verhält sich extrem stabil über die Lagerzeit. Kaum Mahlgradanpassung erforderlich.";
  } else if (avgDriftPerDay < 0) {
    return `Erfahrungswert aus ${packCountWithDrift} Packung(en): Bei dieser Bohne musst du etwa alle ${daysForHalfStep} Tage den Mahlgrad um 0,5 Stufen FEINER stellen.`;
  } else {
    return `Erfahrungswert aus ${packCountWithDrift} Packung(en): Bei dieser Bohne musst du etwa alle ${daysForHalfStep} Tage den Mahlgrad um 0,5 Stufen GRÖBER stellen.`;
  }
}
