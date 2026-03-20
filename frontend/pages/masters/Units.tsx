
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
  Ruler,
  Hash,
  FileText,
  Layers,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Activity,
  Calculator,
  Scale,
  Loader2,
  AlertCircle,
  Database,
  LayoutGrid,
  TriangleAlert
} from 'lucide-react';
import { Unit } from '../../types';
import { mastersApi } from '../../services/api';

const Units: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterDecimals, setFilterDecimals] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    unit_type: 'Quantity' as Unit['unit_type'],
    decimal_places: 0,
    description: ''
  });

  const unitTypes: Unit['unit_type'][] = ['Quantity', 'Length', 'Weight', 'Area', 'Volume', 'Others'];

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mastersApi.getUnits();
      if (response.success) {
        setUnitsList(response.data.units);
      } else {
        setError('Failed to load units.');
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
      name: '',
      symbol: '',
      unit_type: 'Quantity',
      decimal_places: 0,
      description: ''
    });
    setIsEditing(false);
    setSelectedUnit(null);
    setError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsViewModalOpen(true);
  };

  const handleEdit = (unit: Unit) => {
    setSelectedUnit(unit);
    setFormData({
      name: unit.name,
      symbol: unit.symbol,
      unit_type: unit.unit_type,
      decimal_places: unit.decimal_places,
      description: unit.description || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.symbol) {
      setError('Name and Symbol are mandatory.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: formData.name,
      symbol: formData.symbol,
      unit_type: formData.unit_type,
      decimal_places: Number(formData.decimal_places),
      description: formData.description
    };

    try {
      let response;
      if (isEditing && selectedUnit) {
        response = await mastersApi.updateUnit(selectedUnit.id, payload);
      } else {
        response = await mastersApi.createUnit(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(response.message || 'Failed to save unit');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Unable to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUnit) return;
    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteUnit(selectedUnit.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        alert(response.message || 'Failed to delete unit');
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilterType('All');
    setFilterDecimals('All');
    setSearchTerm('');
  };

  const filteredUnits = unitsList.filter(unit => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      unit.name.toLowerCase().includes(s) ||
      unit.symbol.toLowerCase().includes(s);

    const matchesType = filterType === 'All' || unit.unit_type === filterType;
    const matchesDecimals = filterDecimals === 'All' || unit.decimal_places.toString() === filterDecimals;

    return matchesSearch && matchesType && matchesDecimals;
  });

  const isFilterActive = filterType !== 'All' || filterDecimals !== 'All';

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'Quantity': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Length': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Weight': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Area': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Volume': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Units of Measure</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Units</span>
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
            Add New Unit
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
                placeholder="Search unit name or symbol..."
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
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Measurement Criteria
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type Category</label>
                  <div className="relative">
                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Types</option>
                      {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Decimal Precision</label>
                  <div className="flex gap-2">
                    {['All', '0', '1', '2', '3'].map(val => (
                      <button
                        key={val}
                        onClick={() => setFilterDecimals(val)}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${filterDecimals === val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        {val}
                      </button>
                    ))}
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
                  <th className="px-8 py-5">Unit Detail</th>
                  <th className="px-8 py-5">Unit Type</th>
                  <th className="px-8 py-5">Precision</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUnits.length > 0 ? filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          <Ruler size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{unit.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">{unit.symbol} | ID: {unit.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getTypeStyles(unit.unit_type)}`}>
                        {unit.unit_type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Calculator size={14} className="text-slate-300" />
                        <span className="text-sm font-black text-slate-900">{unit.decimal_places} Decimals</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(unit)}
                          title="View Unit Passport"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(unit)}
                          title="Edit Unit"
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(unit)}
                          title="Delete Unit"
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
                        <p className="text-sm font-bold text-slate-400">No units found matching search</p>
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
          ) : filteredUnits.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No units found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {unit.name}
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${getTypeStyles(
                        unit.unit_type
                      )}`}
                    >
                      {unit.unit_type}
                    </span>

                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Precision
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {unit.decimal_places} Decimals
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(unit)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(unit)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(unit)}
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
            {isLoading ? 'Syncing...' : `Showing ${filteredUnits.length} definitions`}
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
                  {isEditing ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Unit' : 'Add New Unit'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Inventory Master Entry</p>
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
                    <Activity size={12} /> Unit Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Formal Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Carton"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Symbol / Alias</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ctn"
                        value={formData.symbol}
                        onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unit Type (Category)</label>
                      <div className="relative">
                        <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          value={formData.unit_type}
                          onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as any })}
                          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Decimal Places</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="number"
                          min="0"
                          max="4"
                          placeholder="0"
                          value={formData.decimal_places}
                          onChange={(e) => setFormData({ ...formData, decimal_places: parseInt(e.target.value) || 0 })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Description</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-slate-300" size={16} />
                    <textarea
                      placeholder="Usage notes for this unit definition..."
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
                    {isEditing ? 'Save Unit' : 'Confirm Unit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Unit Details</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">UID-00{selectedUnit.id}</p>
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
                    {selectedUnit.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedUnit.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-widest ${getTypeStyles(selectedUnit.unit_type)}`}>
                        {selectedUnit.unit_type}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest ${selectedUnit.status === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                        {selectedUnit.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <Calculator size={12} className="text-indigo-600" /> Precision
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Decimals</span>
                      <span className="text-sm font-black text-slate-900">{selectedUnit.decimal_places}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Scale</span>
                      <span className="text-sm font-black text-indigo-600">
                        1.0{'0'.repeat(selectedUnit.decimal_places)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <Scale size={12} className="text-emerald-600" /> Usage Policy
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">Inventory: Trackable</p>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">Type: {selectedUnit.unit_type}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                  <FileText size={12} className="text-emerald-600" /> Functional Notes
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    {selectedUnit.description || 'No additional functional notes for this unit.'}
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
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedUnit); }}
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
      {isDeleteModalOpen && selectedUnit && (
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
                  Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{selectedUnit.name}"</span>?
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

export default Units;
