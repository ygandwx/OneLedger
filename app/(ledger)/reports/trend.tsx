"use client"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const COLORS = ["#216354", "#ab6329", "#3d64a8", "#b65770", "#7c61a8", "#477c89"]
export function Trend({ points, series, currency }: {
  points: Record<string, string | number>[], series: { key: string; label: string }[], currency: string
}) {
  return <div aria-label={`${currency} 每月支出趋势`} style={{ width: "100%", minWidth: 0, height: 240 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 15, right: 20, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} width={65} />
        <Tooltip />
        {series.map((line, i) => <Line key={line.key} dataKey={line.key} name={line.label}
          type="linear" stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>
}
