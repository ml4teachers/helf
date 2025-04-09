export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Für Entwicklung okay, für Produktion spezifischer!
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS, DELETE', // Füge alle benötigten Methoden hinzu
}; 