import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import { CHART_COLORS } from './primitives';

// Recharts wrappers. Each one takes the plain `[{name, value}]` shape the backend
// already returns, so a dashboard never has to reshape data before charting it.

const AXIS = {
  stroke: '#94a3b8',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
  },
};

/** Donut with a centre total — the workhorse for "how is this split". */
export function DonutChart({ data, centerLabel, centerValue, colors = CHART_COLORS }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) {
    return <NoData />;
  }
  // The centre label is a positioned overlay rather than an SVG child: it stays
  // crisp at any size and does not depend on how the charting library treats
  // arbitrary children.
  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums leading-none text-slate-900">
          {centerValue ?? total}
        </span>
        <span className="mt-0.5 max-w-[80%] text-center text-[9px] leading-tight text-slate-400">
          {centerLabel || 'total'}
        </span>
      </div>
    </div>
  );
}

/** Vertical bars — good for a small number of named categories. */
export function BarsChart({ data, color = '#0d9488', horizontal = false, colors = CHART_COLORS }) {
  if (!data || data.length === 0) return <NoData />;
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" {...AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={110} {...AXIS} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -18, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" {...AXIS} interval={0} angle={data.length > 4 ? -18 : 0} height={data.length > 4 ? 46 : 24} textAnchor={data.length > 4 ? 'end' : 'middle'} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Filled area over time — the activity line.
 *
 * A single data point draws no line, so a young contract renders an empty box
 * that reads as a bug. With fewer than two points we fall back to bars, which
 * show the one day honestly.
 */
export function AreaTrend({ data, color = '#0d9488', label = 'events' }) {
  if (!data || data.length === 0) return <NoData />;

  if (data.length < 2) {
    return (
      <BarsChart
        data={data.map((entry) => ({ name: entry.date, value: entry.value }))}
        color={color}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 6, bottom: 4 }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="date" {...AXIS} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="value"
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${label})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Two-series bars: what is readable against what is not.
 *
 * A plain "readable records per patient" chart is all zeroes until somebody grants
 * access, so it renders as an empty frame. Showing the locked remainder keeps the
 * chart truthful and legible from the very first record.
 */
export function AccessBars({ data }) {
  if (!data || data.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={104} {...AXIS} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="readable" name="Readable now" stackId="a" fill="#0d9488" maxBarSize={22} />
        <Bar
          dataKey="locked"
          name="No access"
          stackId="a"
          fill="#e2e8f0"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A single-value gauge, for a completion-style metric. */
export function GaugeChart({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = pct >= 67 ? '#0d9488' : pct >= 34 ? '#f59e0b' : '#e11d48';
  const data = [{ name: label, value: pct, fill }];
  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="66%"
          outerRadius="100%"
          startAngle={210}
          endAngle={-30}
        >
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f1f5f9' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: fill }}>
          {pct}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      </div>
    </div>
  );
}

function NoData() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-slate-400">No data yet</p>
    </div>
  );
}

export { NoData };
