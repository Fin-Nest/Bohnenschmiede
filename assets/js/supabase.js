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
 * Aktualisiert die Stammdaten einer Bohne
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
 * Importiert Bohnen und Konfigurationen aus einer CSV-Datei mit robuster Key-Zuordnung
 */
async function importBeansFromCSV(csvText) {
  try {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) throw new Error('Die CSV-Datei ist leer oder enthält keine Datenzeilen.');

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const rawHeaders = parseCSVLine(lines[0], delimiter);

    let importedCount = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = parseCSVLine(line, delimiter).map(v => v.replace(/^"|"$/g, '').trim());
      const row = {};

      rawHeaders.forEach((header, idx) => {
        const normKey = normalizeCSVHeaderKey(header);
        row[normKey] = values[idx] || '';
      });

      // Flexible Suche nach Bohnennamen und Röster
      const beanName = row['bohnenname'] || row['name'] || row['bohne'] || row['bean'];
      const roaster = row['röster'] || row['roaster'] || row['roester'];

      if (!beanName || !roaster) {
        console.warn(`Zeile ${i + 1} übersprungen: Name oder Röster nicht gefunden.`, row);
        continue;
      }

      const tastingNotesRaw = row['tastingnotes'] || row['geschmacksnoten'] || row['notes'] || '';
      const tastingNotesArr = tastingNotesRaw 
        ? tastingNotesRaw.split(/[,;]/).map(n => n.trim()).filter(n => n.length > 0)
        : [];

      // 1. Bohne in 'beans' speichern
      const beanPayload = {
        name: beanName,
        roaster: roaster,
        roast_level: row['röstgrad'] || row['roastlevel'] || 'Medium',
        arabica_percentage: parseInt(row['arabica'] || row['arabicaprozent'] || '100', 10) || 100,
        tasting_notes: tastingNotesArr,
        website_url: row['website'] || row['link'] || null
      };

      const { data: beanData, error: beanErr } = await supabaseClient
        .from('beans')
        .insert([beanPayload])
        .select()
        .single();

      if (beanErr) {
        console.error(`Fehler beim Erstellen der Bohne "${beanName}":`, beanErr);
        errors.push(`${beanName}: ${beanErr.message}`);
        continue;
      }

      // 2. User Bean Config speichern
      const statusVal = (row['status'] || '').toLowerCase();
      const isWishlist = statusVal.includes('wunsch') || statusVal === 'wishlist';
      const scoreVal = row['score'] || row['bewertung110'] || row['bewertung'];

      const configPayload = {
        bean_id: beanData.id,
        status: isWishlist ? 'wishlist' : 'inventory',
        personal_score: scoreVal ? parseFlexibleNumber(scoreVal) : null,
        single_grind_size: row['singlemahlgrad'] ? parseFlexibleNumber(row['singlemahlgrad']) : null,
        single_yield_out: (row['singleyieldg'] || row['singleyield']) ? parseFlexibleNumber(row['singleyieldg'] || row['singleyield']) : null,
        single_time_sec: (row['singlezeits'] || row['singlezeit']) ? parseInt(row['singlezeits'] || row['singlezeit'], 10) : null,
        double_grind_size: row['doublemahlgrad'] ? parseFlexibleNumber(row['doublemahlgrad']) : null,
        double_yield_out: (row['doubleyieldg'] || row['doubleyield']) ? parseFlexibleNumber(row['doubleyieldg'] || row['doubleyield']) : null,
        double_time_sec: (row['doublezeits'] || row['doublezeit']) ? parseInt(row['doublezeits'] || row['doublezeit'], 10) : null
      };

      const { error: configErr } = await supabaseClient
        .from('user_bean_configs')
        .insert([configPayload]);

      if (configErr) {
        console.error(`Fehler bei Konfiguration von "${beanName}":`, configErr);
        errors.push(`${beanName} (Config): ${configErr.message}`);
      } else {
        importedCount++;
      }
    }

    if (importedCount === 0 && errors.length > 0) {
      return { success: false, error: errors.join(' | ') };
    }

    return { success: true, count: importedCount };
  } catch (error) {
    console.error('Fehler beim CSV-Import:', error);
    return { success: false, error: error.message };
  }
}
