import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Building2, Save, Loader2, RefreshCw, Plus, X, Users, LogIn } from 'lucide-react';
import { authApi, adminApi, CompanyModules, CreateCompanyRequest, SaasCompany, SaasPlan, setTokens, setAdminTokens } from '../services/api';
import { useNavigate } from 'react-router-dom';

const moduleLabels: Record<keyof CompanyModules, string> = {
  sales_order: 'Sales Order',
  purchase_order: 'Purchase Order',
  sales: 'Sales',
  purchase: 'Purchase',
  payment: 'Payment',
  receipt: 'Receipt',
  delivery_note: 'Delivery Note',
  quotation: 'Quotation',
};

const moduleKeys = Object.keys(moduleLabels) as (keyof CompanyModules)[];

const defaultCreateModules: CompanyModules = {
  sales_order: true,
  purchase_order: true,
  sales: true,
  purchase: true,
  payment: true,
  receipt: true,
  delivery_note: true,
  quotation: true,
};

const SaasAdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [impersonatingCompanyId, setImpersonatingCompanyId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingCompanyId, setSavingCompanyId] = useState<number | null>(null);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [companies, setCompanies] = useState<SaasCompany[]>([]);
  const [draftModules, setDraftModules] = useState<Record<number, CompanyModules>>({});
  const [draftPlan, setDraftPlan] = useState<Record<number, number | null>>({});
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState<CreateCompanyRequest>({
    company_name: '',
    company_email: '',
    company_phone: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_password: '',
    plan_id: undefined,
    modules: { ...defaultCreateModules },
  });

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => Number(b.id) - Number(a.id));
  }, [companies]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const meRes = await authApi.getMe();
      const role = meRes.data?.user?.role;
      if (role !== 'super_admin') {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);

      const overview = await adminApi.getCompaniesOverview();
      const allCompanies = overview.data?.companies ?? [];
      const allPlans = overview.data?.plans ?? [];

      setCompanies(allCompanies);
      setPlans(allPlans);

      const modulesState: Record<number, CompanyModules> = {};
      const plansState: Record<number, number | null> = {};

      allCompanies.forEach((company) => {
        modulesState[company.id] = company.modules;
        plansState[company.id] = company.plan_id ?? null;
      });

      setDraftModules(modulesState);
      setDraftPlan(plansState);
    } catch (err: any) {
      setError(err?.message || 'Failed to load SaaS admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleModule = (companyId: number, moduleKey: keyof CompanyModules) => {
    setDraftModules((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        [moduleKey]: !prev[companyId]?.[moduleKey],
      }
    }));
  };

  const handlePlanChange = (companyId: number, value: string) => {
    setDraftPlan((prev) => ({
      ...prev,
      [companyId]: value ? Number(value) : null,
    }));
  };

  const handleSave = async (companyId: number) => {
    setSavingCompanyId(companyId);
    setError('');

    try {
      await adminApi.updateCompanyAccess({
        company_id: companyId,
        plan_id: draftPlan[companyId] ?? undefined,
        modules: draftModules[companyId],
      });

      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save company access settings.');
    } finally {
      setSavingCompanyId(null);
    }
  };

  const handleCreateInput = (key: keyof CreateCompanyRequest, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCreateModuleToggle = (moduleKey: keyof CompanyModules) => {
    setCreateForm((prev) => ({
      ...prev,
      modules: {
        ...(prev.modules || {}),
        [moduleKey]: !prev.modules?.[moduleKey],
      }
    }));
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await adminApi.createCompany({
        ...createForm,
        plan_id: createForm.plan_id ? Number(createForm.plan_id) : undefined,
      });

      setCreateForm({
        company_name: '',
        company_email: '',
        company_phone: '',
        admin_name: '',
        admin_email: '',
        admin_phone: '',
        admin_password: '',
        plan_id: undefined,
        modules: { ...defaultCreateModules },
      });

      setIsCreateModalOpen(false);

      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create company.');
    } finally {
      setCreating(false);
    }
  };

  const handleImpersonate = async (companyId: number) => {
    setImpersonatingCompanyId(companyId);
    setError('');

    try {
      // Save current admin tokens before impersonating
      const currentAdminToken = localStorage.getItem('auth_token');
      const currentAdminRefreshToken = localStorage.getItem('refresh_token');
      if (currentAdminToken && currentAdminRefreshToken) {
        setAdminTokens(currentAdminToken, currentAdminRefreshToken);
      }

      const response = await adminApi.impersonateCompany(companyId);
      const accessToken = response.data?.tokens?.accessToken;
      const refreshToken = response.data?.tokens?.refreshToken;
      if (!accessToken || !refreshToken) {
        throw new Error('Impersonation tokens are missing.');
      }

      setTokens(accessToken, refreshToken);
      navigate('/');
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to login as company user.');
    } finally {
      setImpersonatingCompanyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 font-bold">
          <Loader2 className="animate-spin" size={20} /> Loading SaaS admin data...
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="max-w-3xl mx-auto bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
        <h2 className="text-xl font-black text-rose-700 uppercase tracking-wide">Access denied</h2>
        <p className="mt-3 text-rose-600 font-semibold">Only SaaS super admin can access this panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">SaaS Admin Panel</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                Manage company plans and module access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Plus size={16} /> Create Company
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold">
            {error}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {sortedCompanies.map((company) => (
          <div key={company.id} className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 size={18} />
                  <h2 className="text-lg font-black tracking-tight">{company.name}</h2>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {company.code} • Status: {company.status} • Plan: {company.plan_name || 'No Plan'}
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner Name</p>
                    <p className="mt-1 font-bold text-slate-800">{company.owner_name || 'Not assigned'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner Email</p>
                    <p className="mt-1 font-bold text-slate-800 break-all">{company.owner_email || company.email || 'No email'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</p>
                    <p className="mt-1 font-bold text-slate-800">{company.owner_phone || company.phone || 'No phone'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Users</p>
                      <p className="mt-1 font-bold text-slate-800">{company.user_count ?? 0}</p>
                    </div>
                    <Users size={18} className="text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="w-full xl:w-[340px] space-y-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Plan
                  </label>
                  <select
                    value={draftPlan[company.id] ?? ''}
                    onChange={(e) => handlePlanChange(company.id, e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold"
                  >
                    <option value="">No Plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.currency} {Number(plan.amount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => handleImpersonate(company.id)}
                  disabled={impersonatingCompanyId === company.id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 font-bold"
                >
                  {impersonatingCompanyId === company.id ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
                  Login As User
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {moduleKeys.map((moduleKey) => {
                const enabled = !!draftModules[company.id]?.[moduleKey];
                return (
                  <label
                    key={moduleKey}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 cursor-pointer transition ${enabled
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50'
                      }`}
                  >
                    <span className="text-sm font-bold text-slate-700">{moduleLabels[moduleKey]}</span>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleModule(company.id, moduleKey)}
                      className="h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => handleSave(company.id)}
                disabled={savingCompanyId === company.id}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold"
              >
                {savingCompanyId === company.id ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Company Access
              </button>
            </div>
          </div>
        ))}

        {sortedCompanies.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 font-semibold">
            No companies found.
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Create Company</h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">Create tenant company, owner user, plan, and module access.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Company Details</h3>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Company Name</label>
                  <input value={createForm.company_name} onChange={(e) => handleCreateInput('company_name', e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="Anu Textiles Pvt Ltd" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Company Email</label>
                  <input value={createForm.company_email || ''} onChange={(e) => handleCreateInput('company_email', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="billing@company.com" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Company Phone</label>
                  <input value={createForm.company_phone || ''} onChange={(e) => handleCreateInput('company_phone', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Initial Plan</label>
                  <select value={createForm.plan_id || ''} onChange={(e) => setCreateForm((prev) => ({ ...prev, plan_id: e.target.value ? Number(e.target.value) : undefined }))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold">
                    <option value="">No Plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.currency} {Number(plan.amount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Owner Details</h3>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Owner Name</label>
                  <input value={createForm.admin_name} onChange={(e) => handleCreateInput('admin_name', e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="Owner Name" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Owner Email</label>
                  <input value={createForm.admin_email} onChange={(e) => handleCreateInput('admin_email', e.target.value)} required type="email" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="owner@company.com" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Owner Phone</label>
                  <input value={createForm.admin_phone || ''} onChange={(e) => handleCreateInput('admin_phone', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Owner Password</label>
                  <input value={createForm.admin_password} onChange={(e) => handleCreateInput('admin_password', e.target.value)} required type="password" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" placeholder="StrongPass123" />
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Company Modules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {moduleKeys.map((moduleKey) => {
                    const enabled = !!createForm.modules?.[moduleKey];
                    return (
                      <label key={moduleKey} className={`flex items-center justify-between rounded-xl border px-3 py-3 cursor-pointer ${enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="text-sm font-bold text-slate-700">{moduleLabels[moduleKey]}</span>
                        <input type="checkbox" checked={enabled} onChange={() => handleCreateModuleToggle(moduleKey)} className="h-4 w-4" />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold">
                  {creating ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaasAdminPanel;
