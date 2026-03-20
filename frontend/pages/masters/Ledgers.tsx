
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
  User,
  FolderTree,
  Wallet,
  Zap,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  Building2,
  Navigation,
  Hash,
  Eye,
  CreditCard,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Database,
  Activity,
  LayoutGrid,
  FileText,
  TriangleAlert
} from 'lucide-react';
import { Ledger, LedgerGroup } from '../../types';
import { mastersApi } from '../../services/api';
import { indianStates } from '../../data/voucher-data.ts';

const Ledgers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroup[]>([]);
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
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterNature, setFilterNature] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    group_id: '' as string | number,
    opening_balance: '0.00',
    opening_type: 'Dr' as 'Dr' | 'Cr',
    gst_applicable: false,
    gst_number: '',
    bill_by_bill: false,
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    bank_name: '',
    bank_branch: '',
    account_number: '',
    ifsc_code: '',
    is_default_bank: false
  });

  const bankNames = [
    'Allahabad Bank', 'Andhra Bank', 'Axis Bank',
    'Bank of Bahrain and Kuwait', 'Bank of Baroda - Corporate Banking', 'Bank of Baroda - Retail Banking',
    'Bank of India', 'Bank of Maharashtra',
    'Canara Bank', 'Central Bank of India', 'City Union Bank', 'Corporation Bank',
    'Deutsche Bank', 'Development Credit Bank', 'Dhanlaxmi Bank',
    'Federal Bank',
    'ICICI Bank', 'IDBI Bank', 'Indian Bank', 'Indian Overseas Bank', 'IndusInd Bank', 'ING Vysya Bank',
    'Jammu and Kashmir Bank',
    'Karnataka Bank Ltd', 'Karur Vysya Bank', 'Kotak Bank',
    'Laxmi Vilas Bank',
    'Oriental Bank of Commerce',
    'Punjab National Bank - Corporate Banking', 'Punjab National Bank - Retail Banking', 'Punjab & Sind Bank',
    'Shamrao Vitthal Co-operative Bank', 'South Indian Bank',
    'State Bank of Bikaner & Jaipur', 'State Bank of Hyderabad', 'State Bank of India', 'State Bank of Mysore', 'State Bank of Patiala', 'State Bank of Travancore',
    'Syndicate Bank',
    'Tamilnad Mercantile Bank Ltd.',
    'UCO Bank', 'Union Bank of India', 'United Bank of India',
    'Vijaya Bank',
    'Yes Bank Ltd'
  ];

  const fetchData = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const [ledgersRes, groupsRes] = await Promise.all([
        mastersApi.getLedgers(),
        mastersApi.getLedgerGroups()
      ]);

      if (ledgersRes.success) {
        setLedgers(ledgersRes.data.ledgers);
      } else {
        setListError((ledgersRes as any).message || 'Failed to load ledgers');
      }
      if (groupsRes.success) {
        setLedgerGroups(groupsRes.data.groups);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err) || 'Connection failed';
      setListError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '', group_id: '', opening_balance: '0.00', opening_type: 'Dr',
      gst_applicable: false, gst_number: '', bill_by_bill: false,
      phone: '', email: '', address: '', city: '', state: '', pincode: '',
      bank_name: '', bank_branch: '', account_number: '', ifsc_code: '', is_default_bank: false
    });
    setIsEditing(false);
    setSelectedLedger(null);
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleView = (ledger: Ledger) => {
    setSelectedLedger(ledger);
    setIsViewModalOpen(true);
  };

  const handleEdit = (ledger: Ledger) => {
    setSelectedLedger(ledger);
    setFormData({
      name: ledger.name,
      group_id: ledger.group_id,
      opening_balance: ledger.opening_balance,
      opening_type: ledger.opening_type,
      gst_applicable: ledger.gst_applicable,
      gst_number: ledger.gst_number || '',
      bill_by_bill: ledger.bill_by_bill,
      phone: ledger.phone || '',
      email: ledger.email || '',
      address: ledger.address || '',
      city: ledger.city || '',
      state: ledger.state || '',
      pincode: ledger.pincode || '',
      bank_name: (ledger as any).bank_name || '',
      bank_branch: (ledger as any).bank_branch || '',
      account_number: (ledger as any).account_number || '',
      ifsc_code: (ledger as any).ifsc_code || '',
      is_default_bank: (ledger as any).is_default_bank === 1 || (ledger as any).is_default_bank === true || (ledger as any).is_default_bank === '1'
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const triggerDelete = (ledger: Ledger) => {
    setSelectedLedger(ledger);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLedger) return;

    setIsDeleting(true);
    try {
      const response = await mastersApi.deleteLedger(selectedLedger.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        fetchData(); // Refresh list
      } else {
        alert(response.message || 'Failed to delete ledger');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err) || 'Unknown error';
      alert('Delete Error: ' + msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.group_id) {
      setFormError('Name and Group are mandatory fields.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    // Build the formatted address string
    // const fullAddress = [
    //   formData.address,
    //   formData.city,
    //   indianStates.find(s => s.code === formData.state)?.name,
    //   formData.pincode
    // ].filter(Boolean).join(', ');

    // Exact payload structure as requested
    const payload = {
      name: formData.name,
      group_id: Number(formData.group_id),
      opening_balance: Number(formData.opening_balance),
      opening_type: formData.opening_type,
      gst_applicable: formData.gst_applicable,
      gst_number: formData.gst_applicable ? formData.gst_number : null,
      address: formData.address,
      bill_by_bill: formData.bill_by_bill,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      phone: formData.phone || null,
      email: formData.email || null,
      bank_name: formData.bank_name || null,
      bank_branch: formData.bank_branch || null,
      account_number: formData.account_number || null,
      ifsc_code: formData.ifsc_code || null,
      is_default_bank: formData.is_default_bank ? 1 : 0
    };

    try {
      let response;
      if (isEditing && selectedLedger) {
        response = await mastersApi.updateLedger(selectedLedger.id, payload);
      } else {
        response = await mastersApi.createLedger(payload);
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchData(); // Refresh the list
      } else {
        setFormError(response.message || 'Failed to save ledger');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err) || 'Unknown error';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
    console.log('Payload submitted:', payload);
  };


  const resetFilters = () => {
    setFilterGroup('All');
    setFilterNature('All');
    setSearchTerm('');
  };

  const filteredLedgers = ledgers.filter(ledger => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      ledger.name.toLowerCase().includes(s) ||
      ledger.group_name.toLowerCase().includes(s) ||
      (ledger.gst_number && ledger.gst_number.toLowerCase().includes(s)) ||
      (ledger.phone && ledger.phone.toLowerCase().includes(s));

    const matchesGroup = filterGroup === 'All' || ledger.group_name === filterGroup;
    const matchesNature = filterNature === 'All' || ledger.group_nature === filterNature;

    return matchesSearch && matchesGroup && matchesNature;
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

  const isFilterActive = filterGroup !== 'All' || filterNature !== 'All';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ledger Master</h1>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer">Masters</span>
            <ChevronRight size={10} />
            <span className="text-slate-900">Account Ledgers</span>
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
            Add New Ledger
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
                placeholder="Search by ledger name, group or GST..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3.5 w-full bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all"
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Group</label>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                    >
                      <option value="All">All Groups</option>
                      {ledgerGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Accounting Nature</label>
                  <div className="relative">
                    <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select
                      value={filterNature}
                      onChange={(e) => setFilterNature(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
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
              <button onClick={fetchData} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Connection</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Ledger Identity</th>
                  <th className="px-8 py-5">Group Category</th>
                  <th className="px-8 py-5">Accounting Nature</th>
                  <th className="px-8 py-5">Opening Balance</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedgers.length > 0 ? filteredLedgers.map((ledger) => (
                  <tr key={ledger.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          {ledger.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{ledger.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-widest">ACC-{ledger.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                        {ledger.group_name}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getNatureColor(ledger.group_nature)}`}>
                        {ledger.group_nature}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">₹{parseFloat(ledger.opening_balance).toLocaleString()}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${ledger.opening_type === 'Dr' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {ledger.opening_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={() => handleView(ledger)}
                          title="View Ledger"
                          className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(ledger)}
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => triggerDelete(ledger)}
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
                        <p className="text-sm font-bold text-slate-400">No ledgers found matching search</p>
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
          ) : filteredLedgers.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No ledgers found
            </div>
          ) : (
            <div className="space-y-4">

              {filteredLedgers.map((ledger) => (
                <div
                  key={ledger.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {ledger.name}
                      </h3>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        ACC-{ledger.id}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${getNatureColor(
                        ledger.group_nature
                      )}`}
                    >
                      {ledger.group_nature}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Group
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      {ledger.group_name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      Opening Balance
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      ₹{parseFloat(ledger.opening_balance).toLocaleString()} {ledger.opening_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                    <button
                      onClick={() => handleView(ledger)}
                      title="View Ledger"
                      className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(ledger)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => triggerDelete(ledger)}
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
            {isLoading ? 'Syncing...' : `Total Records: ${filteredLedgers.length}`}
          </p>
          <div className="flex gap-2">
            <button disabled className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-300 bg-white shadow-sm">Prev</button>
            <button className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all shadow-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  {isEditing ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{isEditing ? 'Update Ledger' : 'New Account Ledger'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Account Master Entry</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
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
                    <LayoutGrid size={12} /> Basic Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ledger Name</label>
                      <input
                        type="text"
                        placeholder="e.g. ABC Enterprises"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Under Group</label>
                      <div className="relative">
                        <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <select
                          required
                          value={formData.group_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            const selectedGroup = ledgerGroups.find(g => String(g.id) === val);
                            const nature = selectedGroup?.nature?.toLowerCase() || '';
                            const autoType: 'Dr' | 'Cr' = (nature === 'asset' || nature === 'expense') ? 'Dr' : 'Cr';
                            setFormData({
                              ...formData,
                              group_id: val,
                              ...(selectedGroup ? { opening_type: autoType } : {})
                            });
                          }}
                          className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                        >
                          <option value="">Select Group...</option>
                          {ledgerGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <CreditCard size={12} /> Opening Balance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount</label>
                      <div className="relative">
                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="number"
                          placeholder="0.00"
                          value={formData.opening_balance}
                          onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nature</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, opening_type: 'Dr' })}
                          className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.opening_type === 'Dr' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          Debit (DR)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, opening_type: 'Cr' })}
                          className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.opening_type === 'Cr' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          Credit (CR)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <MapPin size={12} /> Address & Contact
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Physical Address</label>
                    <textarea
                      placeholder="Plot No, Industrial Estate, Landmark..."
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
                        placeholder="e.g. Surat"
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
                          {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pincode</label>
                      <input
                        type="text"
                        placeholder="395001"
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
                          placeholder="9876543210"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          type="email"
                          placeholder="contact@company.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <ShieldCheck size={12} /> Compliance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      onClick={() => setFormData({ ...formData, gst_applicable: !formData.gst_applicable })}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className={formData.gst_applicable ? "text-indigo-600" : "text-slate-300"} size={20} />
                        <span className="text-xs font-bold text-slate-700">GST Applicable?</span>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all relative ${formData.gst_applicable ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.gst_applicable ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                    <div
                      onClick={() => setFormData({ ...formData, bill_by_bill: !formData.bill_by_bill })}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className={formData.bill_by_bill ? "text-indigo-600" : "text-slate-300"} size={20} />
                        <span className="text-xs font-bold text-slate-700">Bill by Bill?</span>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all relative ${formData.bill_by_bill ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.bill_by_bill ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Fields - shown when group is Bank Accounts */}
                  {ledgerGroups.find(g => String(g.id) === String(formData.group_id))?.name === 'Bank Accounts' && (
                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                        <Building2 size={12} /> Bank Details
                      </h3>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Bank Name & Branch</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <select
                              value={formData.bank_name}
                              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                              className="w-full pl-11 pr-10 py-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all"
                            >
                              <option value="">Select Bank...</option>
                              {bankNames.map(bank => (
                                <option key={bank} value={bank}>{bank}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                              type="text"
                              placeholder="Branch Name"
                              value={formData.bank_branch}
                              onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                              className="w-full pl-11 pr-4 py-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all placeholder:text-indigo-200"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Bank Account Number</label>
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                              type="text"
                              placeholder="e.g. 1234567890123456"
                              value={formData.account_number}
                              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                              className="w-full pl-11 pr-4 py-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all placeholder:text-indigo-200"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">IFSC Code</label>
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                              type="text"
                              placeholder="e.g. SBIN0001234"
                              value={formData.ifsc_code}
                              onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                              className="w-full pl-11 pr-4 py-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all uppercase placeholder:text-indigo-200"
                            />
                          </div>
                        </div>
                        <div
                          onClick={() => setFormData({ ...formData, is_default_bank: !formData.is_default_bank })}
                          className="flex items-center gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors group"
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${formData.is_default_bank ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-300'}`}>
                            <Check size={14} strokeWidth={4} className={formData.is_default_bank ? 'opacity-100' : 'opacity-0'} />
                          </div>
                          <label className="text-xs font-bold text-slate-700 cursor-pointer select-none">Set as Default Bank for Transactions</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.gst_applicable && (
                    <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                      <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">GST Registration Number</label>
                      <input
                        type="text"
                        placeholder="29ABCDE1234F1Z5"
                        value={formData.gst_number}
                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all uppercase placeholder:text-indigo-200"
                      />
                    </div>
                  )}
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
                    {isSaving ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Check size={18} />
                    )}
                    {isEditing ? 'Save Changes' : 'Confirm Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal (Ledger) */}
      {isViewModalOpen && selectedLedger && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setIsViewModalOpen(false)} />

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">

            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                  <Eye size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Ledger</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">ACC-{selectedLedger.id}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              {/* Header Info */}
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-indigo-600 border border-indigo-50 shadow-sm uppercase">
                    {selectedLedger.name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedLedger.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-widest ${getNatureColor(selectedLedger.group_nature)}`}>
                        {selectedLedger.group_nature}
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-1 bg-indigo-600 text-white rounded-md tracking-widest">{selectedLedger.group_name}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <CreditCard size={12} className="text-indigo-600" /> Opening Details
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Opening Balance</span>
                      <span className="text-sm font-black text-slate-900">₹{parseFloat(selectedLedger.opening_balance).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Balance Type</span>
                      <span className="text-[10px] font-black uppercase text-indigo-600">{selectedLedger.opening_type}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-600" /> Compliance
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm h-full">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">GST Number</span>
                      <span className="text-[10px] font-black uppercase text-slate-900">{selectedLedger.gst_number || 'Unregistered'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Created At</span>
                      <span className="text-[10px] font-black text-slate-500 uppercase">{selectedLedger.created_at.split(' ')[0]}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details - shown for Bank Accounts group */}
              {selectedLedger.group_name === 'Bank Accounts' && ((selectedLedger as any).bank_name || (selectedLedger as any).account_number || (selectedLedger as any).ifsc_code) && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                    <Building2 size={12} className="text-indigo-600" /> Bank Details
                  </h4>
                  <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Bank Name</span>
                      <span className="text-sm font-black text-slate-900">{(selectedLedger as any).bank_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Branch</span>
                      <span className="text-sm font-black text-slate-900">{(selectedLedger as any).bank_branch || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Account Number</span>
                      <span className="text-sm font-black text-slate-900">{(selectedLedger as any).account_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">IFSC Code</span>
                      <span className="text-[10px] font-black uppercase text-indigo-600">{(selectedLedger as any).ifsc_code || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Address & Communication */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                  <MapPin size={12} className="text-indigo-600" /> Address & Identity
                </h4>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-400"><MapPin size={20} /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Office Address</p>
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">
                        {selectedLedger.address || 'Address not specified'}
                      </p>
                      <p className="text-sm font-black text-indigo-600 mt-1">
                        {selectedLedger.city ? `${selectedLedger.city}, ` : ''}
                        {selectedLedger.state ? `${indianStates.find(s => s.code === selectedLedger.state)?.name || selectedLedger.state} ` : ''}
                        {selectedLedger.pincode ? `- ${selectedLedger.pincode}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Phone size={20} /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Phone</p>
                        <p className="text-sm font-black text-slate-900">{selectedLedger.phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Mail size={20} /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Email</p>
                        <p className="text-sm font-black text-indigo-600">{selectedLedger.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
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
                onClick={() => { setIsViewModalOpen(false); handleEdit(selectedLedger); }}
                className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedLedger && (
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
                  Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{selectedLedger.name}"</span>?
                  This action cannot be undone and will erase all historical mapping for this account.
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

export default Ledgers;
