import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardCellClass, dashboardHeadClass } from "./dashboardStyles";

// Shared pieces of the user dashboards (Task Tracker and Innovation Ideas),
// so both look the same. Each page passes its own data and labels; every
// count comes from its backend.

const panelTitleClass =
  "border-b border-[#cbd4e2] bg-[#f4f6fa] px-4 py-2.5 text-sm font-bold text-[#30415f] wrap-break-word";

export const SummaryCard = ({ label, value, accent }) => (
  // min-w-0 + overflow-wrap keep long labels ("Implementation %") and
  // values inside narrow cards instead of spilling past the border.
  <div className="flex min-w-0 flex-col justify-between border border-[#cbd4e2] bg-[#f4f6fa] px-3 py-3 sm:px-4 sm:py-4">
    <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-[#30415f] wrap-break-word [overflow-wrap:anywhere]">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-bold leading-tight tabular-nums wrap-break-word sm:text-3xl ${accent}`}>{value}</p>
  </div>
);

// cards: [{ label, value, accent }]; gridClassName sets the columns.
export const SummaryCards = ({ cards, gridClassName }) => (
  <div className={`grid gap-4 ${gridClassName}`}>
    {cards.map((card) => (
      <SummaryCard key={card.label} {...card} />
    ))}
  </div>
);

// Titled breakdown table (row label with its chart colour, and count).
export const BreakdownTable = ({ title, rows, colors }) => (
  <section className="min-w-0 border border-[#cbd4e2]">
    <h2 className={panelTitleClass}>{title}</h2>
    <div className="overflow-x-auto p-4">
      <table className="w-full border border-[#aeb9cc] border-collapse">
        <thead>
          <tr>
            <th className={dashboardHeadClass}>{title.replace(" Breakdown", "").replace(" Snapshot", "")}</th>
            <th className={`${dashboardHeadClass} text-right`}>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className={`${dashboardCellClass} wrap-break-word`}>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 shrink-0" style={{ backgroundColor: colors[row.label] }} aria-hidden="true" />
                  {row.label}
                </span>
              </td>
              <td className={`${dashboardCellClass} text-right font-semibold`}>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

// Titled chart panel.
export const ChartPanel = ({ title, className = "", children }) => (
  <section className={`min-w-0 border border-[#cbd4e2] ${className}`}>
    <h2 className={panelTitleClass}>{title}</h2>
    <div className="p-4">{children}</div>
  </section>
);

// Pie / ring segment label: the value, drawn on the segment itself.
const RADIAN = Math.PI / 180;
const renderSegmentLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  if (!value) return null;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}
      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}>
      {value}
    </text>
  );
};

// Recharts reads `name` / `value`.
const toChart = (rows = []) => rows.map((row) => ({ name: row.label, value: row.count }));

const CHART_HEIGHT = 260;

/**
 * The three breakdowns: tables side by side, then their charts (status pie
 * and horizontal bar side by side, completion ring centred below).
 * Each of status / bar / snapshot is { title, rows: [{ label, count }],
 * colors: { label: colour } }; bar also takes barName (tooltip) and
 * yAxisWidth (room for the row labels).
 */
export const DashboardBreakdowns = ({ status, bar, snapshot }) => (
  <>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <BreakdownTable title={status.title} rows={status.rows} colors={status.colors} />
      <BreakdownTable title={bar.title} rows={bar.rows} colors={bar.colors} />
      <BreakdownTable title={snapshot.title} rows={snapshot.rows} colors={snapshot.colors} />
    </div>

    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartPanel title={status.title}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <PieChart>
            <Pie
              data={toChart(status.rows)}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              labelLine={false}
              label={(props) => renderSegmentLabel(props)}
              isAnimationActive={false}
            >
              {status.rows.map((row) => (
                <Cell key={row.label} fill={status.colors[row.label]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title={bar.title}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={toChart(bar.rows)} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={bar.yAxisWidth || 64} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: "#edf1f7" }} />
            <Bar dataKey="value" name={bar.barName} isAnimationActive={false}>
              {bar.rows.map((row) => (
                <Cell key={row.label} fill={bar.colors[row.label]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title={snapshot.title} className="lg:col-span-2 lg:mx-auto lg:w-[calc(50%-0.75rem)]">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <PieChart>
            {/* Ring; the center is left empty for now. */}
            <Pie
              data={toChart(snapshot.rows)}
              dataKey="value"
              nameKey="name"
              innerRadius="50%"
              outerRadius="80%"
              labelLine={false}
              label={(props) => renderSegmentLabel(props)}
              isAnimationActive={false}
            >
              {snapshot.rows.map((row) => (
                <Cell key={row.label} fill={snapshot.colors[row.label]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  </>
);

// "No ... to show yet" panel.
export const DashboardEmptyState = ({ title, description }) => (
  <div className="border border-[#aeb9cc] px-4 py-12 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{description}</p>
  </div>
);

// Titled, horizontally scrollable list table at the bottom.
export const DashboardListTable = ({ title, minWidthClass = "min-w-225", children }) => (
  <section>
    <h2 className="mb-2 text-sm font-bold text-[#30415f]">{title}</h2>
    <div className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white">
      <table className={`w-full ${minWidthClass} border-collapse`}>{children}</table>
    </div>
  </section>
);

export const DashboardLoading = () => (
  <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading your dashboard...</p>
);

export const DashboardError = ({ message }) =>
  message ? (
    <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{message}</div>
  ) : null;
