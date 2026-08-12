/**
 * BOHNENSCHMIEDE - SUPABASE DATABASE CLIENT
 */

// 1. Supabase Zugangsdaten als saubere Strings
const SUPABASE_URL = 'https://vlkovdijnyllqhfpbosv.supabase.co'; 
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Bsm5tsPl3xTvwEAYotW35A_ppzRwVd5'; 

// 2. Client-Initialisierung
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/**
 * Lädt ein Bild-File oder Blob in den Supabase Storage Bucket 'bean-images' hoch
 */
async function uploadBeanImage(fileOrBlob) {
  try {
    const fileExt = fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `beans/${fileName}`;

    const { data, error } = await supabaseClient.storage
      .from('bean-images')
      .upload(filePath, fileOrBlob, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabaseClient.storage
      .from('bean-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Fehler beim Upload des Bildes:', error);
    throw error;
  }
}

/**
 * Speichert eine neue Bohne inkl. optionalem Foto, Link und User-Konfiguration
 */
async function saveBeanToDatabase(formData) {
  try {
    let imageUrl = null;

    if (formData.imageFile) {
      try {
        imageUrl = await uploadBeanImage(formData.imageFile);
      } catch (imgError) {
        console.warn('Bildupload fehlgeschlagen, speichere ohne Bild:', imgError);
      }
    }

    // A) In Tabelle 'beans' eintragen
    const { data: beanData, error: beanError } = await supabaseClient
      .from('beans')
      .insert([{
        name: formData.name,
        roaster: formData.roaster,
        roast_level: formData.roastLevel,
        arabica_percentage: formData.arabicaPercentage !== undefined ? formData.arabicaPercentage : 100,
        tasting_notes: formData.tastingNotes || [],
        image_url: imageUrl,
        website_url: formData.websiteUrl || null
      }])
      .select()
      .single();

    if (beanError) {
      console.error('Fehler bei Tabelle beans:', beanError);
      throw new Error(`Fehler beim Anlegen der Bohnen-Stammdaten: ${beanError.message}`);
    }

    // B) In Tabelle 'user_bean_configs' eintragen
    const { data: configData, error: configError } = await supabaseClient
      .from('user_bean_configs')
      .insert([{
        bean_id: beanData.id,
        status: formData.status,
        
        single_grind_size: parseFlexibleNumber(formData.singleGrind),
        single_yield_out: parseFlexibleNumber(formData.singleYield),
        single_time_sec: parseFlexibleNumber(formData.singleTime),
        
        double_grind_size: parseFlexibleNumber(formData.doubleGrind),
        double_yield_out: parseFlexibleNumber(formData.doubleYield),
        double_time_sec: parseFlexibleNumber(formData.doubleTime)
      }]);

    if (configError) {
      console.error('Fehler bei Tabelle user_bean_configs:', configError);
      throw new Error(`Fehler beim Speichern deiner Einstellungen: ${configError.message}`);
    }

    return { success: true, bean: beanData };
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lädt alle Bohnen und zugehörigen Konfigurationen des Nutzers aus Supabase
 */
async function fetchUserBeans() {
  try {
    const { data, error } = await supabaseClient
      .from('user_bean_configs')
      .select(`
        id,
        status,
        is_pinned,
        personal_score,
        single_grind_size,
        single_yield_out,
        single_time_sec,
        double_grind_size,
        double_yield_out,
        double_time_sec,
        beans (
          id,
          name,
          roaster,
          roast_level,
          arabica_percentage,
          tasting_notes,
          image_url,
          website_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Laden der Bohnen:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ändert den Pin-Status (Pinned / Unpinned) einer Bohne
 */
async function togglePinStatus(configId, newPinnedState) {
  try {
    if (newPinnedState) {
      const { data: currentPinned, error: countError } = await supabaseClient
        .from('user_bean_configs')
        .select('id')
        .eq('is_pinned', true);

      if (countError) throw countError;

      if (currentPinned && currentPinned.length >= 3) {
        return { 
          success: false, 
          error: 'Es können maximal 3 Bohnen gleichzeitig im Hero-Bereich angepinnt werden.' 
        };
      }
    }

    const { data, error } = await supabaseClient
      .from('user_bean_configs')
      .update({ is_pinned: newPinnedState })
      .eq('id', configId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Pin-Status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert eine bestehende Bohnen-Konfiguration in Supabase
 */
async function updateUserBeanConfig(configId, updatedData) {
  try {
    const { data, error } = await supabaseClient
      .from('user_bean_configs')
      .update({
        status: updatedData.status,
        personal_score: parseFlexibleNumber(updatedData.personalScore),
        single_grind_size: parseFlexibleNumber(updatedData.singleGrind),
        single_yield_out: parseFlexibleNumber(updatedData.singleYield),
        single_time_sec: parseFlexibleNumber(updatedData.singleTime),
        double_grind_size: parseFlexibleNumber(updatedData.doubleGrind),
        double_yield_out: parseFlexibleNumber(updatedData.doubleYield),
        double_time_sec: parseFlexibleNumber(updatedData.doubleTime)
      })
      .eq('id', configId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Konfiguration:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Löscht eine Bohnen-Konfiguration des Nutzers
 */
async function deleteUserBeanConfig(configId) {
  try {
    const { error } = await supabaseClient
      .from('user_bean_configs')
      .delete()
      .eq('id', configId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert die Stammdaten (Tasting Notes, Image URL, Mischung, Link & Röstgrad) einer Bohne
 */
async function updateBeanMasterData(beanId, masterData) {
  try {
    const updatePayload = {};
    
    if (masterData.tastingNotes !== undefined) {
      updatePayload.tasting_notes = masterData.tastingNotes;
    }
    if (masterData.imageUrl !== undefined) {
      updatePayload.image_url = masterData.imageUrl;
    }
    if (masterData.arabicaPercentage !== undefined) {
      updatePayload.arabica_percentage = masterData.arabicaPercentage;
    }
    if (masterData.websiteUrl !== undefined) {
      updatePayload.website_url = masterData.websiteUrl || null;
    }
    // ⬅️ NEU: Röstgrad in das Update-Payload aufnehmen
    if (masterData.roastLevel !== undefined) {
      updatePayload.roast_level = masterData.roastLevel;
    }

    const { data, error } = await supabaseClient
      .from('beans')
      .update(updatePayload)
      .eq('id', beanId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Bohnen-Stammdaten:', error);
    return { success: false, error: error.message };
  }
}
/**
 * Erstellt eine neue Packung für eine Bohne und setzt sie als aktiv
 */
async function createBeanPack(beanId, roastDate, packName = 'Neue Packung') {
  try {
    await supabaseClient
      .from('bean_packs')
      .update({ is_active: false })
      .eq('bean_id', beanId);

    const { data, error } = await supabaseClient
      .from('bean_packs')
      .insert([{
        bean_id: beanId,
        roast_date: roastDate,
        pack_name: packName,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Anlegen der Packung:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lädt alle Packungen inklusive aller zugehörigen Shot-Logs einer Bohne
 */
async function fetchPacksAndLogsForBean(beanId) {
  try {
    const { data, error } = await supabaseClient
      .from('bean_packs')
      .select(`
        id,
        pack_name,
        roast_date,
        is_active,
        created_at,
        shot_logs (
          id,
          grind_size,
          time_sec,
          notes,
          created_at
        )
      `)
      .eq('bean_id', beanId)
      .order('roast_date', { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Laden der Packungen und Logs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Speichert einen neuen Bezug (Shot Log)
 */
async function saveShotLog(packId, grindSize, timeSec, notes = '') {
  try {
    const { data, error } = await supabaseClient
      .from('shot_logs')
      .insert([{
        pack_id: packId,
        grind_size: parseFlexibleNumber(grindSize),
        time_sec: parseInt(timeSec, 10),
        notes: notes
      }])
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Speichern des Bezugs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Löscht ein einzelnes Bezugs-Protokoll
 */
async function deleteShotLogFromDatabase(logId) {
  try {
    const { error } = await supabaseClient
      .from('shot_logs')
      .delete()
      .eq('id', logId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Löschen des Bezugs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert ein fehlerhaftes Bezugs-Protokoll
 */
async function updateShotLogInDatabase(logId, updatedData) {
  try {
    const { data, error } = await supabaseClient
      .from('shot_logs')
      .update({
        grind_size: parseFlexibleNumber(updatedData.grindSize),
        time_sec: parseInt(updatedData.timeSec, 10),
        notes: updatedData.notes || ''
      })
      .eq('id', logId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Bezugs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Löscht eine Packung samt allen zugehörigen Bezügen
 */
async function deleteBeanPackFromDatabase(packId) {
  try {
    const { error } = await supabaseClient
      .from('bean_packs')
      .delete()
      .eq('id', packId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Löschen der Packung:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert Name oder Röstdatum einer Packung
 */
async function updateBeanPackInDatabase(packId, updatedData) {
  try {
    const { data, error } = await supabaseClient
      .from('bean_packs')
      .update({
        pack_name: updatedData.packName,
        roast_date: updatedData.roastDate
      })
      .eq('id', packId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Packung:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Zerlegt eine CSV-Zeile präzise unter Berücksichtigung von Anführungszeichen
 */
function parseCSVLine(text, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normalisiert Header-Namen für flexiblen CSV-Match
 */
function normalizeCSVHeaderKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}

/**
 * Importiert Bohnen aus einer CSV-Datei mit erweiterter Spalten-Toleranz
 * @param {string} csvText - Der rohe Textinhalt der CSV-Datei
 */
async function importBeansFromCSV(csvText) {
  try {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return { success: false, error: 'Die CSV-Datei enthält keine Datenzeilen.' };
    }

    // 1. Kopfzeile parsen & klein schreiben für flexible Zuordnung
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Hilfsfunktion zur flexiblen Spaltensuche
    const findIndex = (keywords) => {
      return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
    };

    // Spalten-Indizes dynamisch ermitteln
    const nameIdx = findIndex(['bohnenname', 'name', 'bean']);
    const roasterIdx = findIndex(['röster', 'roaster']);
    const roastIdx = findIndex(['röstgrad', 'roast']);
    const statusIdx = findIndex(['status']);
    const scoreIdx = findIndex(['bewertung', 'score']);

    // Dial-In Parameter mit flexibler Schlagwort-Erkennung
    const singleGrindIdx = findIndex(['single mahlgrad', 'single_grind', 'single grind']);
    const singleYieldIdx = findIndex(['single yield', 'single_yield']);
    const singleTimeIdx = findIndex(['single zeit', 'single time', 'single_time']);

    const doubleGrindIdx = findIndex(['double mahlgrad', 'double_grind', 'double grind']);
    const doubleYieldIdx = findIndex(['double yield', 'double_yield']);
    const doubleTimeIdx = findIndex(['double zeit', 'double time', 'double_time']);

    let successCount = 0;

    // 2. Zeilen iterieren und Daten an Supabase senden
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
      if (row.length === 0 || !row[nameIdx]) continue;

      const rawRoast = roastIdx !== -1 ? row[roastIdx] : 'Medium';
      // Röstgrad auf erste Großbuchstaben-Formatierung normieren (Light, Medium, Dark)
      const normalizedRoast = rawRoast ? rawRoast.charAt(0).toUpperCase() + rawRoast.slice(1).toLowerCase() : 'Medium';

      const formData = {
        name: row[nameIdx] || 'Unbekannte Bohne',
        roaster: roasterIdx !== -1 ? row[roasterIdx] : 'Unbekannter Röster',
        roastLevel: ['Light', 'Medium', 'Dark'].includes(normalizedRoast) ? normalizedRoast : 'Medium',
        status: statusIdx !== -1 && row[statusIdx] ? row[statusIdx].toLowerCase() : 'inventory',
        personalScore: scoreIdx !== -1 ? row[scoreIdx] : '',

        singleGrind: singleGrindIdx !== -1 ? row[singleGrindIdx] : '',
        singleYield: singleYieldIdx !== -1 ? row[singleYieldIdx] : '',
        singleTime: singleTimeIdx !== -1 ? row[singleTimeIdx] : '',

        doubleGrind: doubleGrindIdx !== -1 ? row[doubleGrindIdx] : '',
        doubleYield: doubleYieldIdx !== -1 ? row[doubleYieldIdx] : '',
        doubleTime: doubleTimeIdx !== -1 ? row[doubleTimeIdx] : ''
      };

      const res = await saveBeanToDatabase(formData);
      if (res.success) {
        successCount++;
      }
    }

    return { success: true, count: successCount };
  } catch (err) {
    console.error('Fehler beim CSV-Import:', err);
    return { success: false, error: err.message };
  }
}
