
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  ChevronRight,
  FileText,
  Package,
  ShieldCheck,
  Plus,
  Building2
} from 'lucide-react';
import { ChartData, Transaction, VoucherType } from '../types';
import { vouchersApi } from '../services/api';
import { useOutletContext, Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, loadingUser } = useOutletContext<{ user: any, loadingUser: boolean }>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [dashboardData, setDashboardData] = React.useState<any>(null);
  
  const hasCompany = !!user?.company_id;

  React.useEffect(() => {
    if (!hasCompany) {
      setIsLoading(false);
      return;
    }
    
    const fetchDashboardData = async () => {
      try {
        const response = await vouchersApi.getDashboardStats();
        if (response.success && response.data) {
          setDashboardData(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [hasCompany]);

  if (loadingUser || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!hasCompany) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 text-center">
        <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-100">
          <ShieldCheck size={40} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
          Welcome to Saas-Books, {user?.name || 'Super Admin'}!
        </h1>
        <p className="text-lg text-slate-500 font-medium mb-10 max-w-2xl mx-auto">
          You are currently logged in as a Super Admin, but you haven't set up your company profile yet. 
          To start using Masters, Vouchers, and Reports, you first need to create or link a company to your account.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
              <Plus size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3">Create Your Company</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">
              Set up a brand new company profile and automatically link it to your Super Admin account.
            </p>
            <Link 
              to="/saas-admin" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-95"
            >
              Get Started <ChevronRight size={18} />
            </Link>
          </div>
          
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <Building2 size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3">SaaS Admin Panel</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">
              Manage all companies, subscriptions, and platform-wide settings from the admin control center.
            </p>
            <Link 
              to="/saas-admin" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              Open Admin Panel <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const chartData: ChartData[] = dashboardData?.charts?.revenue_overview?.labels?.map((label: string, index: number) => ({
    name: label,
    sales: dashboardData.charts.revenue_overview.sales[index] || 0,
    purchase: dashboardData.charts.revenue_overview.purchase[index] || 0
  })) || [];

  const summary = dashboardData?.summary || {};
  const stats = [
    {
      label: 'Amount Due',
      value: `₹${(summary.amount_due?.value || 0).toLocaleString()}`,
      change: `${summary.amount_due?.growth_percent || 0}%`,
      icon: <TrendingUp size={20} className="text-emerald-500" />,
      positive: (summary.amount_due?.growth_percent || 0) >= 0,
      bg: 'bg-emerald-50'
    },
    {
      label: 'Ledgers',
      value: (summary.ledgers?.value || 0).toString(),
      change: `${summary.ledgers?.growth_percent || 0}%`,
      icon: <Wallet size={20} className="text-indigo-500" />,
      positive: (summary.ledgers?.growth_percent || 0) >= 0,
      bg: 'bg-indigo-50'
    },
    {
      label: 'Invoices',
      value: `₹${(summary.invoices?.value || 0).toLocaleString()}`,
      change: `${summary.invoices?.growth_percent || 0}%`,
      icon: <FileText size={20} className="text-amber-500" />,
      positive: (summary.invoices?.growth_percent || 0) >= 0,
      bg: 'bg-amber-50'
    },
    {
      label: 'Overall Stock',
      value: (summary.overall_stock?.value || 0).toString(),
      change: `${summary.overall_stock?.growth_percent || 0}%`,
      icon: <Package size={20} className="text-blue-500" />,
      positive: (summary.overall_stock?.growth_percent || 0) >= 0,
      bg: 'bg-blue-50'
    },
  ];

  const stockDist = dashboardData?.stock_distribution || {};
  const barChartData = stockDist.categories?.map((cat: any) => ({
    name: cat.category,
    val: cat.asset_value
  })) || [];

  // Placeholder in case it gets uncommented
  const recentTransactions: Transaction[] = [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
            <span className="hover:text-indigo-600 cursor-pointer">Dashboard</span>
            <ChevronRight size={12} />
            <span className="text-slate-900">Summary</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2 shadow-sm">
            <Clock size={16} className="text-slate-400" />
            Apr 2023 - Mar 2024
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/40 hover:shadow-md transition-all group flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
              <h2 className="text-2xl font-bold text-slate-900">{stat.value}</h2>
              <div className={`flex items-center gap-1 text-[10px] font-bold mt-2 px-1.5 py-0.5 rounded-full w-fit ${stat.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {stat.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.change}
              </div>
            </div>
            <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Analytics Card */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-slate-900">Revenue Overview</h3>
              <p className="text-xs text-slate-400 font-medium">Monthly sales vs purchase performance</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span> Sales
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="w-2.5 h-2.5 bg-indigo-200 rounded-full"></span> Purchase
              </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
                <Area
                  type="monotone"
                  dataKey="purchase"
                  stroke="#e2e8f0"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/40">
          <h3 className="font-bold text-slate-900 mb-2">Stock Distribution</h3>
          <p className="text-xs text-slate-400 font-medium mb-8">Asset value by category</p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <Bar dataKey="val" fill="#4f46e5" radius={[6, 6, 6, 6]} barSize={32} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-600">Fast Moving Item</span>
              <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">{stockDist.fast_moving_item?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-600">Low Stock Alert</span>
              <span className="text-xs font-black text-rose-500 uppercase tracking-wider">{stockDist.low_stock_alert?.count || 0} Items</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
