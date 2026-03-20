
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Percent,
  FileText,
  Star,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  Eye,
  Activity,
  Hash,
  Loader2,
  AlertCircle,
  Database,
  TriangleAlert
} from 'lucide-react';
import { Tax as TaxType } from '../../types';
import { mastersApi } from '../../services/api';

const Tax: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [taxes, setTaxes] = useState<TaxType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTax, setSelectedTax] = useState<TaxType | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterDefault, setFilterDefault] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    tax_type: 'GST' as TaxType['tax_type'],
    rate: '0.00',
    is_default: false,
    description: ''
  });

  const taxTypes: TaxType['tax_type'][] = ['GST', 'IGST', 'CGST', 'SGST', 'Cess'];

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mastersApi.getTaxes();
      if (response.success) {
        setTaxes(response.data.taxes);
      } else {
        setError('Failed to load tax rates.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Connection to server failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '', tax_type: 'GST', rate: '0.00', is_default: false, description: ''
    });
    setIsEditing(false);
    setSelectedTax(null);
    setError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (tax: TaxType) => {
    setSelectedTax(tax);
    setIsViewModalOpen(true);
  };

  const handleEdit = (tax: TaxType) => {
    setSelectedTax(tax);
    setFormData({
      name: tax.name,
      tax_type: tax.tax_type,
      rate: String(tax.rate),
      is_default: !!tax.is_default,
      description: tax.description || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Display name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: formData.name,
      tax_type: formData.tax_type,
      rate: parseFloat(formData.rate),
      is_default: formData.is_default ? 1 : 0,
      description: formData.description
    };

    try {
      let response;
      if (isEditing && selectedTax) {
        response = await mastersApi.updateTax(selectedTax.id, payload);
      } else {
        response = await mastersApi.createTax(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(response.message || 'Failed to save tax rate');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Unable to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (tax: TaxType) => {
    setSelectedTax(tax);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTax) return;
    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteTax(selectedTax.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        alert(response.message || 'Failed to delete tax');
      }
    } catch (err: any) {
      alert(err.message || 'Connection error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilterType('All');
    setFilterDefault('All');
    setSearchTerm('');
  };

  const filteredTaxes = taxes.filter(tax => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      tax.name.toLowerCase().includes(s) ||
      tax.tax_type.toLowerCase().includes(s) ||
      tax.rate.toString().includes(s);

    const matchesType = filterType === 'All' || tax.tax_type === filterType;
    const matchesDefault = filterDefault === 'All' ||
      (filterDefault === 'Default' && !!tax.is_default) ||
      (filterDefault === 'Regular' && !tax.is_default);

    return matchesSearch && matchesType && matchesDefault;
  });

  const isFilterActive = filterType !== 'All' || filterDefault !== 'All';

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'GST': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'IGST': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'CGST': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'SGST': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Cess': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tax Configuration</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Tax Rates</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Plus size={18} />
            Add New Tax
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 flex flex-col gap-6 bg-white border-b border-slate-50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by tax name, type or percentage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 w-full bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 sm:flex-none px-6 py-3 border rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest ${showFilters || isFilterActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Filter size={18} />
                Filters
                {isFilterActive && <div className="w-2 h-2 bg-white rounded-full ml-1" />}
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Advanced Filters
                </h4>
                <button
                  onClick={resetFilters}
                  className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 hover:text-rose-600 transition-colors group"
                >
                  <RotateCcw size={14} className="group-active:rotate-180 transition-transform duration-500" /> Reset All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tax Category</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Types</option>
                      {taxTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Voucher Default</label>
                  <div className="flex gap-2">
                    {['All', 'Default', 'Regular'].map(type => (
                      <button
                        key={type}
                        onClick={() => setFilterDefault(type)}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${filterDefault === type
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="hidden lg:block overflow-x-auto min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <p className="text-sm font-bold text-slate-600">{error}</p>
              <button onClick={fetchData} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Connection</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Tax Name</th>
                  <th className="px-8 py-5">Classification</th>
                  <th className="px-8 py-5">Rate (%)</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTaxes.length > 0 ? filteredTaxes.map((tax) => (
                  <tr key={tax.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          <Percent size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900 text-sm">{tax.name}</div>
                            {!!tax.is_default && (
                              <span title="Default Tax">
                                <Star size={12} className="text-amber-500 fill-amber-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">ID: {tax.id} | {tax.status}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getTypeStyles(tax.tax_type)}`}>
                        {tax.tax_type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900">{parseFloat(String(tax.rate))}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(tax)}
                          title="View Tax Details"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(tax)}
                          title="Edit Tax Rate"
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(tax)}
                          title="Delete Tax"
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Database size={32} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">No tax rates matching your criteria</p>
                        <button onClick={resetFilters} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-6 py-2 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all">Clear Filters</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile & Tablet Card View */}
        <div className="block lg:hidden p-4">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : filteredTaxes.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No Tax Rates Found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredTaxes.map((tax) => (
                <div
                  key={tax.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {tax.name}
                      </h3>

                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${getTypeStyles(
                        tax.tax_type
                      )}`}
                    >
                      {tax.tax_type}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Rate
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {tax.rate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(tax)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(tax)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(tax)}
                      className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {isLoading ? 'Syncing...' : `Showing ${filteredTaxes.length} records`}
          </p>
          <div className="flex gap-2">
            <button disabled className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-300 bg-white shadow-sm">Prev</button>
            <button className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all shadow-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Percent size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Tax Rate' : 'Create New Tax'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Statutory & Tax Master</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <form onSubmit={handleSave} className="space-y-8">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in shake duration-300">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <Activity size={12} /> Tax Parameters
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fabric GST 5%"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tax Type</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.tax_type}
                          onChange={(e) => setFormData({ ...formData, tax_type: e.target.value as any })}
                          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          {taxTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Percentage Rate (%)</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="number"
                          required
                          step="0.01"
                          placeholder="0.00"
                          value={formData.rate}
                          onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, is_default: !formData.is_default })}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Star className={formData.is_default ? "text-amber-500 fill-amber-500" : "text-slate-300"} size={20} />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Set as Primary Default</p>
                        <p className="text-[10px] text-slate-400 font-medium">Pre-selects this tax for all new master entries</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all relative ${formData.is_default ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.is_default ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Description</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-slate-300" size={16} />
                    <textarea
                      placeholder="Regulatory notes or internal classification..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4 -mx-8 -mb-8 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all"
                  >
                    Discard Entry
                  </button>
                  <div className="flex-1" />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {isEditing ? 'Update Rate' : 'Confirm Tax'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedTax && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">View Tax</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">TID-0{selectedTax.id}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-indigo-600 border border-indigo-50 shadow-sm uppercase">
                    {selectedTax.tax_type.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedTax.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {!!selectedTax.is_default && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-amber-50 text-amber-600 rounded-md border border-amber-100 tracking-widest flex items-center gap-1">
                          <Star size={8} className="fill-amber-600" /> System Default
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-widest ${getTypeStyles(selectedTax.tax_type)}`}>
                        {selectedTax.tax_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <Activity size={12} className="text-indigo-600" /> Rate Details
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Tax Type</span>
                      <span className="text-sm font-black text-slate-900">{selectedTax.tax_type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Percentage</span>
                      <span className="text-lg font-black text-indigo-600">{parseFloat(String(selectedTax.rate))}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-600" /> Compliance
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tighter">Status: {selectedTax.status}</p>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tighter">Voucher Mapping: Direct</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                  <FileText size={12} className="text-emerald-600" /> Notes & Policy
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    {selectedTax.description || 'No specific regulatory notes provided for this tax definition.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="w-full sm:w-auto px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
              >
                Close View
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedTax); }}
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Rate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedTax && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <TriangleAlert size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirm Deletion</h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed">
                  Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{selectedTax.name}"</span>?
                  This will affect tax calculations for all linked inventory.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="w-full sm:flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  No, Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="w-full sm:flex-1 px-8 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  Yes, Delete
                </button>
              </div>
            </div>
            <div className="bg-slate-50 py-3 text-center border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Security Protocol Active</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tax;
