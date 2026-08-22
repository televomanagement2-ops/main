import { useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '../../../store/themeStore';

export interface ChartTokens {
  ink: string;
  grid: string;
  axis: string;
  fill: string;
  series: string[];
  isDark: boolean;
}

/**
 * Charts read their colours from the same CSS tokens as the rest of the
 * product, so light/dark and any future palette change flow through without
 * a second source of truth. Recharts needs literal values, so we resolve the
 * custom properties whenever the active theme changes.
 */
export function useChartTokens(): ChartTokens {
  const theme = useThemeStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;

    return {
      isDark,
      ink: read('--chart-ink', '#16140F'),
      grid: read('--chart-grid', 'rgba(22,20,15,0.08)'),
      axis: read('--chart-axis', '#756D5F'),
      fill: read('--chart-fill', 'rgba(22,20,15,0.06)'),
      series: [
        read('--chart-1', '#16140F'),
        read('--chart-2', '#8A4B2C'),
        read('--chart-3', '#6B6459'),
        read('--chart-4', '#B08A63'),
        read('--chart-5', '#2E6B4F'),
        read('--chart-6', '#A79E8B'),
        read('--chart-7', '#4A4437'),
        read('--chart-8', '#CFC5B0'),
      ],
    };
    // Re-resolves whenever the effective theme flips, including a system change.
  }, [isDark]);
}

/** Daily revenue for the last `days` days, zero-filled, ready to plot. */
export function buildRevenueSeries(
  revenueByDay: { day: string; revenue: number }[] | undefined,
  days: number,
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string
) {
  const byDay = new Map<string, number>(
    (revenueByDay ?? []).map((entry) => [entry.day, Number(entry.revenue)])
  );

  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      key,
      date: formatDate(date, { month: 'short', day: 'numeric' }),
      revenue: Math.round((byDay.get(key) ?? 0) * 100) / 100,
    };
  });
}

/** Sum of the last `days` entries of a series — used for period comparisons. */
export function sumWindow(series: { revenue: number }[], days: number, offset = 0): number {
  const end = series.length - offset;
  const start = Math.max(0, end - days);
  return series.slice(start, end).reduce((sum, point) => sum + point.revenue, 0);
}
