import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Completes per day; colours come from the theme tokens so it works in light and dark. */
export function CompletesChart({ data }: { data: { day: string; completes: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No completes yet.</p>;
  }
  return (
    <div className="h-64" role="img" aria-label="Completes per day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickFormatter={(day: string) => day.slice(5)}
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
