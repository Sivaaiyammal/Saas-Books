
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
  FileText,
  Layers,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Activity,
  Box,
  Tag,
  Loader2,
  AlertCircle,
  Database,
  LayoutGrid,
  TriangleAlert
} from 'lucide-react';
import { StockItemGroup } from '../../types';
import { mastersApi } from '../../services/api';

const StockItemGroups: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupsList, setGroupsList] = useState<StockItemGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<StockItemGroup | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterParent, setFilterParent] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '' as string | number,
    group_type: 'Raw Material' as StockItemGroup['group_type'],
    description: '',
    status: 'active' as 'active' | 'inactive'
  });

  const groupTypes: StockItemGroup['group_type'][] = [
    'Raw Material',
    'Finished Goods',
    'Work in Progress',
    'Consumables',
    'Services',
    'Other'
  ];

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mastersApi.getStockGroups();
      if (response.success) {
        setGroupsList(response.data.item_groups);
      } else {
        setError('Failed to load item groups.');
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
      name: '', parent_id: '', group_type: 'Raw Material', description: '', status: 'active'
    });
    setIsEditing(false);
    setSelectedGroup(null);
    setError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (group: StockItemGroup) => {
    setSelectedGroup(group);
    setIsViewModalOpen(true);
  };

  const handleEdit = (group: StockItemGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      parent_id: group.parent_id === null ? '' : group.parent_id,
      group_type: group.group_type,
      description: group.description || '',
      status: group.status
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
      group_type: formData.group_type,
      description: formData.description || '',
      status: formData.status
    };

    try {
      let response;
      if (isEditing && selectedGroup) {
        response = await mastersApi.updateStockGroup(selectedGroup.id, payload);
      } else {
        response = await mastersApi.createStockGroup(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(response.message || 'Failed to save group');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Unable to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (group: StockItemGroup) => {
    setSelectedGroup(group);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedGroup) return;
    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteStockGroup(selectedGroup.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchData();
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
    setFilterType('All');
    setFilterParent('All');
    setSearchTerm('');
  };

  const filteredGroups = groupsList.filter(group => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      group.name.toLowerCase().includes(s) ||
      group.group_type.toLowerCase().includes(s) ||
      (group.description && group.description.toLowerCase().includes(s));

    const matchesType = filterType === 'All' || group.group_type === filterType;
    const matchesParent = filterParent === 'All' ||
      (filterParent === 'Primary' && !group.parent_id) ||
      (group.parent_name === filterParent);

    return matchesSearch && matchesType && matchesParent;
  });

  const isFilterActive = filterType !== 'All' || filterParent !== 'All';

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'Raw Material': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Finished Goods': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Work in Progress': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Consumables': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Services': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Item Groups</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Inventory Groups</span>
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
            Add New Group
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
                placeholder="Search group name or type..."
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
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Hierarchy Filters
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Type</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Types</option>
                      {groupTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Parents</option>
                      <option value="Primary">Primary (No Parent)</option>
                      {Array.from(new Set(groupsList.map(g => g.parent_name).filter(Boolean))).map(p => (
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
              <button onClick={fetchData} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Connection</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Group Name</th>
                  <th className="px-8 py-5">Hierarchy (Parent)</th>
                  <th className="px-8 py-5">Classification</th>
                  <th className="px-8 py-5">Item Count</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          <Box size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{group.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest">ID: {group.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <FolderTree size={14} className="text-slate-300" />
                        {group.parent_name || 'Primary'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getTypeStyles(group.group_type)}`}>
                        {group.group_type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1.5">
                        <Tag size={12} className="text-slate-300" />
                        <span className="text-sm font-bold text-slate-600">{group.item_count} Items</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(group)}
                          title="View Group Passport"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(group)}
                          title="Edit Group"
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(group)}
                          title="Delete Group"
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Box size={32} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">No stock groups found matching search</p>
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
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No groups found
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
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${getTypeStyles(
                        group.group_type
                      )}`}
                    >
                      {group.group_type}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Parent
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {group.parent_name || 'Primary'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Item Count
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {group.item_count} Items
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

        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {isLoading ? 'Syncing...' : `Total Records: ${filteredGroups.length}`}
          </p>
          <div className="flex gap-2">
            <button disabled className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-300 bg-white shadow-sm">Prev</button>
            <button className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all shadow-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Box size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Stock Item Group' : 'New Stock Item Group'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Classification Master Entry</p>
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
                    <Activity size={12} /> Group Configuration
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Linen Blends"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Type</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.group_type}
                          onChange={(e) => setFormData({ ...formData, group_type: e.target.value as any })}
                          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          {groupTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Parent Category</label>
                      <div className="relative">
                        <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.parent_id}
                          onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Primary (Top Level)</option>
                          {groupsList.filter(g => !selectedGroup || g.id !== selectedGroup.id).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Description</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-slate-300" size={16} />
                    <textarea
                      placeholder="Internal classification notes or summary..."
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
                    {isEditing ? 'Update Group' : 'Confirm Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
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
                  <h2 className="text-xl font-black text-slate-900">View Stock Item Group</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">G-{selectedGroup.id}</p>
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
                    {selectedGroup.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedGroup.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-widest ${getTypeStyles(selectedGroup.group_type)}`}>
                        {selectedGroup.group_type}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest ${selectedGroup.status === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                        {selectedGroup.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <FolderTree size={12} className="text-indigo-600" /> Hierarchy
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Parent Category</span>
                      <span className="text-sm font-black text-slate-900">{selectedGroup.parent_name || 'Primary'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Created On</span>
                      <span className="text-[10px] font-black uppercase text-indigo-600">{selectedGroup.created_at.split(' ')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <Activity size={12} className="text-emerald-600" /> Stats
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">Total Items: {selectedGroup.item_count || 0}</p>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">Updated: {selectedGroup.updated_at.split(' ')[0]}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                  <FileText size={12} className="text-emerald-600" /> Classification Notes
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    {selectedGroup.description || 'No additional functional notes provided for this category definition.'}
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
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Category
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
                  Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{selectedGroup.name}"</span>?
                  Sub-groups and items will need to be re-categorized manually.
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

export default StockItemGroups;
