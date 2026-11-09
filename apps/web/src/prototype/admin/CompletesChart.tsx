import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { completesPerDay } from '../fake-data';

/** Completes per day; colours come from the theme tokens so it works in light and dark. */
export function CompletesChart() {
  return (
    <div className="h-64" role="img" aria-label="Completes per day over the last 14 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={completesPerDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="completes"
            name="Completes"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
