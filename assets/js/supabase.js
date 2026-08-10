/**
 * BOHNENSCHMIEDE - SUPABASE DATABASE CLIENT
 */

// Ersetze diese beiden Werte mit deinen Daten aus dem Supabase Dashboard:
const SUPABASE_URL = https://vlkovdijnyllqhfpbosv.supabase.co; 
const SUPABASE_PUBLISHABLE_KEY = sb_publishable_Bsm5tsPl3xTvwEAYotW35A_ppzRwVd5; 

// Client-Initialisierung mit dem Publishable Key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/**
 * Lädt ein Bild-File oder Blob in den Supabase Storage Bucket 'bean-images' hoch
 * und gibt die öffentliche Bild-URL zurück.
 */
async function uploadBeanImage(fileOrBlob) {
  try {
    const fileExt = fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `beans/${fileName}`;

    const { data, error } = await supabase.storage
      .from('bean-images')
      .upload(filePath, fileOrBlob, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
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

    // Falls ein Bild übergeben wurde: Zuerst in den Supabase Storage hochladen
    if (formData.imageFile) {
      imageUrl = await uploadBeanImage(formData.imageFile);
    }

    // A) In Tabelle 'beans' (Stammdaten) eintragen
    const { data: beanData, error: beanError } = await supabase
      .from('beans')
      .insert([{
        name: formData.name,
        roaster: formData.roaster,
        roast_level: formData.roastLevel,
        tasting_notes: formData.tastingNotes,
        image_url: imageUrl
      }])
      .select()
      .single();

    if (beanError) throw beanError;

    // B) In Tabelle 'user_bean_configs' (Private Parameter & Dial-In) eintragen
    const { data: configData, error: configError } = await supabase
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

    if (configError) throw configError;

    return { success: true, bean: beanData };
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    return { success: false, error: error.message };
  }
}
/**
 * Lädt alle Bohnen und zugehörigen Konfigurationen des Nutzers aus Supabase.
 */
async function fetchUserBeans() {
  try {
    const { data, error } = await supabase
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
 * Ändert den Pin-Status (Pinned / Unpinned) einer Bohne.
 * Prüft vorab, dass maximal 3 Bohnen gleichzeitig angepinnt sein können.
 */
async function togglePinStatus(configId, newPinnedState) {
  try {
    // Wenn angepinnt werden soll: Prüfe, wie viele Bohnen bereits angepinnt sind
    if (newPinnedState) {
      const { data: currentPinned, error: countError } = await supabase
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

    // Status in der Datenbank aktualisieren
    const { data, error } = await supabase
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
 * Aktualisiert eine bestehende Bohnen-Konfiguration in Supabase.
 */
async function updateUserBeanConfig(configId, updatedData) {
  try {
    const { data, error } = await supabase
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
 * Löscht eine Bohnen-Konfiguration des Nutzers.
 */
async function deleteUserBeanConfig(configId) {
  try {
    const { error } = await supabase
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
