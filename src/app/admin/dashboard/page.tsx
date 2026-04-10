"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Zap, TrendingUp, TrendingDown, Server, Code2,
  Calendar, Filter, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  Wallet, Plus, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  Legend,
} from "recharts";

// ── Types ──

interface DailyData {
  date: string;
  development: number;
  infrastructure: number;
  byType: Record<string, number>;
}

interface AnalyticsData {
  daily: DailyData[];
  totals: {
    development: number;
    infrastructure: number;
    total: number;
    byType: Record<string, number>;
  };
  projects: string[];
}

// ── Constants ──

const USAGE_TYPE_LABELS: Record<string, string> = {
  prompt: "AI Prompts",
  deploy: "Deployments",
  start_server: "Server Start",
  get_source_code: "Source Code",
  recover_version: "Version Recovery",
  upload_file: "File Upload",
  add_custom_domain: "Custom Domain",
  chatgpt: "ChatGPT",
  image_generation: "Image Gen",
  email: "Email",
  pdf: "PDF",
  document_scan: "Doc Scan",
  web_scraper: "Web Scraper",
  file_upload: "File Upload",
};

const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#4f46e5", "#7c3aed", "#5b21b6",
  "#6d28d9", "#4338ca", "#3730a3", "#312e81",
  "#a855f7", "#9333ea",
];

const PRESET_RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: formatDate(from), to: formatDate(to) };
}

// ── Custom Tooltip ──

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-medium text-gray-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──

export default function AdminDashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Filters
  const defaultRange = getDefaultRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("30d");

  // Check admin access and fetch credits balance
  useEffect(() => {
    async function checkAccess() {
      const res = await api.get("/api/admin/stats");
      if (!res.ok) {
        console.log("[Admin Dashboard] Access denied");
        setAccessDenied(true);
        router.push("/dashboard");
        return;
      }
      // Fetch credits balance
      fetchBalance();
    }
    if (!isPending) checkAccess();
  }, [isPending, router]);

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await api.get<{ balance: number }>("/api/admin/credits-balance");
      if (res.ok && res.data) {
        setCreditsBalance(res.data.balance);
        console.log("[Admin Dashboard] Credits balance:", res.data.balance);
      } else {
        console.log("[Admin Dashboard] Could not fetch balance:", res.error);
        setCreditsBalance(null);
      }
    } catch (err) {
      console.error("[Admin Dashboard] Balance fetch error:", err);
      setCreditsBalance(null);
    }
    setBalanceLoading(false);
  };

  const fetchAnalytics = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (selectedProject) params.set("projectId", selectedProject);

    console.log("[Admin Dashboard] Fetching analytics:", params.toString());
    const res = await api.get<AnalyticsData>(`/api/admin/analytics?${params}`);

    if (res.ok && res.data) {
      setAnalytics(res.data);
      console.log("[Admin Dashboard] Analytics loaded:", res.data.totals);
    } else {
      console.error("[Admin Dashboard] Failed to fetch analytics:", res.error);
    }

    setLoading(false);
    setRefreshing(false);
  }, [fromDate, toDate, selectedProject]);

  useEffect(() => {
    if (!accessDenied && !isPending) fetchAnalytics();
  }, [accessDenied, isPending, fetchAnalytics]);

  const handlePreset = (label: string, days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(formatDate(from));
    setToDate(formatDate(to));
    setActivePreset(label);
  };

  // ── Derived Data ──

  const chartData = useMemo(() => {
    if (!analytics?.daily) return [];
    return analytics.daily.map((d) => ({
      date: d.date.slice(5), // MM-DD
      fullDate: d.date,
      development: d.development,
      infrastructure: d.infrastructure,
      total: d.development + d.infrastructure,
    }));
  }, [analytics]);

  const pieData = useMemo(() => {
    if (!analytics?.totals?.byType) return [];
    return Object.entries(analytics.totals.byType)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        name: USAGE_TYPE_LABELS[key] || key,
        value: Number(value.toFixed(2)),
        key,
      }));
  }, [analytics]);

  const dailyAvg = useMemo(() => {
    if (!chartData.length) return 0;
    const sum = chartData.reduce((acc, d) => acc + d.total, 0);
    return sum / chartData.length;
  }, [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const mid = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, mid).reduce((a, d) => a + d.total, 0) / mid;
    const secondHalf = chartData.slice(mid).reduce((a, d) => a + d.total, 0) / (chartData.length - mid);
    if (firstHalf === 0) return 0;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  }, [chartData]);

  const topUsageTypes = useMemo(() => {
    if (!analytics?.totals?.byType) return [];
    return Object.entries(analytics.totals.byType)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [analytics]);

  const barData = useMemo(() => {
    if (!topUsageTypes.length) return [];
    return topUsageTypes.map(([key, value]) => ({
      name: USAGE_TYPE_LABELS[key] || key,
      credits: Number(value.toFixed(2)),
      key,
    }));
  }, [topUsageTypes]);

  // ── Render ──

  if (isPending || (loading && !accessDenied)) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#fcfbf8" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (accessDenied) return null;

  const totals = analytics?.totals;

  return (
    <div className="min-h-screen" style={{ background: "#fcfbf8" }}>
      <AdminHeader activeTab="dashboard" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Title + Refresh ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Spending Analytics</h1>
            <p className="text-sm text-gray-400 mt-0.5">Credit usage overview and trends</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" />
              <span className="font-medium">Filters</span>
            </div>

            {/* Date presets */}
            <div className="flex items-center gap-1">
              {PRESET_RANGES.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.label, p.days)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activePreset === p.label
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setActivePreset(""); }}
                className="h-7 text-xs w-[130px] bg-white border-gray-200"
              />
              <span className="text-xs text-gray-400">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setActivePreset(""); }}
                className="h-7 text-xs w-[130px] bg-white border-gray-200"
              />
            </div>

            {/* Project filter */}
            {analytics?.projects && analytics.projects.length > 0 && (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="h-7 text-xs rounded-lg border border-gray-200 bg-white px-2 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
              >
                <option value="">All Projects</option>
                {analytics.projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Credits Balance Card ── */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current Balance</span>
              </div>
              {balanceLoading ? (
                <div className="h-9 w-32 bg-white/10 rounded-lg animate-pulse mt-1" />
              ) : creditsBalance !== null ? (
                <p className="text-3xl font-bold tracking-tight">{creditsBalance.toFixed(1)} <span className="text-base font-normal text-gray-400">credits</span></p>
              ) : (
                <p className="text-lg font-medium text-gray-400">Unable to load balance</p>
              )}
            </div>
            <a
              href="https://accounts.totalum.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Balance
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>

        {/* ── Spending Summary Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {!totals ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/40" />)
          ) : (
            <>
              <StatCard
                icon={Zap}
                value={totals.total.toFixed(1)}
                label="Total Credits Spent"
                accentColor="text-amber-500"
                accentBg="bg-amber-50"
              />
              <StatCard
                icon={Code2}
                value={totals.development.toFixed(1)}
                label="Development Spent"
                accentColor="text-indigo-500"
                accentBg="bg-indigo-50"
              />
              <StatCard
                icon={Server}
                value={totals.infrastructure.toFixed(1)}
                label="Infrastructure Spent"
                accentColor="text-emerald-500"
                accentBg="bg-emerald-50"
              />
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trend >= 0 ? "bg-rose-50" : "bg-green-50"}`}>
                    {trend > 0 ? (
                      <TrendingUp className="w-4 h-4 text-rose-500" />
                    ) : trend < 0 ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Spending Trend</p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Avg: {dailyAvg.toFixed(1)} credits/day
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Area Chart - Daily Spending */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-800">Daily Credit Spending</h3>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Development</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Infrastructure</span>
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-gray-300">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <defs>
                    <linearGradient id="gradDev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradInfra" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="development" name="Development" stroke="#6366f1" strokeWidth={2} fill="url(#gradDev)" />
                  <Area type="monotone" dataKey="infrastructure" name="Infrastructure" stroke="#10b981" strokeWidth={2} fill="url(#gradInfra)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart - By Type */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Usage Distribution</h3>
            </div>
            {pieData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-gray-300">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} credits`, ""]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    iconSize={8}
                    formatter={(value) => <span className="text-gray-500">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bar Chart + Breakdown Table ── */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          {/* Bar Chart - Top Usage Types */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Top Usage Types</h3>
            </div>
            {barData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-300">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} width={90} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} credits`, "Usage"]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="credits" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Detailed Breakdown Table */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Spending Breakdown by Type</h3>
            {!totals?.byType || Object.keys(totals.byType).length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-300">No data</div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {Object.entries(totals.byType)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, value], i) => {
                    const pct = totals.total > 0 ? (value / totals.total) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-gray-700 truncate">
                              {USAGE_TYPE_LABELS[key] || key}
                            </span>
                            <span className="text-xs text-gray-500 ml-2 shrink-0">
                              {value.toFixed(1)} <span className="text-gray-300">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ── Daily Breakdown Table ── */}
        {analytics?.daily && analytics.daily.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Daily Log</h3>
              <p className="text-xs text-gray-400 mt-0.5">{analytics.daily.length} days of data</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Development</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Infrastructure</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Total</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">Top Types</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analytics.daily].reverse().map((day) => {
                    const dayTotal = day.development + day.infrastructure;
                    const topTypes = Object.entries(day.byType || {})
                      .filter(([, v]) => v > 0)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3);
                    return (
                      <tr key={day.date} className="border-b border-gray-50 hover:bg-black/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{day.date}</td>
                        <td className="px-4 py-2.5 text-xs text-right">
                          <span className="text-indigo-600 font-medium">{day.development.toFixed(1)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right">
                          <span className="text-emerald-600 font-medium">{day.infrastructure.toFixed(1)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right font-semibold text-gray-800">{dayTotal.toFixed(1)}</td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {topTypes.map(([type, val]) => (
                              <span
                                key={type}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-50 text-[10px] text-gray-500"
                              >
                                {USAGE_TYPE_LABELS[type] || type}: {val.toFixed(1)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Projects List ── */}
        {analytics?.projects && analytics.projects.length > 0 && (
          <div className="mt-4 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Projects with Spending</h3>
            <div className="flex flex-wrap gap-2">
              {analytics.projects.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedProject(selectedProject === p ? "" : p)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedProject === p
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p}
                  {selectedProject === p && (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
