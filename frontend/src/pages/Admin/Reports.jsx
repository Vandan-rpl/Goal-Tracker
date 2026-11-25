import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import TeamReports from "./TeamReports";

// NOTE: no reports/analytics page existed anywhere under src/pages/Admin/
// or src/pages/cfo/ before this (only CFOAllUsersGoals.jsx, a plain goals
// table with no charts). `recharts` was already a dependency in
// package.json — used here rather than adding a new charting library.

const StatCard = ({ label, value, accent }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {label}
    </p>
    <p className={`text-3xl font-black mt-1 ${accent}`}>{value}</p>
  </div>
);

const PageLayout = ({ subtitle, children }) => (
  <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Reports & Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

// Departments left out of the Business Head's "Goals by Department" chart.
const BUSINESS_HEAD_HIDDEN_DEPARTMENTS = ["human resources", "hr"];

// "Goals by Department" bar chart, with its own fetch. Shown on the
// Admin / CFO organisation view and inside the Business Head's team report
// (which passes hiddenDepartments and the selected departmentId: "" = all
// departments, else only that one).
const DepartmentGoalsChart = ({ hiddenDepartments = [], departmentId = "" }) => {
  const [departmentStats, setDepartmentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hiddenKey = hiddenDepartments.join("|");

  useEffect(() => {
    let ignore = false;
    const hidden = hiddenKey ? hiddenKey.split("|") : [];

    api
      .get("analytics/department-stats")
      .then((res) => {
        if (ignore || !res.data.success) return;
        setDepartmentStats(
          (res.data.data || []).filter(
            (row) =>
              !hidden.includes(String(row.department || "").trim().toLowerCase()),
          ),
        );
      })
      .catch((err) => {
        console.error("Failed to load department stats", err);
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load department data.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [hiddenKey]);

  const chartData = departmentId
    ? departmentStats.filter((row) => String(row.departmentId) === String(departmentId))
    : departmentStats;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        Goals by Department
      </h2>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-sm text-gray-500 text-center py-12">Loading...</div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} maxBarSize={80}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="department" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="totalGoals"
              name="Total Goals"
              fill="#526198"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="completedGoals"
              name="Completed"
              fill="#059669"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-200 rounded-xl">
          No department data available.
        </div>
      )}
    </section>
  );
};

// Admin / CFO organisation view.
const OrganisationReports = () => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError("");
        const statsRes = await api.get("analytics/dashboard-stats");
        if (statsRes.data.success) setDashboardStats(statsRes.data.data);
      } catch (err) {
        console.error("Failed to load reports", err);
        setError(
          err.response?.data?.message || "Failed to load analytics data.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center text-gray-500">
        Loading reports...
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Goals"
            value={dashboardStats.totalGoals}
            accent="text-gray-900"
          />
          <StatCard
            label="Pending Approval"
            value={dashboardStats.pendingApproval}
            accent="text-amber-600"
          />
          <StatCard
            label="Completed"
            value={dashboardStats.completedGoals}
            accent="text-emerald-600"
          />
          <StatCard
            label="Avg. Rating"
            value={
              dashboardStats.currentRating
                ? Number(dashboardStats.currentRating).toFixed(2)
                : "N/A"
            }
            accent="text-indigo-600"
          />
        </div>
      )}

      <DepartmentGoalsChart />
    </>
  );
};

// Business Head: the Manager/HOD team report with the "Goals by
// Department" chart under its summary cards, following its department filter.
const BusinessHeadReports = () => (
  <PageLayout subtitle="Team goal progress by member, limited to active employees under you.">
    <TeamReports
      renderDepartmentChart={(departmentId) => (
        <DepartmentGoalsChart
          hiddenDepartments={BUSINESS_HEAD_HIDDEN_DEPARTMENTS}
          departmentId={departmentId}
        />
      )}
    />
  </PageLayout>
);

const Reports = () => {
  const { user } = useAuth();
  const role = String(user?.Role || user?.role || "")
    .trim()
    .toUpperCase();

  if (["MANAGER", "HOD"].includes(role)) {
    return (
      <PageLayout subtitle="Team goal progress by member, limited to your active direct reports.">
        <TeamReports />
      </PageLayout>
    );
  }

  if (role === "BUSINESSHEAD") {
    return <BusinessHeadReports />;
  }

  return (
    <PageLayout subtitle="Organization-wide goal reporting and completion trends.">
      <OrganisationReports />
    </PageLayout>
  );
};

export default Reports;
