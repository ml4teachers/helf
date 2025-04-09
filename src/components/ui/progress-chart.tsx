'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from "@/components/ui/chart"
import { calculateE1RM } from '@/lib/utils'

// Types for the component
export type ProgressChartDataPoint = {
  date: string;
  timestamp: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  e1rm: number | null;
}

type ProgressChartProps = {
  data: ProgressChartDataPoint[];
  height?: number;
  showAxisLabels?: boolean;
}

// Chart configuration
const chartConfig = {
  e1rm: {
    label: "Est. 1RM (kg)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

// Helper to format date for XAxis tick with error handling
const formatDateTick = (timestamp: number): string => {
  try {
    if (isNaN(timestamp)) {
      return '-';
    }
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-CH', { month: 'short', day: 'numeric' });
  } catch (e) {
    console.error(`Error formatting date tick for timestamp: ${timestamp}`, e);
    return '-';
  }
};

// Custom tooltip content for the chart
const CustomTooltipContent = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProgressChartDataPoint;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Date
            </span>
            <span className="font-bold">
              {data.date}
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
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Reps
            </span>
            <span className="font-bold text-foreground">
              {data.reps}
            </span>
          </div>
          {data.rpe && (
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] uppercase text-muted-foreground">
                RPE
              </span>
              <span className="font-bold text-foreground">
                {data.rpe}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-1 mt-1">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Est. 1RM
            </span>
            <span className="font-bold text-foreground">
              {data.e1rm ? `${data.e1rm} kg` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function ProgressChart({ data, height = 150, showAxisLabels = false }: ProgressChartProps) {
  // Prepare data for the chart - ensure data points have e1rm calculated
  const chartData = data.map(point => {
    // If e1rm is not already calculated, calculate it
    const e1rm = point.e1rm ?? (
      (point.weight && point.reps && point.rpe) 
        ? calculateE1RM({ 
            weight: point.weight, 
            reps: point.reps, 
            rpe: point.rpe 
          })
        : (point.weight && point.reps)
          ? calculateE1RM({ 
              weight: point.weight, 
              reps: point.reps, 
              rpe: 8 // Default RPE if not available
            })
          : null
    );
    
    return {
      ...point,
      e1rm
    };
  });

  // Don't render chart if no valid data
  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground">
        No exercise history available.
      </div>
    );
  }

  // Calculate domain for Y axis - min/max e1rm values with some padding
  const validE1RMs = chartData
    .filter(d => d.e1rm !== null && !isNaN(d.e1rm as number))
    .map(d => d.e1rm as number);
    
  // Check if we have valid data points
  if (!validE1RMs.length) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground">
        No valid exercise data available.
      </div>
    );
  }
  
  const minValue = Math.min(...validE1RMs);
  const maxValue = Math.max(...validE1RMs);
  
  // Add 5% padding to the domain
  const yAxisMin = Math.max(0, minValue - (maxValue - minValue) * 0.05);
  const yAxisMax = maxValue + (maxValue - minValue) * 0.05;

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: showAxisLabels ? 25 : 0, bottom: 5 }}
        >
          <CartesianGrid 
            vertical={false} 
            strokeDasharray="3 3" 
            stroke="hsl(var(--muted-foreground) / 0.2)" 
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDateTick}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            interval="preserveStartEnd"
            height={showAxisLabels ? 30 : 20}
            label={showAxisLabels ? { value: "Date", position: "insideBottom", offset: -5 } : undefined}
          />
          <YAxis
            dataKey="e1rm"
            domain={[yAxisMin, yAxisMax]}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickFormatter={(value) => `${Math.round(value)}`}
            width={showAxisLabels ? 35 : 25}
            label={showAxisLabels ? { value: "Est. 1RM (kg)", angle: -90, position: "insideLeft" } : undefined}
          />
          <ChartTooltip
            cursor={true}
            content={<CustomTooltipContent />}
          />
          <Line
            dataKey="e1rm"
            type="monotone"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}