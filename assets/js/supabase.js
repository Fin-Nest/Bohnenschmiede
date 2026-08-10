/**
 * BOHNENSCHMIEDE - SUPABASE DATABASE CLIENT
 */

// 1. Supabase Zugangsdaten als saubere Strings
const SUPABASE_URL = 'https://vlkovdijnyllqhfpbosv.supabase.co'; 
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Bsm5tsPl3xTvwEAYotW35A_ppzRwVd5'; 

// 2. Client-Initialisierung (Variable heißt 'supabaseClient', um Konflikte mit window.supabase zu vermeiden)
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
 * Speichert eine neue Bohne inkl. optionalem Foto und User-Konfiguration
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
        tasting_notes: formData.tastingNotes || [],
        image_url: imageUrl
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
          tasting_notes,
          image_url
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
