// src/lib/supabaseClient.ts
// Importiere den Standard-Client von supabase-js
import { createClient as createSupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
// Importiere das Secure Storage Plugin
import { SecureStorage } from '@aparajita/capacitor-secure-storage'; // Korrekter Importname

// Adapter mit SecureStorage (Angepasst mit Typ-Assertions)
const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof (SecureStorage as any)?.get !== 'function') { // Use type assertion
      console.warn('SecureStorage.get not available, falling back to localStorage.');
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    try {
      // Assert result type to handle potential null/DataType discrepancy
      const result: { value: string | null } = await (SecureStorage as any).get({ key: key });
      return result?.value ?? null; // Return value or null
    } catch (error) {
       console.error(`Error getting item ${key} from secure storage`, error);
       return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof (SecureStorage as any)?.set !== 'function') { // Use type assertion
       console.warn('SecureStorage.set not available, using localStorage.');
       if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value); }
       return;
    }
    try {
        await (SecureStorage as any).set({ key: key, value: value });
    } catch (error) {
        console.error(`Error setting item ${key} in secure storage`, error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
     if (typeof (SecureStorage as any)?.remove !== 'function') { // Use type assertion
        console.warn('SecureStorage.remove not available, using localStorage.');
        if (typeof localStorage !== 'undefined') { localStorage.removeItem(key); }
        return;
     }
     try {
         await (SecureStorage as any).remove({ key: key });
     } catch (error) {
         console.error(`Error removing item ${key} from secure storage`, error);
     }
  },
};

// Supabase Client Optionen KORRIGIERT (ohne ['global'])
const options: SupabaseClientOptions<'public'> = { // Typ direkt verwenden
  auth: {
    storage: secureStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,   // WICHTIG: Deaktivieren
  },
  // Ggf. globale Optionen hier hinzufügen, falls nötig
  // global: { ... }
};

// Client erstellen mit supabase-js Client
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase URL or Anon Key is missing. Check environment variables.");
      // Wirf einen Fehler oder gib einen nicht funktionalen Client zurück,
      // um auf das Konfigurationsproblem hinzuweisen.
      throw new Error("Supabase configuration is missing!");
  }

  return createSupabaseClient(
    supabaseUrl,
    supabaseAnonKey,
    options
  );
};

// Optional: Exportiere eine Singleton-Instanz, wenn du das bevorzugst
// export const supabase = createClient();

