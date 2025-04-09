// src/components/dashboard/BodyweightCard.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { Database, BodyweightLog } from '@/lib/types' // Stelle sicher, dass BodyweightLog exportiert wird
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts' // Wird von shadcn/charts verwendet
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig, // Import ChartConfig
} from "@/components/ui/chart" // shadcn chart components

// --- TYPE für Chart Daten ---
type ChartDataPoint = BodyweightLog & { timestamp: number };

// Helper to format date for XAxis tick (takes timestamp now)
const formatDateTick = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('de-CH', { month: 'short', day: 'numeric' });
};

// Helper to format date string (YYYY-MM-DD) for display
const formatDisplayDate = (dateString: string): string => {
  try {
   const date = new Date(dateString);
   // Add day correction if needed due to timezone interpretation
   date.setUTCDate(date.getUTCDate() + 1);
   return date.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' }); // z.B. "28. März"
 } catch (e) {
   return dateString;
 }
}

// Chart configuration for colors etc. (adjust as needed)
const chartConfig = {
  weight: {
    label: "Weight (kg)",
    color: "hsl(var(--chart-1))", // Use theme color
  },
} satisfies ChartConfig;

// --- Custom Tooltip Content ---
const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint; // Get the full data point
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-1"> {/* Simple layout */}
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Date
            </span>
            <span className="font-bold">
                {/* Format original date string for tooltip */}
               {formatDisplayDate(data.log_date)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Weight
            </span>
             <span className="font-bold text-foreground">
                {data.weight} kg
             </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
// --- End Custom Tooltip ---

export function BodyweightCard() {
  // State now uses ChartDataPoint for logs
  const [logs, setLogs] = useState<ChartDataPoint[]>([])
  const [latestLog, setLatestLog] = useState<BodyweightLog | null>(null)
  const [currentWeightInput, setCurrentWeightInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setError("User not logged in.");
        setIsLoading(false);
        return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('bodyweight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false }) // Get latest first
        .limit(90)

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setLatestLog(data[0]);
        setCurrentWeightInput(data[0].weight?.toString() ?? '');
        // --- Convert date string to timestamp and reverse for chart ---
        const chartData = data.slice().reverse().map(log => ({
          ...log,
          // Parse YYYY-MM-DD as local date, then get timestamp
          // Adding 'T00:00:00' helps ensure consistent parsing
          timestamp: new Date(log.log_date + 'T00:00:00').getTime(),
        }));
        setLogs(chartData);
        // --- End Conversion ---
      } else {
        setLatestLog(null);
        setCurrentWeightInput('');
        setLogs([]);
      }
    } catch (err: any) {
      console.error('Error fetching bodyweight logs:', err);
      setError(err.message || 'Failed to load bodyweight data.');
      setLogs([]);
      setLatestLog(null);
    } finally {
       setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // handleUpdate bleibt unverändert (arbeitet weiter mit YYYY-MM-DD)
  const handleUpdate = async () => {
    const weightValue = parseFloat(currentWeightInput.replace(',', '.'));
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Please enter a valid positive weight.');
      return;
    }
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    setIsSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { /* ... */ return; }

    try {
      const { data: existingLog, error: findError } = await supabase
        .from('bodyweight_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('log_date', todayDate)
        .maybeSingle();

      if (findError) throw findError;

      let savedLog: BodyweightLog | null = null;
      if (existingLog) {
        const { data, error } = await supabase
          .from('bodyweight_logs')
          .update({ weight: weightValue, updated_at: new Date().toISOString() })
          .eq('id', existingLog.id)
          .select()
          .single();
        if (error) throw error;
        savedLog = data;
      } else {
        const { data, error } = await supabase
          .from('bodyweight_logs')
          .insert({ user_id: user.id, log_date: todayDate, weight: weightValue })
          .select()
          .single();
        if (error) throw error;
        savedLog = data;
      }
      console.log("Upsert successful:", savedLog);
      fetchLogs(); // Refetch data
    } catch (err: any) {
      console.error('Error saving bodyweight:', err);
      setError(err.message || 'Failed to save weight.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" /> Bodyweight
        </CardTitle>
         <CardDescription>Track your weight over time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
           <Label htmlFor="bodyweight-input">Current Weight (kg)</Label>
           <div className="grid grid-cols-2 space-y-2  space-x-2">
             <div className="flex-grow space-y-1">
               <Input
                 id="bodyweight-input"
                 type="number"
                 step="0.1"
                 value={currentWeightInput}
                 onChange={(e) => setCurrentWeightInput(e.target.value)}
                 placeholder={latestLog ? `Last: ${latestLog.weight} kg` : 'Enter weight'}
                 disabled={isSaving || isLoading}
                 className="w-full"
               />
               {latestLog && (
                 <p className="text-xs text-muted-foreground">
                    Last logged: {formatDisplayDate(latestLog.log_date)}
                 </p>
                )}
             </div>
             <Button onClick={handleUpdate} disabled={isSaving || isLoading || !currentWeightInput} className="w-full sm:w-auto">
               {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               {latestLog?.log_date === new Date().toISOString().split('T')[0] ? 'Update Today' : 'Log Today'}
             </Button>
           </div>
           {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        {/* Chart Section */}
        <div className="h-[150px] w-full pt-4">
          {isLoading && !logs.length && ( // Show loader only if no data is present yet
             <div className="flex items-center justify-center h-full text-muted-foreground">
               <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading chart data...
             </div>
           )}
          {!isLoading && logs.length === 0 && ( // Show message if loading finished and no data
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Log your weight to see the chart.
            </div>
          )}
           {!isLoading && logs.length > 0 && (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={logs}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }} // Adjust margins
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                  {/* --- XAXIS KONFIGURIERT --- */}
                  <XAxis
                    dataKey="timestamp" // Verwende Timestamp
                    type="number"       // Wichtig: Numerischer Typ für Zeitachse
                    domain={['dataMin', 'dataMax']} // Wichtig: Spanne auf Datenbereich
                    tickFormatter={formatDateTick} // Formatiert Timestamp zu Datum-String
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    interval="preserveStartEnd" // Zeige Start/End-Ticks
                    // Optional: tickCount={5} // Anzahl Ticks begrenzen, falls nötig
                  />
                  <YAxis
                    dataKey="weight"
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${Math.round(value)}`} // Runde Y-Achsen-Werte
                    width={25} // Gib der Y-Achse etwas mehr Platz links
                  />
                  <ChartTooltip
                    cursor={true} // Re-enable cursor for better interaction
                    content={<CustomTooltipContent />} // Use our custom tooltip
                   />
                  <Line
                    dataKey="weight"
                    type="monotone" // Glättet die Linie
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={false} // Keine Punkte auf der Linie
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
           )}
        </div>
      </CardContent>
    </Card>
  )
}