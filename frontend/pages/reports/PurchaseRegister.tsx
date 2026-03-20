
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
  FileSpreadsheet,
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
  MapPin,
  Hash,
  Truck,
  TriangleAlert,
  Loader2,
  AlertCircle,
  Package,
  Plus,
  SlidersHorizontal,
  Palette,
  Layers,
  Info,
  ShieldCheck,
  TrendingDown,
  MoreVertical
} from 'lucide-react';
import { vouchersApi, settingsApi } from '../../services/api';

interface PurchaseInvoice {
  id: number;
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  party_gstin: string | null;
  billing_name: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  billing_gstin: string | null;
  billing_phone: string | null;
  consignee_same_as_billing: number;
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_city: string | null;
  consignee_state: string | null;
  consignee_pincode: string | null;
  consignee_gstin: string | null;
  consignee_phone: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  place_of_supply: string | null;
  total_amount: string;
  narration: string | null;
  status: string;
  item_count: number;
  reference_no: string | null;
  created_at: string;
  items?: any[];
}

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return a[n];
    let s = b[Math.floor(n / 10)];
    if (n % 10 > 0) s += '-' + a[n % 10];
    return s + ' ';
  };

  const n = Math.floor(num || 0);
  if (n === 0) return 'Zero';

  let str = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n / 100000) % 100);
  const thousand = Math.floor((n / 1000) % 100);
  const hundred = Math.floor((n / 100) % 10);
  const rest = n % 100;

  if (crore > 0) str += convert(crore) + 'Crore ';
  if (lakh > 0) str += convert(lakh) + 'Lakh ';
  if (thousand > 0) str += convert(thousand) + 'Thousand ';
  if (hundred > 0) str += convert(hundred) + 'Hundred ';
  if (rest > 0) str += convert(rest);

  return str.trim() + ' Rupees Only';
};

const PurchaseRegister: React.FC = () => {
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);
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

  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<PurchaseInvoice | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
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

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await vouchersApi.getPurchaseVouchers();
      if (response.success && response.data?.invoices) {
        setInvoices(response.data.invoices);
      } else {
        setError('Failed to load purchase register data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const fetchSettings = async () => {
      try {
        const response = await settingsApi.getGstSettings();
        if (response.success && response.data) {
          setBusinessDetails(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);

  const allParties = useMemo(() => ['All', ...new Set(invoices.map(d => d.party_name).filter(Boolean))], [invoices]);

  const filteredPartyList = useMemo(() => {
    if (!partySearchQuery) return allParties;
    return allParties.filter(p => p.toLowerCase().includes(partySearchQuery.toLowerCase()));
  }, [partySearchQuery, allParties]);

  const filteredPurchaseData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter(item => {
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
  }, [invoices, searchTerm, filterParty, startDate, endDate, filterStatus]);

  const totalFilteredAmount = useMemo(() => {
    return filteredPurchaseData.reduce((acc, curr) => acc + parseFloat(curr.total_amount || '0'), 0);
  }, [filteredPurchaseData]);

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

  const toggleSelectBill = (voucherNo: string) => {
    setSelectedBills(prev =>
      prev.includes(voucherNo) ? prev.filter(b => b !== voucherNo) : [...prev, voucherNo]
    );
  };

  const toggleSelectAll = () => {
    if (selectedBills.length === filteredPurchaseData.length && filteredPurchaseData.length > 0) {
      setSelectedBills([]);
    } else {
      setSelectedBills(filteredPurchaseData.map(b => b.voucher_no));
    }
  };

  const handleView = async (bill: PurchaseInvoice) => {
    setSelectedVoucher(bill);
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);

    try {
      const res = await vouchersApi.getPurchaseVoucher(bill.id);
      if (res.success && res.data) {
        setSelectedVoucher({
          ...bill,
          ...res.data,
          items: res.data.items || []
        });
      }
    } catch (err) {
      console.error('Failed to load voucher details', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEdit = async (bill: PurchaseInvoice) => {
    setOpenMenuId(null);
    try {
      const res = await vouchersApi.getPurchaseVoucher(bill.id);
      if (res.success && res.data) {
        navigate('/vouchers/purchase', {
          state: {
            editVoucher: {
              ...bill,
              ...res.data,
              items: res.data.items || []
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to load voucher for edit', err);
    }
  };

  const handleDeleteClick = (bill: PurchaseInvoice) => {
    setOpenMenuId(null);
    setSelectedVoucher(bill);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedVoucher) {
      try {
        const response = await vouchersApi.deletePurchaseVoucher(selectedVoucher.id);
        if (response.success) {
          setInvoices(prev => prev.filter(inv => inv.id !== selectedVoucher.id));
          setIsDeleteModalOpen(false);
          setSelectedVoucher(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const invoiceContent = invoiceRef.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Invoice - ${selectedVoucher?.voucher_no}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>body { padding: 20px; font-family: sans-serif; }</style>
        </head>
        <body onload="window.print(); window.close();">
          ${invoiceContent}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    if (!invoiceRef.current || !selectedVoucher) return;
    const element = invoiceRef.current;
    // @ts-ignore
    html2pdf().from(element).set({
      margin: 10,
      filename: `PUR_${selectedVoucher.voucher_no}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
  };

  const taxableValue = useMemo(() => {
    if (!selectedVoucher?.items) return 0;
    return selectedVoucher.items.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);
  }, [selectedVoucher]);

  const totalTaxAmount = useMemo(() => {
    if (!selectedVoucher?.items) return 0;
    return selectedVoucher.items.reduce((acc, item) => acc + parseFloat(item.tax_amount || '0'), 0);
  }, [selectedVoucher]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/reports')} className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Purchase</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-indigo-500" /> Procurement Compliance
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchInvoices} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500">
            <RotateCcw size={20} />
          </button>
          {/* <button className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm">
            <Printer size={18} /> Register Print
          </button> */}
          <button onClick={() => navigate('/vouchers/purchase')} className="px-8 py-3.5 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all active:scale-95 transform">
            <Plus size={20} /> New Purchase
          </button>
        </div>
      </div>

      {/* Desktop Analytics Bento Grid */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        <div className="md:col-span-2 glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Vendor or Invoice..."
              className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border rounded-[1.5rem] transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
            <Filter size={24} />
          </button>
        </div>

        <div className="bg-rose-50/50 p-8 rounded-[2.5rem] border border-rose-100/50 flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Total Outward</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Vouchers</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">{filteredPurchaseData.length}</h3>
          </div>
          <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Analytics Bento Grid */}
      <div className="grid lg:hidden grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 glass-panel p-5 rounded-[2rem] shadow-xl shadow-slate-200/40 flex items-center gap-3 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voucher ID..."
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-3 border rounded-2xl transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 shadow-sm'}`}>
            <Filter size={20} />
          </button>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-[2rem] border border-rose-100/50 flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <p className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em]">Total Outward</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <TrendingDown size={18} />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Vouchers</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 tracking-tighter">{filteredPurchaseData.length}</h3>
          </div>
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* Advanced Filter Reveal */}
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
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Vendor / Supplier</label>
              <div onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)} className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold flex justify-between items-center cursor-pointer">
                <span className={filterParty === 'All' ? 'text-slate-400' : 'text-slate-900'}>{filterParty}</span>
                <ChevronDown size={20} className="text-slate-400" />
              </div>
              {isPartyDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] p-3 overflow-hidden">
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
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-4 block">Bill Status</label>
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

      {/* Main Table Interface */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden bento-item">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto overflow-visible">
          <table className="w-full text-left table-fixed min-w-[1200px]">
            <thead className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-8 w-[80px] text-center">
                  <button onClick={toggleSelectAll} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${selectedBills.length === filteredPurchaseData.length && filteredPurchaseData.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                    {selectedBills.length > 0 && <Check size={14} className="text-white mx-auto stroke-[4]" />}
                  </button>
                </th>
                <th className="px-4 py-8 w-[140px]">Date</th>
                <th className="px-4 py-8 w-[160px]">Voucher No</th>
                <th className="px-4 py-8 w-[240px]">Vendor Name</th>
                <th className="px-4 py-8 w-[180px] text-right">Value</th>
                <th className="px-4 py-8 w-[170px] text-center">Status</th>
                <th className="px-8 py-8 w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="py-40 text-center"><div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-600" size={48} /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading...</p></div></td></tr>
              ) : filteredPurchaseData.map((bill) => {
                const isSelected = selectedBills.includes(bill.voucher_no);
                const isMenuOpen = openMenuId === bill.id;
                return (
                  <tr key={bill.id} onClick={() => handleView(bill)} className={`hover:bg-indigo-50/30 transition-all group cursor-pointer relative ${isSelected ? 'bg-indigo-50/60' : ''}`}>
                    <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelectBill(bill.voucher_no)} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-100 bg-white group-hover:border-indigo-200'}`}>
                        {isSelected && <Check size={14} className="text-white mx-auto stroke-[4]" />}
                      </button>
                    </td>
                    <td className="px-4 py-6 text-[11px] font-black text-slate-900 tracking-tight">{new Date(bill.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-6"><span className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[11px] font-black tracking-widest rounded-lg border border-rose-100 uppercase">{bill.voucher_no}</span></td>
                    <td className="px-4 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase">{(bill.vendor_name || 'V')[0]}</div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate">{bill.vendor_name || 'Unknown Vendor'}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter truncate">GST: {bill.vendor_gstin || 'UNREGISTERED'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right"><span className="text-sm font-black text-slate-900">₹{parseFloat(bill.total_amount || '0').toLocaleString()}</span></td>
                    <td className="px-4 py-6 text-center"><span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100">{bill.status}</span></td>
                    {/* <td className="px-8 py-6 text-right relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setOpenMenuId(isMenuOpen ? null : bill.id)} className={`p-2 rounded-xl transition-all ${isMenuOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}><MoreVertical size={20} /></button>
                      {isMenuOpen && (
                        <div ref={menuRef} className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-44 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[110] overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200">
                          <button onClick={() => handleEdit(bill)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-all"><Edit2 size={16} className="text-indigo-400" /> Edit Record</button>
                          <button onClick={() => handleDeleteClick(bill)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-all"><Trash2 size={16} className="text-rose-400" /> Delete Voucher</button>
                        </div>
                      )}
                    </td> */}
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(bill); }}
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(bill); }}
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

        {/* Mobile & Tablet Cards */}
        <div className="block lg:hidden p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : filteredPurchaseData.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No invoices found
            </div>
          ) : (
            filteredPurchaseData.map((bill) => (
              <div
                key={bill.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                onClick={() => handleView(bill)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {bill.vendor_name}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {bill.voucher_no}
                    </p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${bill.status?.toLowerCase() === 'posted' ? 'bg-emerald-50 text-emerald-600'
                    : bill.status?.toLowerCase() === 'draft' ? 'bg-amber-50 text-amber-600'
                      : bill.status?.toLowerCase() === 'cancelled' ? 'bg-rose-50 text-rose-600'
                        : 'bg-slate-50 text-slate-500'
                    }`}>
                    {bill.status}
                  </span>
                </div>

                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Date</span>
                  <span>{new Date(bill.voucher_date).toLocaleDateString()}</span>
                </div>

                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Total</span>
                  <span className="text-slate-900 font-black">
                    ₹{parseFloat(bill.total_amount).toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(bill); }}
                    className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(bill); }}
                    className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
              </div>
            ))
          )}
        </div>

        {/* Table Summary Footer */}
        {/* Desktop View */}
        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 hidden lg:flex">
          <div className="flex items-center gap-8">
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-rose-400 mb-1">Total Procurement</span><span className="text-3xl font-black tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</span></div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-slate-500 mb-1">Entry Density</span><span className="text-xl font-black">{filteredPurchaseData.length} <span className="text-xs opacity-50">Vouchers</span></span></div>
          </div>
        </div>
        {/* Mobile View */}

        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 md:flex lg:hidden">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-400 mb-1">Total Procurement</span>
              <span className="text-3xl font-black tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</span>
            </div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Entry Density</span>
              <span className="text-xl font-black">{filteredPurchaseData.length} <span className="text-xs opacity-50">Vouchers</span></span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Export CSV</button>
          </div>
        </div>
      </div>



      {isViewModalOpen && selectedVoucher && (() => {
        // Calculate tax details
        const taxableValue = selectedVoucher.items?.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0) || 0;
        const totalTaxAmount = selectedVoucher.items?.reduce((acc: number, item: any) => acc + parseFloat(item.tax_amount || '0'), 0) || 0;

        // Check if IGST (interstate) or CGST/SGST (local) - compare first 2 digits of GSTIN
        const companyStateCode = '33'; // Tamil Nadu
        const vendorStateCode = selectedVoucher.vendor_gstin?.substring(0, 2) || '33';
        const isInterstate = vendorStateCode !== companyStateCode;

        // Calculate round off
        const subtotalWithTax = taxableValue + totalTaxAmount;
        const roundedTotal = Math.round(subtotalWithTax);
        const roundOff = roundedTotal - subtotalWithTax;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
            <div className="relative w-full max-w-4xl bg-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-500 p-6">

              {/* Close Button */}
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                <X size={20} />
              </button>

              {/* Invoice Container */}
              <div ref={invoiceRef} className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-lg">

                {/* Invoice Header */}
                <div className="p-8 pb-6">
                  <div className="flex justify-between items-start">
                    {/* Company Logo & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-900 rounded-lg flex items-center justify-center">
                        <span className="text-amber-400 font-black text-xl">{(businessDetails?.from_trade_name || 'A')[0]}</span>
                      </div>
                      <span className="text-indigo-900 font-black text-lg tracking-tight uppercase">{businessDetails?.from_trade_name || 'ANUSH TEXTILES'}</span>
                    </div>

                    {/* Invoice Title & Date */}
                    <div className="text-right">
                      <h1 className="text-3xl font-black text-indigo-900 tracking-tight">INVOICE</h1>
                      <p className="text-sm font-bold text-indigo-600 mt-1">
                        DATE: {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, ' / ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="px-8 pb-8">
                  <div className="grid grid-cols-3 gap-8">
                    {/* Invoice No */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Invoice No</p>
                      <p className="text-2xl font-black text-indigo-900 tracking-tight">{selectedVoucher.voucher_no}</p>
                    </div>

                    {/* Bill From (Company) */}
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Bill From</p>
                      <p className="font-bold text-slate-900">{businessDetails?.from_trade_name || 'Anush Textiles'}</p>
                      <p className="text-sm text-slate-600">{businessDetails?.from_addr1}, {businessDetails?.from_addr2}</p>
                      <p className="text-sm text-slate-600">{businessDetails?.from_place} - {businessDetails?.from_pincode}</p>
                      {/* <p className="text-sm text-slate-600">Tirupur - 641602</p> */}
                      <p className="text-sm text-slate-500 mt-2">+91 {businessDetails?.mobile || '99948 60932'}</p>
                      <p className="text-xs font-bold text-indigo-600 mt-1">GSTIN: {businessDetails?.gstin || '33EWLPS7428M1ZP'}</p>
                    </div>

                    {/* Bill To (Vendor) */}
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Bill To</p>
                      <p className="font-bold text-slate-900">{selectedVoucher.vendor_name || selectedVoucher.party_name}</p>
                      {selectedVoucher.vendor_address && <p className="text-sm text-slate-600">{selectedVoucher.vendor_address}</p>}
                      {selectedVoucher.vendor_phone && <p className="text-sm text-slate-500 mt-2">{selectedVoucher.vendor_phone}</p>}
                      <p className="text-xs font-bold text-indigo-600 mt-1">GSTIN: {selectedVoucher.vendor_gstin || 'Unregistered'}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="px-8">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-indigo-900 text-white">
                      <div className="grid grid-cols-12 text-[10px] font-black uppercase tracking-widest">
                        <div className="col-span-1 px-4 py-3 text-center">No</div>
                        <div className="col-span-4 px-4 py-3">Product</div>
                        <div className="col-span-2 px-4 py-3 text-center">HSN</div>
                        <div className="col-span-2 px-4 py-3 text-center">Qty</div>
                        <div className="col-span-1 px-4 py-3 text-right">Rate</div>
                        <div className="col-span-2 px-4 py-3 text-right">Total</div>
                      </div>
                    </div>

                    {/* Table Body */}
                    {isLoadingDetails ? (
                      <div className="py-16 text-center">
                        <Loader2 className="animate-spin mx-auto text-indigo-600 mb-3" size={32} />
                        <p className="text-xs font-bold text-slate-400">Loading items...</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {selectedVoucher.items?.map((item: any, i: number) => (
                          <div key={i} className="grid grid-cols-12 text-sm hover:bg-slate-50 transition-colors">
                            <div className="col-span-1 px-4 py-4 text-center">
                              <span className="w-7 h-7 bg-indigo-900 text-white rounded-lg flex items-center justify-center text-xs font-black mx-auto">{i + 1}</span>
                            </div>
                            <div className="col-span-4 px-4 py-4">
                              <p className="font-bold text-slate-900">{item.item_name}</p>
                              {(item.colour || item.gsm || item.dia) && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {item.colour && `${item.colour}`} {item.gsm && `| ${item.gsm} GSM`} {item.dia && `| ${item.dia} Dia`}
                                </p>
                              )}
                            </div>
                            <div className="col-span-2 px-4 py-4 text-center font-medium text-slate-600">{item.hsn_code || '--'}</div>
                            <div className="col-span-2 px-4 py-4 text-center font-bold text-slate-700">{parseFloat(item.quantity).toLocaleString()} <span className="text-[10px] text-slate-400">{item.unit_symbol}</span></div>
                            <div className="col-span-1 px-4 py-4 text-right font-medium text-slate-600">₹{parseFloat(item.rate).toLocaleString()}</div>
                            <div className="col-span-2 px-4 py-4 text-right font-black text-indigo-900">₹{parseFloat(item.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals Section */}
                <div className="p-8">
                  <div className="flex justify-between items-start">
                    {/* Amount in Words */}
                    <div className="flex-1 pr-8">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Amount in Words</p>
                      <p className="text-lg font-black text-indigo-900">₹{Math.round(parseFloat(selectedVoucher.total_amount || '0')).toLocaleString()}</p>
                      <p className="text-sm font-medium text-slate-600 italic mt-1">{numberToWords(Math.round(parseFloat(selectedVoucher.total_amount || '0')))}</p>
                    </div>

                    {/* Calculation */}
                    <div className="w-72 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-500">Subtotal:</span>
                        <span className="font-black text-slate-700">₹{taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      {isInterstate ? (
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-500">IGST:</span>
                          <span className="font-black text-slate-700">₹{totalTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-slate-500">CGST:</span>
                            <span className="font-black text-slate-700">₹{(totalTaxAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-slate-500">SGST:</span>
                            <span className="font-black text-slate-700">₹{(totalTaxAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )}

                      {roundOff !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-500">Round Off:</span>
                          <span className="font-black text-slate-700">{roundOff >= 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="border-t-2 border-indigo-900 pt-3 mt-3">
                        <div className="flex justify-between">
                          <span className="font-black text-indigo-900 uppercase tracking-widest text-sm">Total:</span>
                          <span className="font-black text-indigo-900 text-xl">₹{Math.round(parseFloat(selectedVoucher.total_amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="px-8 pb-8">
                  <div className="grid grid-cols-3 gap-8 pt-6 border-t border-slate-200">
                    {/* Payment Info */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Info</p>
                      <p className="text-xs text-slate-600"><span className="font-bold">Bank:</span> HDFC Bank Ltd</p>
                      <p className="text-xs text-slate-600"><span className="font-bold">A/C:</span> 50200012345678</p>
                      <p className="text-xs text-slate-600"><span className="font-bold">IFSC:</span> HDFC0001234</p>
                    </div>

                    {/* Terms */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</p>
                      <p className="text-xs text-slate-500">Subject to Tirupur jurisdiction only.</p>
                      <p className="text-xs text-slate-500">Goods once sold will not be taken back.</p>
                    </div>

                    {/* Contact */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Us</p>
                      <p className="text-xs text-slate-600">info@anushtextiles.com</p>
                      <p className="text-xs text-slate-600">+91 99948 60932</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedVoucher.status?.toLowerCase() === 'posted'
                    ? 'bg-emerald-100 text-emerald-700'
                    : selectedVoucher.status?.toLowerCase() === 'cancelled'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                    {selectedVoucher.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all bg-white hover:bg-slate-50 rounded-xl shadow-sm">
                    Close
                  </button>
                  <button
                    onClick={() => { setIsViewModalOpen(false); handleEdit(selectedVoucher); }}
                    className="px-6 py-3 bg-white text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={handlePrint} className="px-8 py-3 bg-indigo-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-800 transition-all flex items-center gap-2">
                    <Printer size={14} /> Print Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {isDeleteModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-rose-100 overflow-hidden p-12 text-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-100"><TriangleAlert size={48} /></div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Erase Record?</h3>
              <p className="text-sm font-bold text-slate-500 mt-3 leading-relaxed px-4">Permanently remove procurement record <span className="text-rose-600 font-black">#{selectedVoucher.voucher_no}</span>? This will void inventory intake.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3">Confirm Deletion</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRegister;
