
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
  Package,
  FolderTree,
  Hash,
  Layers,
  Scale,
  Target,
  Warehouse,
  AlertTriangle,
  Eye,
  Activity,
  Boxes,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Database,
  Tag,
  CreditCard,
  LayoutGrid,
  FileText,
  Calculator,
  ShieldCheck,
  Zap,
  Settings,
  TriangleAlert,
  Palette
} from 'lucide-react';
import { MasterItem, StockItemGroup, Unit, Tax } from '../../types';
import { mastersApi } from '../../services/api';

const StockItems: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [stockGroups, setStockGroups] = useState<StockItemGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MasterItem | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // View variants state
  const [viewVariants, setViewVariants] = useState<any[]>([]);

  interface VariantData {
    id?: number | null;
    name?: string;
    colour: string;
    opening_stock: number;
    opening_rate: number;
  }

  const [variants, setVariants] = useState<VariantData[]>([
    {
      id: null,
      name: '',
      colour: '',
      opening_stock: 0,
      opening_rate: 0
    }
  ]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    description: '',
    item_code: '',
    hsn_code: '',
    colour: '',
    item_group_id: '' as string | number,
    unit_id: '' as string | number,
    opening_stock: '0',
    opening_rate: '0',
    minimum_level: '0',
    maximum_level: '0',
    reorder_level: '0',
    standard_cost: '0',
    standard_price: '0',
    tax_id: '' as string | number,
    is_service: false,
    track_inventory: true,
    status: 'active' as 'active' | 'inactive'
  });

  const fetchData = async (page: number = 1, search?: string) => {
    setIsLoading(true);
    setListError(null);
    try {
      const [itemsRes, groupsRes, unitsRes, taxesRes] = await Promise.all([
        mastersApi.getItems(page, search),
        mastersApi.getStockGroups(),
        mastersApi.getUnits(),
        mastersApi.getTaxes()
      ]);

      if (itemsRes.success) {
        setItems(itemsRes.data.items || []);
        // Handle pagination from nested pagination object
        const pagination = itemsRes.data.pagination;
        if (pagination) {
          setTotalPages(pagination.pages || 1);
          setTotalItems(pagination.total || itemsRes.data.items.length);
        } else {
          setTotalPages(1);
          setTotalItems(itemsRes.data.items.length);
        }
      } else {
        setListError((itemsRes as any).message || 'Failed to load stock items');
      }
      if (groupsRes.success) setStockGroups(groupsRes.data.item_groups);
      if (unitsRes.success) setUnits(unitsRes.data.units);
      if (taxesRes.success) setTaxes(taxesRes.data.taxes);

    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err) || 'Connection failed';
      setListError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Fetch data when page or search changes
  useEffect(() => {
    console.log('Fetching page:', currentPage, 'search:', debouncedSearch);
    fetchData(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch]);

  const resetForm = () => {
    setFormData({
      name: '', alias: '', description: '', item_code: '', hsn_code: '',
      colour: '', item_group_id: '', unit_id: '',
      opening_stock: '0', opening_rate: '0', minimum_level: '0',
      maximum_level: '0', reorder_level: '0', standard_cost: '0',
      standard_price: '0', tax_id: '', is_service: false,
      track_inventory: true, status: 'active',
    });
    setVariants([
      { id: null, name: '', colour: '', opening_stock: 0, opening_rate: 0 }
    ]);
    setIsEditing(false);
    setSelectedItem(null);
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = async (item: MasterItem) => {
    setSelectedItem(item);
    setViewVariants([]);

    // Fetch item with variants from backend
    try {
      const response = await mastersApi.getItem(item.id);
      if (response.success && response.data?.variants) {
        setViewVariants(response.data.variants);
      }
    } catch (err) {
      console.error('Failed to fetch item variants:', err);
    }

    setIsViewModalOpen(true);
  };

  const handleEdit = async (item: MasterItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      alias: item.alias || '',
      description: item.description || '',
      item_code: item.item_code,
      hsn_code: item.hsn_code || '',
      colour: item.colour || '',
      item_group_id: item.item_group_id,
      unit_id: item.unit_id,
      opening_stock: String(item.opening_stock),
      opening_rate: String(item.opening_rate),
      minimum_level: String(item.minimum_level),
      maximum_level: String(item.maximum_level || '0'),
      reorder_level: String(item.reorder_level),
      standard_cost: String(item.standard_cost),
      standard_price: String(item.standard_price),
      tax_id: item.tax_id,
      is_service: Boolean(Number(item.is_service)),
      track_inventory: Boolean(Number(item.track_inventory)),
      status: item.status
    });

    // Fetch item with variants from backend
    try {
      const response = await mastersApi.getItem(item.id);
      if (response.success && response.data?.variants && response.data.variants.length > 0) {
        const loadedVariants: VariantData[] = response.data.variants.map((v: any) => ({
          id: v.id,
          name: v.name || '',
          colour: v.colour || '',
          opening_stock: parseFloat(v.opening_stock) || 0,
          opening_rate: parseFloat(v.opening_rate) || 0
        }));
        setVariants(loadedVariants);
      } else {
        setVariants([{ id: null, name: '', colour: '', opening_stock: 0, opening_rate: 0 }]);
      }
    } catch (err) {
      console.error('Failed to fetch item variants:', err);
      setVariants([{ id: null, name: '', colour: '', opening_stock: 0, opening_rate: 0 }]);
    }

    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.item_group_id || !formData.item_code || !formData.unit_id || !formData.tax_id) {
      setFormError('Name, Code, Group, Unit, and Tax mapping are required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    // Calculate opening value safely
    const opQty = parseFloat(formData.opening_stock) || 0;
    const opRate = parseFloat(formData.opening_rate) || 0;
    const opVal = opQty * opRate;

    // Construct high-integrity payload
    const payload: any = {
      name: formData.name.trim(),
      alias: formData.alias.trim() || null,
      description: formData.description.trim() || null,
      item_code: formData.item_code.trim(),
      item_group_id: Number(formData.item_group_id),
      unit_id: Number(formData.unit_id),
      tax_id: Number(formData.tax_id),
      standard_price: parseFloat(formData.standard_price) || 0,
      is_service: formData.is_service ? 1 : 0,
      track_inventory: formData.track_inventory ? 1 : 0,
      status: formData.status,
      // Textile specifics
      hsn_code: formData.hsn_code.trim() || null,
      colour: formData.colour.trim() || null

    };

    payload.variants = variants
      .filter(v => v.colour)
      .map(v => {
        // Auto-generate variant name: Product Name - Colour
        const variantNameParts = [formData.name.trim()];
        if (v.colour) variantNameParts.push(v.colour);
        const autoName = variantNameParts.length > 1
          ? `${variantNameParts[0]} - ${variantNameParts.slice(1).join(' ')}`
          : variantNameParts[0];

        return {
          id: v.id || null,
          name: v.name || autoName,
          colour: v.colour,
          opening_stock: v.opening_stock,
          opening_rate: v.opening_rate || opRate
        };
      });

    // Add inventory-specific properties
    if (!formData.is_service || formData.track_inventory) {
      payload.opening_stock = opQty;
      payload.opening_rate = opRate;
      payload.opening_value = opVal;
      payload.minimum_level = parseFloat(formData.minimum_level) || 0;
      payload.maximum_level = parseFloat(formData.maximum_level) || 0;
      payload.reorder_level = parseFloat(formData.reorder_level) || 0;
      payload.standard_cost = parseFloat(formData.standard_cost) || 0;
    }

    try {
      let response;
      if (isEditing && selectedItem) {
        response = await mastersApi.updateItem(selectedItem.id, payload);
      } else {
        response = await mastersApi.createItem(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setFormError(response.message || 'Failed to save item');
      }
    } catch (err: any) {
      let msg = err?.response?.data?.message || err?.message || String(err) || 'Unknown error';
      if (err?.response?.data?.errors) {
        const errors = err.response.data.errors;
        msg = Object.keys(errors)
          .map((key) => `${key}: ${(errors as any)[key].join(', ')}`)
          .join(' | ');
      }
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDelete = (item: MasterItem) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;
    setIsDeleting(true);
    try {
      const res = await mastersApi.deleteItem(selectedItem.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        alert(res.message || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setSelectedGroupFilter('All');
    setSelectedStatusFilter('All');
    setSearchTerm('');
  };

  // Filter items by search, group, and status
  // Note: Search is sent to backend, but also filtered client-side as fallback
  const filteredItems = items.filter(item => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (item.name && String(item.name).toLowerCase().includes(s)) ||
      (item.item_code && String(item.item_code).toLowerCase().includes(s)) ||
      (item.item_group_name && String(item.item_group_name).toLowerCase().includes(s)) ||
      (item.colour != null && String(item.colour).toLowerCase().includes(s));

    const matchesGroup = selectedGroupFilter === 'All' || item.item_group_name === selectedGroupFilter;
    const matchesStatus = selectedStatusFilter === 'All' || item.status === selectedStatusFilter.toLowerCase();
    return matchesSearch && matchesGroup && matchesStatus;
  });

  const isFilterActive = selectedGroupFilter !== 'All' || selectedStatusFilter !== 'All';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Inventory</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Items & Services</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(currentPage, debouncedSearch)}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Plus size={18} />
            Add New Item
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
                placeholder="Search colours, names or codes..."
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
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Segmentation
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Group</label>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={selectedGroupFilter}
                      onChange={(e) => setSelectedGroupFilter(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Groups</option>
                      {stockGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                  <div className="flex gap-2">
                    {['All', 'Active', 'Inactive'].map(s => (
                      <button
                        key={s}
                        onClick={() => setSelectedStatusFilter(s)}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedStatusFilter === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        {s}
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
          ) : listError ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <p className="text-sm font-bold text-slate-600">{listError}</p>
              <button onClick={() => fetchData(currentPage, debouncedSearch)} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Connection</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Item Detail</th>
                  <th className="px-8 py-5">Colour</th>
                  <th className="px-8 py-5">Stock Available</th>
                  <th className="px-8 py-5 text-right">Standard Price</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length > 0 ? filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all shadow-inner ${Number(item.is_service) ? 'bg-indigo-50 text-indigo-400' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                          {Number(item.is_service) ? <Activity size={18} /> : item.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {item.name}
                            {Number(item.is_service) === 1 && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">Service</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest uppercase">{item.item_code} | {item.item_group_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {Number(item.is_service) ? (
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">Non-Material Service</span>
                      ) : (
                        <div className="text-xs font-black text-slate-700 uppercase tracking-widest">{item.colour || '--'}</div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-black text-slate-900">
                          {Number(item.track_inventory) ? `${parseFloat(String(item.opening_stock)).toLocaleString()} ` : '-- '}
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit_symbol}</span>
                        </div>
                        {Number(item.track_inventory) === 1 && Number(item.opening_stock) <= Number(item.reorder_level) && (
                          <div className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-md border border-rose-100">
                            <AlertTriangle size={10} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-sm font-black text-slate-900">₹{parseFloat(String(item.standard_price)).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(item)}
                          title="View Passport"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          title="Edit Profile"
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(item)}
                          title="Delete"
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
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
                        <p className="text-sm font-bold text-slate-400">No items found matching criteria</p>
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
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No Stock Items Found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {item.name}
                      </h3>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        {item.id} | {item.item_group_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Colour
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {item.colour || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Standard Price
                    </span>
                    <span className="text-sm font-black text-slate-900">₹{parseFloat(String(item.standard_price)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Available Stock
                    </span>
                    <div className="text-sm font-black text-slate-900">
                      {Number(item.track_inventory) ? `${parseFloat(String(item.opening_stock)).toLocaleString()} ` : '-- '}
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit_symbol}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(item)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(item)}
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
            {isLoading ? 'Syncing...' : `Showing ${filteredItems.length} of ${totalItems} records | Page ${currentPage} of ${totalPages}`}
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl shadow-sm transition-all ${currentPage <= 1 || isLoading
                ? 'text-slate-300 bg-white cursor-not-allowed'
                : 'text-slate-900 bg-white hover:bg-slate-50 active:scale-95'
                }`}
            >
              Prev
            </button>
            <button
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl shadow-sm transition-all ${currentPage >= totalPages || isLoading
                ? 'text-slate-300 bg-white cursor-not-allowed'
                : 'text-slate-900 bg-white hover:bg-slate-50 active:scale-95'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Stock Item' : 'New Stock Item'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Master Database Records</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => setFormData({ ...formData, is_service: !formData.is_service, track_inventory: formData.is_service })}
                  className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl border border-slate-200 hover:border-indigo-600 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${formData.is_service ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-indigo-600'}`}>
                    <Zap size={14} />
                  </div>
                  <div className="pr-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Type</p>
                    <p className="text-[10px] font-bold text-slate-900 leading-none">{formData.is_service ? 'Service' : 'Product'}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <form onSubmit={handleSave} className="space-y-8">
                {formError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in shake duration-300">
                    <AlertCircle size={16} />
                    {formError}
                  </div>
                )}

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <LayoutGrid size={12} /> Core Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Formal Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Cotton Fabric White 60x60"
                        required
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          // Clear variant names so auto-generation uses updated product name
                          setVariants(variants.map((v: VariantData) => ({ ...v, name: '' })));
                        }}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Alias / Internal Name</label>
                      <input
                        type="text"
                        placeholder="CTN-WHT-60"
                        value={formData.alias}
                        onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Code / SKU</label>
                      <input
                        type="text"
                        placeholder="CTN-001"
                        required
                        value={formData.item_code}
                        onChange={(e) => setFormData({ ...formData, item_code: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock Group</label>
                      <div className="relative">
                        <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          required
                          value={formData.item_group_id}
                          onChange={(e) => setFormData({ ...formData, item_group_id: e.target.value })}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Select Group...</option>
                          {stockGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variants & Specifications */}
                {!formData.is_service && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      Variants & Specifications
                    </h3>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Variant Name</th>
                            <th className="px-4 py-3 w-[180px]">Colour</th>
                            <th className="px-4 py-3">Opening Stock</th>
                            <th className="px-4 py-3">Opening Rate</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {variants.map((v, index) => {
                            // Generate variant name preview
                            const nameParts = [formData.name.trim()];
                            if (v.colour) nameParts.push(v.colour);
                            const previewName = nameParts.length > 1
                              ? `${nameParts[0]} - ${nameParts.slice(1).join(' ')}`
                              : (v.name || 'Enter colour');

                            return (
                              <tr key={index}>
                                <td className="px-4 py-2">
                                  <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl truncate max-w-[180px]" title={v.name || previewName}>
                                    {v.name || previewName}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={v.colour}
                                    onChange={(e) => {
                                      const copy = [...variants];
                                      copy[index].colour = e.target.value;
                                      // Clear variant name so auto-generation uses updated colour
                                      copy[index].name = '';
                                      setVariants(copy);
                                    }}
                                    className="w-full font-black px-3 py-2 border rounded-xl text-sm"
                                  />
                                </td>

                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    value={v.opening_stock}
                                    onChange={(e) => {
                                      const copy = [...variants];
                                      copy[index].opening_stock = Number(e.target.value);
                                      setVariants(copy);
                                    }}
                                    className="w-full font-black px-3 py-2 border rounded-xl text-sm"
                                  />
                                </td>

                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={v.opening_rate}
                                    onChange={(e) => {
                                      const copy = [...variants];
                                      copy[index].opening_rate = Number(e.target.value);
                                      setVariants(copy);
                                    }}
                                    className="w-full font-bold px-3 py-2 border rounded-xl text-sm"
                                  />
                                </td>

                                <td className="px-4 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariants(variants.filter((_, i) => i !== index))
                                    }
                                    className="text-rose-500 hover:text-rose-700"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 bg-slate-50 flex items-center justify-between">
                        <span>Total Variant Specifications Managed: {variants.length}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setVariants([
                              ...variants,
                              { id: null, name: '', colour: '', opening_stock: 0, opening_rate: 0 }
                            ]);
                          }}
                          className="px-4 py-2 text-xs font-black uppercase bg-indigo-600 text-white rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all"
                        >
                          <Plus size={14} /> Add Variant
                        </button>
                      </div>
                    </div>
                  </div>
                )}



                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <Settings size={12} /> Mapping & Units
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">HSN Code</label>
                      <input type="text" placeholder="52081100" value={formData.hsn_code} onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unit of Measure</label>
                      <div className="relative">
                        <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          required
                          value={formData.unit_id}
                          onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Select Unit...</option>
                          {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tax Configuration</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          required
                          value={formData.tax_id}
                          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Select Tax...</option>
                          {taxes.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Standard Sales Price</label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="number" step="0.01" placeholder="0.00" value={formData.standard_price} onChange={(e) => setFormData({ ...formData, standard_price: e.target.value })} className="w-full pl-11 pr-4 py-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-2">
                    <div
                      onClick={() => setFormData({ ...formData, track_inventory: !formData.track_inventory })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Boxes className={formData.track_inventory ? "text-indigo-600" : "text-slate-300"} size={20} />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Track Inventory?</p>
                          <p className="text-[9px] text-slate-400 font-medium">Maintain stock levels for this entry</p>
                        </div>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all relative ${formData.track_inventory ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.track_inventory ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                    <div className="flex-1" />
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {formData.track_inventory && (
                  <div className="space-y-5 animate-in slide-in-from-top-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                      <Warehouse size={12} /> Opening & Stock Limits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Opening Qty</label>
                        <input type="number" step="0.001" value={formData.opening_stock} onChange={(e) => setFormData({ ...formData, opening_stock: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Opening Rate</label>
                        <input type="number" step="0.01" value={formData.opening_rate} onChange={(e) => setFormData({ ...formData, opening_rate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Standard Cost</label>
                        <input type="number" step="0.01" value={formData.standard_cost} onChange={(e) => setFormData({ ...formData, standard_cost: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reorder Alert Level</label>
                        <div className="relative">
                          <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={16} />
                          <input type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-rose-50/30 border border-rose-100 rounded-2xl text-sm font-black text-rose-600 focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 outline-none transition-all" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Minimum Buffer Stock</label>
                        <input type="number" value={formData.minimum_level} onChange={(e) => setFormData({ ...formData, minimum_level: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Maximum Capacity</label>
                        <input type="number" value={formData.maximum_level} onChange={(e) => setFormData({ ...formData, maximum_level: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 outline-none transition-all" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Additional Description</label>
                  <textarea placeholder="e.g. Premium stitching service with double reinforced seams..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all min-h-[80px] resize-none" />
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4 -mx-8 -mb-8 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all">Discard Entry</button>
                  <div className="flex-1" />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {isEditing ? 'Update Record' : 'Confirm Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">View Stock Item</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{selectedItem.item_code}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-[1.5rem] flex items-center justify-center text-4xl font-black text-indigo-600 border border-indigo-50 shadow-sm uppercase">
                  {selectedItem.name[0]}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 leading-tight">{selectedItem.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-indigo-600 text-white rounded-lg tracking-widest shadow-md shadow-indigo-100">{selectedItem.item_group_name}</span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest ${selectedItem.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {selectedItem.status}
                    </span>
                    {Number(selectedItem.is_service) === 1 && (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg tracking-widest">Service Item</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <Layers size={14} className="text-indigo-600" /> Catalog Information
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">Alias / ID</span>
                      <span className="text-slate-900 font-black">{selectedItem.alias || '--'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">HSN Code</span>
                      <span className="text-slate-900 font-black">{selectedItem.hsn_code || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">Colour</span>
                      <span className="text-slate-900 font-black">{selectedItem.colour || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">Primary Unit</span>
                      <span className="text-indigo-600 font-black uppercase">{selectedItem.unit_name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">Tax Category</span>
                      <span className="text-indigo-600 font-black">{selectedItem.tax_name} ({selectedItem.tax_rate}%)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <Calculator size={14} className="text-amber-600" /> Commercial Specs
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-4 shadow-sm h-full">
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">Sales Price</span>
                      <span className="text-lg font-black text-slate-900">₹{parseFloat(String(selectedItem.standard_price)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-3">
                      <span className="text-slate-400">Cost Basis</span>
                      <span className="text-slate-900">₹{parseFloat(String(selectedItem.standard_cost)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">Margin Approx</span>
                      <span className="text-emerald-600 font-black">
                        {Number(selectedItem.standard_cost) > 0 ? (((Number(selectedItem.standard_price) - Number(selectedItem.standard_cost)) / Number(selectedItem.standard_cost)) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {Number(selectedItem.track_inventory) === 1 && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <Warehouse size={14} className="text-emerald-600" /> Physical Logistics
                  </h4>
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mt-24" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                      <div>
                        <p className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-2">Total Stock</p>
                        <p className="text-3xl font-black">{parseFloat(String(selectedItem.opening_stock)).toLocaleString()} <span className="text-xs font-bold opacity-50">{selectedItem.unit_symbol}</span></p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2">Valuation</p>
                        <p className="text-2xl font-black">₹{(Number(selectedItem.opening_stock) * Number(selectedItem.opening_rate)).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2">Reorder Level</p>
                        <p className="text-2xl font-black text-rose-400">{parseFloat(String(selectedItem.reorder_level)).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2">Inventory Status</p>
                        <p className={`text-sm font-black uppercase tracking-widest mt-2 ${Number(selectedItem.opening_stock) <= Number(selectedItem.reorder_level) ? 'text-rose-500' : 'text-emerald-400'}`}>
                          {Number(selectedItem.opening_stock) <= Number(selectedItem.reorder_level) ? 'Critically Low' : 'Adequate'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Variants Section */}
              {viewVariants.length > 0 && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                    <Boxes size={14} className="text-indigo-600" /> Product Variants ({viewVariants.length})
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400">
                        <tr>
                          <th className="px-6 py-4">Variant Name</th>
                          <th className="px-6 py-4">Specs</th>
                          <th className="px-6 py-4">Stock</th>
                          <th className="px-6 py-4 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {viewVariants.map((variant: any) => (
                          <tr key={variant.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 text-sm">{variant.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5">{variant.item_code || '--'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                {variant.colour || '--'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-black text-slate-900">
                                {parseFloat(String(variant.opening_stock || 0)).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">{selectedItem.unit_symbol}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-black text-slate-900">
                                ₹{(Number(variant.opening_stock || 0) * Number(variant.opening_rate || 0)).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan={2} className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">
                            Total Variants Stock
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-indigo-600">
                              {viewVariants.reduce((sum: number, v: any) => sum + (parseFloat(v.opening_stock) || 0), 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-indigo-600">
                              ₹{viewVariants.reduce((sum: number, v: any) => sum + ((parseFloat(v.opening_stock) || 0) * (parseFloat(v.opening_rate) || 0)), 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 ml-1">
                  <FileText size={14} className="text-indigo-600" /> Operational Insights
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                  <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                    {selectedItem.description || 'No additional catalog notes provided for this item.'}
                  </p>
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="flex items-center gap-4">
                      <span>Created: {selectedItem.created_at.split(' ')[0]}</span>
                      <span>Last Sync: {selectedItem.updated_at.split(' ')[0]}</span>
                    </div>
                    <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500" /> Verified Record</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4">
              <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Close View</button>
              <div className="flex-1" />
              <button
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedItem); }}
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedItem && (
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
                  Are you sure you want to remove <span className="text-slate-900 font-black">"{selectedItem.name}"</span>?
                  This will erase its entire stock history from the database.
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

export default StockItems;
