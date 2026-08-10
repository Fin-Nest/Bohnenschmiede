/**
 * BOHNENSCHMIEDE - SUPABASE DATABASE CLIENT
 */

// Ersetze diese beiden Werte mit deinen Daten aus dem Supabase Dashboard:
const SUPABASE_URL = https://vlkovdijnyllqhfpbosv.supabase.co; 
const SUPABASE_PUBLISHABLE_KEY = 'sbp_dein_publishable_key_hier...'; 

// Client-Initialisierung mit dem Publishable Key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/**
 * Speichert eine neue Bohne und die zugehörigen User-Parameter
 */
async function saveBeanToDatabase(formData) {
  try {
    // A) In Tabelle 'beans' (Stammdaten) eintragen
    const { data: beanData, error: beanError } = await supabase
      .from('beans')
      .insert([{
        name: formData.name,
        roaster: formData.roaster,
        roast_level: formData.roastLevel,
        tasting_notes: formData.tastingNotes
      }])
      .select()
      .single();

    if (beanError) throw beanError;

    // B) In Tabelle 'user_bean_configs' (Private Parameter & Dial-In) eintragen
    // Wichtig: Hier greift parseFlexibleNumber für Komma/Punkt
    const { data: configData, error: configError } = await supabase
      .from('user_bean_configs')
      .insert([{
        bean_id: beanData.id,
        status: formData.status, // 'inventory' oder 'wishlist'
        
        // Single Shot Parameter (DF64)
        single_grind_size: parseFlexibleNumber(formData.singleGrind),
        single_yield_out: parseFlexibleNumber(formData.singleYield),
        single_time_sec: parseFlexibleNumber(formData.singleTime),
        
        // Double Shot Parameter (DF64)
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
