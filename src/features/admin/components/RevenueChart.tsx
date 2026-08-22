import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTokens } from './chartTheme';
import { useI18n } from '../../../lib/i18n';

interface Point {
  date: string;
  revenue: number;
}

interface Props {
  data: Point[];
  height?: number;
  /** Fewer ticks on short ranges keeps the axis readable. */
  tickInterval?: number;
}

/**
 * The revenue line: one series, restrained horizontal grid, a soft fill for
 * mass rather than decoration, and a tooltip that answers exactly one
 * question — how much, on which day.
 */
export function RevenueChart({ data, height = 260, tickInterval }: Props) {
  const tokens = useChartTokens();
  const { formatCurrency } = useI18n();
  const interval = tickInterval ?? Math.max(0, Math.floor(data.length / 6) - 1);

  const compact = (value: number) =>
    value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(Math.round(value));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="cj-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tokens.ink} stopOpacity={0.12} />
            <stop offset="100%" stopColor={tokens.ink} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={tokens.grid} vertical={false} />
        <XAxis
          dataKey="date"
          interval={interval}
          tick={{ fontSize: 11, fill: tokens.axis }}
          tickLine={false}
          axisLine={{ stroke: tokens.grid }}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11, fill: tokens.axis }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={compact}
        />
        <Tooltip
          cursor={{ stroke: tokens.axis, strokeDasharray: '3 3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="chart-tooltip">
                <p className="chart-tooltip__label">{label}</p>
                <p className="chart-tooltip__value">{formatCurrency(Number(payload[0].value))}</p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={tokens.ink}
          strokeWidth={1.5}
          fill="url(#cj-revenue-fill)"
          dot={false}
          activeDot={{ r: 3, fill: tokens.ink, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
