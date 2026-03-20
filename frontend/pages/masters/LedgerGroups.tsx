
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
  FolderTree,
  Users,
  RotateCcw,
  Loader2,
  AlertCircle,
  Database,
  Eye,
  Activity,
  ShieldCheck,
  LayoutGrid,
  FileText,
  SlidersHorizontal,
  Tag,
  TriangleAlert,
  Star
} from 'lucide-react';
import { LedgerGroup } from '../../types';
import { mastersApi } from '../../services/api';

const LedgerGroups: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<LedgerGroup | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterNature, setFilterNature] = useState('All');
  const [filterParent, setFilterParent] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '' as string | number,
    nature: 'Asset',
    affects_gross_profit: 0
  });

  const fetchGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mastersApi.getLedgerGroups();
      if (response.success) {
        setGroups(response.data.groups);
      } else {
        setError('Failed to load ledger groups.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Connection to server failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      parent_id: '',
      nature: 'Asset',
      affects_gross_profit: 0
    });
    setIsEditing(false);
    setSelectedGroup(null);
    setError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (group: LedgerGroup) => {
    setSelectedGroup(group);
    setIsViewModalOpen(true);
  };

  const handleEdit = (group: LedgerGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      parent_id: group.parent_id || '',
      nature: group.nature,
      affects_gross_profit: group.affects_gross_profit
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Group name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: formData.name,
      parent_id: formData.parent_id && formData.parent_id !== '' ? Number(formData.parent_id) : null,
      nature: formData.nature,
      affects_gross_profit: formData.affects_gross_profit
    };

    try {
      let response;
      if (isEditing && selectedGroup) {
        response = await mastersApi.updateLedgerGroup(selectedGroup.id, payload);
      } else {
        response = await mastersApi.createLedgerGroup(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchGroups();
      } else {
        setError(response.message || 'Failed to save group');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (group: LedgerGroup) => {
    setSelectedGroup(group);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedGroup) return;
    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteLedgerGroup(selectedGroup.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchGroups();
      } else {
        alert(response.message || 'Failed to delete group');
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilterNature('All');
    setFilterParent('All');
    setSearchTerm('');
  };

  const filteredGroups = groups.filter(group => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      group.name.toLowerCase().includes(s) ||
      (group.parent_name && group.parent_name.toLowerCase().includes(s)) ||
      group.nature.toLowerCase().includes(s);

    const matchesNature = filterNature === 'All' || group.nature === filterNature;
    const matchesParent = filterParent === 'All' ||
      (filterParent === 'Primary' && !group.parent_id) ||
      (group.parent_name === filterParent);

    return matchesSearch && matchesNature && matchesParent;
  });

  const getNatureColor = (nature: string) => {
    switch (nature.toLowerCase()) {
      case 'asset': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'liability': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'income': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
      case 'expense': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const isFilterActive = filterNature !== 'All' || filterParent !== 'All';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ledger Groups</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Account Groups</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchGroups}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 transition-transform duration-500"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Plus size={18} />
            Add New Group
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 flex flex-col gap-6 bg-white border-b border-slate-50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by group name, nature or parent category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3.5 w-full bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all shadow-inner"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 sm:flex-none px-6 py-3.5 border rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest ${showFilters || isFilterActive
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

          {/* Advanced Filter Panel */}
          {showFilters && (
            <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Hierarchy & Nature
                </h4>
                <button
                  onClick={resetFilters}
                  className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 hover:text-rose-600 transition-colors group"
                >
                  <RotateCcw size={14} className="group-active:rotate-180 transition-transform duration-500" /> Reset Filters
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Accounting Nature</label>
                  <div className="relative">
                    <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterNature}
                      onChange={(e) => setFilterNature(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-sm"
                    >
                      <option value="All">All Natures</option>
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Parent Category</label>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterParent}
                      onChange={(e) => setFilterParent(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-sm"
                    >
                      <option value="All">All Parents</option>
                      <option value="Primary">Primary (No Parent)</option>
                      {Array.from(new Set(groups.map(g => g.parent_name).filter(Boolean))).map(p => (
                        <option key={p!} value={p!}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="lg:block hidden overflow-x-auto min-h-[400px]">
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
              <button onClick={fetchGroups} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Connection</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Group Identity</th>
                  <th className="px-8 py-5">Hierarchy (Parent)</th>
                  <th className="px-8 py-5">Classification</th>
                  <th className="px-8 py-5">Sub-Levels</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all shadow-inner ${group.is_system ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                          <FolderTree size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {group.name}
                            {!!group.is_system && (
                              <span title="System Protected">
                                <ShieldCheck size={12} className="text-slate-300" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">
                            {group.is_system ? 'System Core' : `USER-GRP-${group.id}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {group.parent_name ? (
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                          {group.parent_name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                          <Star size={10} className="fill-slate-100" /> Primary Group
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getNatureColor(group.nature)}`}>
                        {group.nature}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-slate-300" />
                        <span className="text-sm font-bold text-slate-600">{group.child_count} Members</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(group)}
                          title="View Group"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(group)}
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={group.is_system === 1}
                          title={group.is_system ? "System groups cannot be modified" : "Edit Group"}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(group)}
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={group.is_system === 1}
                          title={group.is_system ? "System groups cannot be deleted" : "Delete Group"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Database size={32} />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching ledger groups found</p>
                        <button onClick={resetFilters} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-6 py-2 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all shadow-sm">Clear Selection</button>
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
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No Ledger groups found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {group.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${getNatureColor(
                        group.nature
                      )}`}
                    >
                      {group.nature}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Parent
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {group.parent_name || 'Primary Group'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Classification
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {group.child_count} Members
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(group)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(group)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(group)}
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


        {/* Table Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {isLoading ? 'Fetching data...' : `Analysis of ${filteredGroups.length} categories`}
          </p>
          <div className="flex gap-2">
            <button disabled className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-300 bg-white">Prev</button>
            <button className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all shadow-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Ledger Group' : 'New Ledger Group'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Hierarchy Master Entry</p>
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
                    <LayoutGrid size={12} /> Basic Definition
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Regional Bank Accounts"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Accounting Nature</label>
                      <div className="relative">
                        <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.nature}
                          onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-sm"
                        >
                          <option value="Asset">Asset</option>
                          <option value="Liability">Liability</option>
                          <option value="Income">Income</option>
                          <option value="Expense">Expense</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Under Parent</label>
                      <div className="relative">
                        <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.parent_id}
                          onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-sm"
                        >
                          <option value="">Primary (Top Level)</option>
                          {groups.filter(g => !selectedGroup || g.id !== selectedGroup.id).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <Tag size={12} /> Advanced Behavior
                  </h3>
                  <div
                    onClick={() => setFormData({ ...formData, affects_gross_profit: formData.affects_gross_profit ? 0 : 1 })}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className={formData.affects_gross_profit ? "text-indigo-600" : "text-slate-300"} size={20} />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Affects Gross Profit?</p>
                        <p className="text-[10px] text-slate-400 font-medium">Include in Trading Account calculations</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all relative ${formData.affects_gross_profit ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.affects_gross_profit ? 'right-1' : 'left-1'}`} />
                    </div>
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
                    {isEditing ? 'Save Changes' : 'Confirm Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal (Group Passport) */}
      {isViewModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">View Ledger Group</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">GRP-{selectedGroup.id}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-indigo-600 border border-indigo-50 shadow-sm uppercase">
                    {selectedGroup.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedGroup.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-widest ${getNatureColor(selectedGroup.nature)}`}>
                        {selectedGroup.nature}
                      </span>
                      {selectedGroup.is_system ? (
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-900 text-white rounded-md tracking-widest">System Protected</span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-indigo-600 text-white rounded-md tracking-widest">User Defined</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <FolderTree size={12} className="text-indigo-600" /> Hierarchy
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">Parent Category</span>
                      <span className="font-black text-slate-900 uppercase tracking-tighter">{selectedGroup.parent_name || 'Primary'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">Direct Members</span>
                      <span className="font-black text-indigo-600">{selectedGroup.child_count} Units</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <Activity size={12} className="text-emerald-600" /> Behavior
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">Affects GP?</span>
                      <span className="font-black text-slate-900 uppercase tracking-tighter">{selectedGroup.affects_gross_profit ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">Created On</span>
                      <span className="font-black text-slate-500 uppercase tracking-tighter">{selectedGroup.created_at.split(' ')[0]}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                  <FileText size={12} className="text-emerald-600" /> Accounting Intelligence
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    This category organizes accounts with <span className="text-indigo-600">{selectedGroup.nature}</span> characteristics. {selectedGroup.is_system ? 'It is a system-level master and integral to statutory reporting.' : 'It is a custom hierarchy defined for specialized departmental tracking.'}
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
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedGroup); }}
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={selectedGroup.is_system === 1}
              >
                <Edit size={18} />
                Edit Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedGroup && (
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
                  Are you sure you want to remove <span className="text-slate-900 font-black">"{selectedGroup.name}"</span>?
                  This will disrupt any linked child categories and ledger mappings.
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

export default LedgerGroups;
