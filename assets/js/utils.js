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
