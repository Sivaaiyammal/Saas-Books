
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Printer,
  Calendar,
  ArrowLeft,
  Search,
  Filter,
  ChevronRight,
  TrendingUp,
  FileDown,
  Check,
  X,
  Trash2,
  Edit2,
  RotateCcw,
  ChevronDown,
  Eye,
  Building2,
  Phone,
  Hash,
  TriangleAlert,
  Loader2,
  AlertCircle,
  Plus,
  SlidersHorizontal,
  Info,
  ShieldCheck,
  Wallet,
  ArrowUpRight,
  MoreVertical,
  Receipt
} from 'lucide-react';
import { vouchersApi } from '../../services/api';

interface ReceiptInvoice {
  id: number;
  voucher_no: string;
  voucher_date: string;
  receipt_mode?: string;
  party_name: string;
  party_ledger_id: number;
  amount: string;
  received_in_name: string;
  received_in: number;
  reference_no: string | null;
  narration: string | null;
  status: string;
  created_at: string;
  total_amount?: string;
  tds_amount?: string;
  bill_adjustments?: any[];
}

const ReceiptRegister: React.FC = () => {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterParty, setFilterParty] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>(['Posted', 'Draft']);

  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const partyDropdownRef = useRef<HTMLDivElement>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<ReceiptInvoice | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [receipts, setReceipts] = useState<ReceiptInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(event.target as Node)) {
        setIsPartyDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchReceipts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await vouchersApi.getReceipts();
      if (response.success && response.data?.receipts) {
        setReceipts(response.data.receipts);
      } else {
        setError('Failed to load receipt register data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const allParties = useMemo(() => ['All', ...new Set(receipts.map(d => d.party_name).filter(Boolean))], [receipts]);

  const filteredPartyList = useMemo(() => {
    if (!partySearchQuery) return allParties;
    return allParties.filter(p => p.toLowerCase().includes(partySearchQuery.toLowerCase()));
  }, [partySearchQuery, allParties]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return receipts.filter(item => {
      const vNo = (item.voucher_no || '').toLowerCase();
      const pName = (item.party_name || '').toLowerCase();
      const matchesSearch = vNo.includes(term) || pName.includes(term);
      const matchesParty = filterParty === 'All' || item.party_name === filterParty;
      const itemDate = new Date(item.voucher_date).getTime();
      const matchesStartDate = !startDate || itemDate >= new Date(startDate).getTime();
      const matchesEndDate = !endDate || itemDate <= new Date(endDate).getTime();
      const matchesStatus = filterStatus.length === 0 || filterStatus.some(s => s.toLowerCase() === (item.status || '').toLowerCase());
      return matchesSearch && matchesParty && matchesStartDate && matchesEndDate && matchesStatus;
    });
  }, [receipts, searchTerm, filterParty, startDate, endDate, filterStatus]);

  const totalAmount = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + parseFloat(curr.total_amount || '0'), 0);
  }, [filteredData]);

  const resetFilters = () => {
    setFilterParty('All');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setPartySearchQuery('');
    setFilterStatus(['Posted', 'Draft']);
  };

  const toggleStatusFilter = (status: string) => {
    setFilterStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleView = async (bill: ReceiptInvoice) => {
    setSelectedVoucher(bill);
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);

    try {
      const res = await vouchersApi.getReceipt(bill.id);
      if (res.success && res.data) {
        setSelectedVoucher({
          ...bill,
          ...res.data
        });
      }
    } catch (err) {
      console.error('Failed to load receipt details', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEdit = async (bill: ReceiptInvoice) => {
    setOpenMenuId(null);
    try {
      const res = await vouchersApi.getReceipt(bill.id);
      if (res.success && res.data) {
        navigate('/vouchers/receipt', {
          state: {
            editVoucher: {
              ...bill,
              ...res.data
            }
          }
        });
      } else {
        alert(res.message || 'Failed to load receipt for editing.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load receipt for editing.');
    }
  };

  const handleDeleteClick = (bill: ReceiptInvoice) => {
    setOpenMenuId(null);
    setSelectedVoucher(bill);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedVoucher) return;
    setIsDeleting(true);
    try {
      const response = await vouchersApi.deleteReceipt(selectedVoucher.id);
      if (response.success) {
        setReceipts(prev => prev.filter(r => r.id !== selectedVoucher.id));
        setIsDeleteModalOpen(false);
        setSelectedVoucher(null);
      } else {
        alert(response.message || 'Deletion failed.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/reports')} className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Receipt</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-emerald-500" /> Collection Audit Log
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchReceipts} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500">
            <RotateCcw size={20} />
          </button>
          <button onClick={() => navigate('/vouchers/receipt')} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 transform">
            <Plus size={20} /> New Collection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Client or Voucher..."
              className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border rounded-[1.5rem] transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
            <Filter size={24} />
          </button>
        </div>

        <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50 flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Total Receipts</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">₹{totalAmount.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Entries</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">{filteredData.length}</h3>
          </div>
          <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <Hash size={24} />
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl animate-in slide-in-from-top-6 duration-500">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><SlidersHorizontal size={20} /></div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Advanced Audit Controls</h4>
            </div>
            <button onClick={resetFilters} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 px-4 py-2 bg-rose-50 rounded-lg transition-all">Clear Filters</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3 relative" ref={partyDropdownRef}>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Client / Ledger</label>
              <div onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)} className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold flex justify-between items-center cursor-pointer">
                <span className={filterParty === 'All' ? 'text-slate-400' : 'text-slate-900'}>{filterParty}</span>
                <ChevronDown size={20} className="text-slate-400" />
              </div>
              {isPartyDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <input type="text" placeholder="Search..." value={partySearchQuery} onChange={(e) => setPartySearchQuery(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs mb-3 outline-none" />
                  <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                    {filteredPartyList.map(p => (
                      <button key={p} onClick={() => { setFilterParty(p); setIsPartyDropdownOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${filterParty === p ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">From Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold" /></div>
            <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">To Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold" /></div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-4 block">Voucher Status</label>
            <div className="flex flex-wrap gap-3">
              {['Posted', 'Draft', 'Cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${filterStatus.includes(status)
                    ? status === 'Cancelled'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-100'
                      : status === 'Draft'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-100'
                        : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden bento-item">
        <div className="overflow-x-auto overflow-visible">
          <table className="w-full text-left table-fixed min-w-[1200px]">
            <thead className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-8 w-[140px]">Date</th>
                <th className="px-4 py-8 w-[160px]">Voucher No</th>
                <th className="px-4 py-8 w-[140px] text-center">Type</th>
                <th className="px-4 py-8 w-[240px]">Received From</th>
                {/* <th className="px-4 py-8 w-[200px]">Deposited In</th> */}
                <th className="px-4 py-8 w-[170px] text-right">Amount</th>
                <th className="px-4 py-8 w-[130px] text-center">Status</th>
                <th className="px-8 py-8 w-[80px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={8} className="py-40 text-center"><div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-600" size={48} /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading...</p></div></td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={8} className="py-40 text-center"><div className="flex flex-col items-center gap-4 text-slate-300"><Search size={64} /><p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching records found.</p></div></td></tr>
              ) : filteredData.map((receipt) => {
                const isMenuOpen = openMenuId === receipt.id;
                return (
                  <tr key={receipt.id} onClick={() => handleView(receipt)} className="hover:bg-indigo-50/30 transition-all group cursor-pointer relative">
                    <td className="px-8 py-6">
                      <span className="text-[11px] font-black text-slate-900 tracking-tight">{new Date(receipt.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </td>
                    <td className="px-4 py-6"><span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-black tracking-widest rounded-lg border border-indigo-100 uppercase">{receipt.voucher_no}</span></td>
                    <td className="px-4 py-6 text-center">
                      <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                        {receipt.receipt_mode || 'On Account'}
                      </span>
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase">{(receipt.party_name || 'U')[0]}</div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate">{receipt.party_name || 'Unknown Party'}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter">ID: {receipt.party_ledger_id}</span>
                        </div>
                      </div>
                    </td>
                    {/* <td className="px-4 py-6">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Wallet size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold truncate">{receipt.received_in_name || 'N/A'}</span>
                      </div>
                    </td> */}
                    <td className="px-4 py-6 text-right"><span className="text-sm font-black text-emerald-600">₹{parseFloat(receipt.total_amount || '0').toLocaleString()}</span></td>
                    <td className="px-4 py-6 text-center"><span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100">{receipt.status || 'Posted'}</span></td>
                    {/* <td className="px-8 py-6 text-right relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setOpenMenuId(isMenuOpen ? null : receipt.id)} className={`p-2 rounded-xl transition-all ${isMenuOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}><MoreVertical size={20} /></button>
                      {isMenuOpen && (
                        <div ref={menuRef} className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-44 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[110] overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200">
                          <button onClick={() => handleView(receipt)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-all"><Eye size={16} className="text-emerald-400" /> View Passport</button>
                          <button onClick={() => handleEdit(receipt)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-all"><Edit2 size={16} className="text-indigo-400" /> Edit Record</button>
                          <button onClick={() => handleDeleteClick(receipt)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-all"><Trash2 size={16} className="text-rose-400" /> Delete Record</button>
                        </div>
                      )}
                    </td> */}
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(receipt); }}
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(receipt); }}
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5">
          <div className="flex items-center gap-8">
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-emerald-400 mb-1">Total Collections</span><span className="text-3xl font-black tracking-tighter">₹{totalAmount.toLocaleString()}</span></div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-slate-500 mb-1">Entry Density</span><span className="text-xl font-black">{filteredData.length} <span className="text-xs opacity-50">Vouchers</span></span></div>
          </div>
        </div>
      </div>

      {/* Detail View Modal */}
      {isViewModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg" onClick={() => setIsViewModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg"><Receipt size={20} /></div>
                <div><h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Receipt Passport</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedVoucher.voucher_no}</p></div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 text-slate-400 hover:text-rose-500 transition-all bg-white border border-slate-200 rounded-2xl"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              {isLoadingDetails ? (
                <div className="py-20 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-600" size={32} /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing with Cloud Vault...</p></div>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 flex items-center justify-between">
                    <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Receipt Date</p><p className="text-xl font-black text-indigo-900">{selectedVoucher.voucher_date}</p></div>
                    <div className="text-right"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Voucher ID</p><p className="text-xl font-black text-indigo-900 uppercase">{selectedVoucher.voucher_no}</p><p className="text-[10px] font-black text-slate-500 uppercase mt-2">Type: {selectedVoucher.receipt_mode || 'On Account'}</p></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                      <div className="flex items-center gap-3"><Building2 size={16} className="text-indigo-400" /><h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Client Identity</h4></div>
                      <div><p className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedVoucher.party_name}</p><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Account Ledger ID: {selectedVoucher.party_ledger_id}</p><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Account Ledger ID: {selectedVoucher.party_ledger_id}</p></div>
                    </div>


                    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                      <div className="flex items-center gap-3"><Wallet size={16} className="text-emerald-400" /><h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Account Destination</h4></div>
                      <div><p className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedVoucher.received_in_name}</p><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Reference No: {selectedVoucher.reference_no || 'N/A'}</p></div>
                    </div>
                  </div>

                  {selectedVoucher.bill_adjustments && selectedVoucher.bill_adjustments.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Against Bill Adjustments</h4>
                      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50"><tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="px-6 py-4">Bill No</th><th className="px-6 py-4 text-right">Allocated Amount</th></tr></thead>
                          <tbody className="divide-y divide-slate-50">
                            {selectedVoucher.bill_adjustments.map((adj, i) => (
                              <tr key={i}><td className="px-6 py-4 text-xs font-bold text-slate-700">{adj.bill_no || `Bill #${adj.allocation_id}`}</td><td className="px-6 py-4 text-right font-black text-indigo-600 text-xs">₹{parseFloat(adj.amount || '0').toLocaleString()}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-6">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Transaction Value</span>
                      <span className="text-3xl font-black tracking-tighter text-white">₹{parseFloat(selectedVoucher.total_amount || '0').toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Narration</p>
                      <p className="text-xs font-medium text-slate-300 leading-relaxed italic">"{selectedVoucher.narration || 'No narrative provided for this transaction.'}"</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4 sticky bottom-0">
              <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-10 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-[1.5rem]">Close Terminal</button>
              <div className="flex-1" />
              <button onClick={() => { setIsViewModalOpen(false); handleEdit(selectedVoucher); }} className="w-full sm:w-auto px-12 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3"><Edit2 size={18} /> Modify Voucher</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {isDeleteModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-300 p-12 text-center space-y-8">
            <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-rose-100"><TriangleAlert size={48} /></div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cancel Receipt?</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed px-4">Permanently remove receipt <span className="text-indigo-600 font-black">#{selectedVoucher.voucher_no}</span>? This will impact ledger outstandings.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button disabled={isDeleting} onClick={confirmDelete} className="w-full py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">{isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />} Cancel Receipt</button>
              <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptRegister;
