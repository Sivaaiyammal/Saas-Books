
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
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Scale,
  Star,
  Navigation,
  Hash,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  Eye,
  LayoutGrid,
  Loader2,
  AlertCircle,
  Database,
  TriangleAlert
} from 'lucide-react';
import { Godown } from '../../types';
import { mastersApi } from '../../services/api';
import { indianStates } from '../../data/voucher-data.ts';

const Godowns: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [godownsList, setGodownsList] = useState<Godown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGodown, setSelectedGodown] = useState<Godown | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterState, setFilterState] = useState('All');
  const [filterDefault, setFilterDefault] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    gst_no: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    manager_name: '',
    capacity: '',
    is_default: false,
    description: '',
    status: 'active' as 'active' | 'inactive'
  });

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mastersApi.getGodowns();
      // console.log('Godowns API response:', response);
      if (response.success) {
        // console.log('Godowns data:', response.data.godowns);
        setGodownsList(response.data.godowns);
      } else {
        setError('Failed to load storage facilities.');
      }
    } catch (err: any) {
      // console.error('Fetch error:', err);
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
      name: '', code: '', gst_no: '', address: '', city: '', state: '', pincode: '',
      phone: '', email: '', manager_name: '', capacity: '', is_default: false, description: '', status: 'active'
    });
    setIsEditing(false);
    setSelectedGodown(null);
    setError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (godown: Godown) => {
    setSelectedGodown(godown);
    setIsViewModalOpen(true);
  };

  const handleEdit = (godown: Godown) => {
    // console.log('Editing godown:', godown);
    // console.log('GST field values - gstin:', (godown as any).gstin, 'gst_no:', godown.gst_no);
    setSelectedGodown(godown);
    // Backend uses 'gstin' field name
    const gstValue = (godown as any).gstin || godown.gst_no || '';
    setFormData({
      name: godown.name,
      code: godown.code,
      gst_no: gstValue,
      address: godown.address,
      city: godown.city || '',
      state: godown.state || '',
      pincode: godown.pincode || '',
      phone: godown.phone || '',
      email: godown.email || '',
      manager_name: godown.manager_name || '',
      capacity: godown.capacity || '',
      is_default: !!godown.is_default,
      description: godown.description || '',
      status: godown.status
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      setError('Godown Name and Code are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: formData.name,
      code: formData.code,
      gstin: formData.gst_no,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      phone: formData.phone,
      email: formData.email,
      manager_name: formData.manager_name,
      capacity: formData.capacity,
      is_default: formData.is_default ? 1 : 0,
      description: formData.description,
      status: formData.status
    };

    try {
      let response;
      if (isEditing && selectedGodown) {
        response = await mastersApi.updateGodown(selectedGodown.id, payload);
      } else {
        response = await mastersApi.createGodown(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(response.message || 'Failed to save godown');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Unable to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (godown: Godown) => {
    setSelectedGodown(godown);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedGodown) return;

    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteGodown(selectedGodown.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        alert(response.message || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message || 'Connection error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilterState('All');
    setFilterDefault('All');
    setSearchTerm('');
  };

  const filteredGodowns = godownsList.filter(godown => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      godown.name.toLowerCase().includes(s) ||
      godown.code.toLowerCase().includes(s) ||
      (godown.city && godown.city.toLowerCase().includes(s)) ||
      (godown.manager_name && godown.manager_name.toLowerCase().includes(s));

    const matchesState = filterState === 'All' || godown.state === filterState || godown.state === indianStates.find(st => st.name === filterState)?.code;
    const matchesDefault = filterDefault === 'All' ||
      (filterDefault === 'Default' && !!godown.is_default) ||
      (filterDefault === 'Regular' && !godown.is_default);

    return matchesSearch && matchesState && matchesDefault;
  });

  const isFilterActive = filterState !== 'All' || filterDefault !== 'All';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Godown Management</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Godowns</span>
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
            Add New Godown
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
                placeholder="Search by name, code, city or manager..."
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
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Filter Criteria
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">State Location</label>
                  <div className="relative">
                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterState}
                      onChange={(e) => setFilterState(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All States</option>
                      {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
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
                  <th className="px-8 py-5">Godown Name</th>
                  <th className="px-8 py-5">GSTIN</th>
                  <th className="px-8 py-5">Phone</th>
                  <th className="px-8 py-5">Location</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGodowns.length > 0 ? filteredGodowns.map((godown) => (
                  <tr key={godown.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          {godown.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900 text-sm">{godown.name}</div>
                            {!!godown.is_default && (
                              <span title="Default Godown">
                                <Star size={12} className="text-amber-500 fill-amber-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">{godown.code} | {godown.capacity || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-indigo-600 uppercase">{godown.gst_no || '--'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{godown.phone || '--'}</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">{godown.manager_name || '--'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{godown.city || 'N/A'}</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
                          {godown.state || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(godown)}
                          title="View Details"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(godown)}
                          title="Edit Godown"
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(godown)}
                          title="Delete Godown"
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
                        <p className="text-sm font-bold text-slate-400">No godowns matching criteria</p>
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
          ) : filteredGodowns.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No Stock Items Found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredGodowns.map((godown) => (
                <div
                  key={godown.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-black text-slate-900">{godown.name}</div>
                        {!!godown.is_default && (
                          <span title="Default Godown">
                            <Star size={12} className="text-amber-500 fill-amber-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">{godown.code} | {godown.capacity}</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      GSTIN
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {godown.gst_no || '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      PHONE
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {godown.phone || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      LOCATION
                    </span>
                    <div className="text-sm font-black text-slate-900">
                      {godown.city || 'N/A'} <span className="text-xs font-bold text-slate-400">|</span> {godown.state || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(godown)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(godown)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(godown)}
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

        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {isLoading ? 'Syncing...' : `Showing ${filteredGodowns.length} records`}
          </p>
          <div className="flex gap-2">
            <button disabled className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-300 bg-white">Prev</button>
            <button className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all">Next</button>
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Building2 size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Godown' : 'New Godown'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Inventory Storage Master</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <form onSubmit={handleSave} className="space-y-8">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in shake duration-300">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {/* Primary Info Section */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <LayoutGrid size={12} /> General Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Godown Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Main Warehouse"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Godown Code</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="text"
                          required
                          placeholder="WH001"
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">GSTIN (GST Number)</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={16} />
                      <input
                        type="text"
                        placeholder="e.g. 33AAAAA0000A1Z5"
                        maxLength={15}
                        value={formData.gst_no}
                        onChange={(e) => setFormData({ ...formData, gst_no: e.target.value.toUpperCase() })}
                        className="w-full pl-11 pr-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-sm font-black text-indigo-600 focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all uppercase tracking-wider"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium ml-1">15-character GST Identification Number</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Manager Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={formData.manager_name}
                          onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Storage Capacity</label>
                      <div className="relative">
                        <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="text"
                          placeholder="e.g. 50,000 Sq.Ft"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
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
                        <p className="text-xs font-bold text-slate-700">Set as Default Godown</p>
                        <p className="text-[10px] text-slate-400 font-medium">Auto-selects this godown for new transactions</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all relative ${formData.is_default ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.is_default ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {/* Location & Contact */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <MapPin size={12} /> Location & Contact
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Physical Address</label>
                    <textarea
                      placeholder="House/Plot No, Industrial Estate, Area..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all min-h-[80px] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">State</label>
                      <div className="relative">
                        <select
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Select State...</option>
                          {indianStates.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pincode</label>
                      <input
                        type="text"
                        placeholder="560001"
                        maxLength={6}
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="tel"
                          placeholder="+91 00000 00000"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="email"
                          placeholder="warehouse@company.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {/* Additional Details */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Description / Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-slate-300" size={16} />
                    <textarea
                      placeholder="Additional details about the facility..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
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
                    {isEditing ? 'Save Changes' : 'Confirm Godown'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedGodown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">

            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">View Godown</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{selectedGodown.code}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              {/* Header Info */}
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl font-black text-indigo-600 border border-indigo-50 shadow-sm">
                    {selectedGodown.name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedGodown.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {!!selectedGodown.is_default && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-amber-50 text-amber-600 rounded-md border border-amber-100 tracking-widest">Default Facility</span>
                      )}
                      <span className={`text-[9px] font-black uppercase px-2 py-1 bg-indigo-600 text-white rounded-md tracking-widest ${selectedGodown.status === 'active' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
                        {selectedGodown.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <LayoutGrid size={12} className="text-indigo-600" /> Operational Specs
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Manager</span>
                      <span className="text-sm font-black text-slate-900">{selectedGodown.manager_name || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Capacity</span>
                      <span className="text-sm font-black text-slate-900">{selectedGodown.capacity || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Contact</span>
                      <span className="text-sm font-black text-indigo-600">{selectedGodown.phone || '--'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                      <span className="text-xs font-bold text-slate-400">GSTIN</span>
                      <span className="text-sm font-black text-indigo-600 uppercase tracking-wider">{(selectedGodown as any).gstin || selectedGodown.gst_no || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <MapPin size={12} className="text-rose-600" /> Physical Location
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">{selectedGodown.address}</p>
                    <p className="text-sm font-black text-slate-900">
                      {selectedGodown.city || 'N/A'}, {selectedGodown.state || 'N/A'} {selectedGodown.pincode ? `- ${selectedGodown.pincode}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                  <FileText size={12} className="text-emerald-600" /> Description & Notes
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    {selectedGodown.description || 'No additional notes provided for this facility.'}
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
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedGodown); }}
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedGodown && (
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
                  Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{selectedGodown.name}"</span>?
                  This action cannot be undone and may affect inventory balances.
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

export default Godowns;
