
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import printJS from 'print-js';
import html2pdf from 'html2pdf.js';
import {
    FileText, Search, Filter, Plus, Edit, Trash2, Eye,
    ArrowLeft, Loader2, Calendar, User, Hash, MoreVertical, X, Check, Printer, Save, Download, RotateCcw, ShieldCheck, TrendingUp, ChevronDown, SlidersHorizontal,
    Edit2
} from 'lucide-react';
import { quotationsApi, settingsApi, mastersApi } from '../../services/api';
import QuotationTemplate from '../../components/QuotationTemplate';

interface Quotation {
    id: number;
    voucher_no: string;
    voucher_date: string;
    party_name: string;
    total_amount: string;
    status: string;
    item_count: number;
}

const QuotationRegister: React.FC = () => {
    const navigate = useNavigate();
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [filterParty, setFilterParty] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterStatus, setFilterStatus] = useState<string[]>(['Posted', 'Draft']);
    const [selectedBills, setSelectedBills] = useState<string[]>([]);

    const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
    const [partySearchQuery, setPartySearchQuery] = useState('');
    const partyDropdownRef = useRef<HTMLDivElement>(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [businessDetails, setBusinessDetails] = useState<any>(null);
    const [defaultBank, setDefaultBank] = useState<any>(null);

    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const response = await quotationsApi.getQuotations();
            if (response.success) {
                setQuotations(response.data.quotations);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch quotations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotations();
        const fetchSettings = async () => {
            try {
                const [settingsRes, ledgersRes] = await Promise.all([
                    settingsApi.getGstSettings(),
                    mastersApi.getLedgers()
                ]);

                if (settingsRes.success && settingsRes.data) {
                    setBusinessDetails(settingsRes.data);
                }

                if (ledgersRes.success && ledgersRes.data && ledgersRes.data.ledgers) {
                    const bank = ledgersRes.data.ledgers.find((l: any) => l.group_name === 'Bank Accounts' && (l.is_default_bank === 1 || l.is_default_bank === true || l.is_default_bank === '1'));
                    if (bank) setDefaultBank(bank);
                }
            } catch (error) {
                console.error("Failed to fetch settings", error);
            }
        };
        fetchSettings();
    }, []);

    const handleView = async (q: Quotation) => {
        setSelectedQuotation(q);
        setIsViewModalOpen(true);
        setIsLoadingDetails(true);
        try {
            const res = await quotationsApi.getQuotation(q.id);
            if (res.success && res.data) {
                setSelectedQuotation(res.data);
            }
        } catch (err) {
            console.error('Failed to load quotation details', err);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handlePrint = () => {
        if (!invoiceRef.current) return;

        printJS({
            printable: invoiceRef.current.innerHTML,
            type: 'raw-html',
            style: `
        @page { margin: 0 !important; }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { padding: 0; font-family: "Times New Roman", Times, serif; color: black; }
        .invoice-wrapper { padding: 0; }
        .invoice-page { page-break-after: always; page-break-inside: avoid; margin: 0 auto; width: 190mm; display: block; padding-top: 10mm; padding-bottom: 10mm; }
        .invoice-page:last-child { page-break-after: auto; }
        .invoice-container { background: white; border: 2px solid #0f172a; width: 100%; margin: 0 auto; font-size: 11px; line-height: 1.25; font-weight: 500; color: black; display: block; position: relative; page-break-inside: avoid; }
        .border-2.border-slate-900 { border: 2px solid #0f172a; }
        .border-t-2.border-slate-900 { border-top: 2px solid #0f172a; }
        .border-b-2.border-slate-900 { border-bottom: 2px solid #0f172a; }
        .border-r-2.border-slate-900 { border-right: 2px solid #0f172a; }
        .bg-white { background-color: white; }
        .bg-slate-50 { background-color: #f8fafc; }
        .bg-slate-50\\/50 { background-color: rgba(248, 250, 252, 0.5); }
        .text-black { color: black; }
        .text-xl { font-size: 1.25rem; }
        .text-base { font-size: 1rem; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-\\[9px\\] { font-size: 9px; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-\\[11px\\] { font-size: 11px; }
        .text-\\[12px\\] { font-size: 12px; }
        .font-black { font-weight: 900; }
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 500; }
        .font-normal { font-weight: 400; }
        .uppercase { text-transform: uppercase; }
        .tracking-tight { letter-spacing: -0.025em; }
        .tracking-tighter { letter-spacing: -0.05em; }
        .tracking-wider { letter-spacing: 0.05em; }
        .tracking-widest { letter-spacing: 0.1em; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .flex { display: flex; }
        .flex-1 { flex: 1 1 0%; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .items-end { align-items: flex-end; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .gap-1 { gap: 0.25rem; }
        .gap-10 { gap: 2.5rem; }
        .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .p-1 { padding: 0.25rem; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .pt-1 { padding-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .w-full { width: 100%; }
        .w-\\[50px\\] { width: 50px; }
        .w-\\[70px\\] { width: 70px; }
        .w-\\[80px\\] { width: 80px; }
        .w-\\[90px\\] { width: 90px; }
        .w-\\[100px\\] { width: 100px; }
        .w-\\[300px\\] { width: 300px; }
        .w-\\[350px\\] { width: 350px; }
        .max-w-\\[800px\\] { max-width: 800px; }
        .min-h-\\[140px\\] { min-height: 140px; }
        .min-h-\\[160px\\] { min-height: 160px; }
        .min-h-\\[200px\\] { min-height: 200px; }
        .h-10 { height: 2.5rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .align-top { vertical-align: top; }
        .grid { display: grid; }
        .grid-cols-\\[80px_10px_1fr\\] { grid-template-columns: 80px 10px 1fr; }
        .grid-cols-\\[100px_10px_1fr\\] { grid-template-columns: 100px 10px 1fr; }
        .grid-cols-\\[1fr_1fr\\] { grid-template-columns: 1fr 1fr; }
        .grid-cols-\\[1fr_320px\\] { grid-template-columns: 1fr 320px; }
        .grid-rows-\\[1fr_1fr\\] { grid-template-rows: 1fr 1fr; }
        .grid-rows-\\[auto_auto_1fr\\] { grid-template-rows: auto auto 1fr; }
        .gap-y-1 { row-gap: 0.25rem; }
        table { width: 100%; border-collapse: collapse; }
        th.border-r-2, td.border-r-2 { border-right: 2px solid #0f172a; }
        tr.border-b-2 { border-bottom: 2px solid #0f172a; }
        tbody.border-slate-900 td { border-color: #0f172a; }
      `,
            scanStyles: false
        });
    };

    const handleEdit = (q: Quotation) => {
        // We'll need to fetch full details or pass it
        quotationsApi.getQuotation(q.id).then(res => {
            if (res.success) {
                navigate('/vouchers/quotation', { state: { editQuotation: res.data } });
            }
        });
    };

    const handleCancel = async (id: number) => {
        if (window.confirm('Are you sure you want to cancel this quotation?')) {
            try {
                const res = await quotationsApi.deleteQuotation(id);
                if (res.success) {
                    alert('Quotation cancelled successfully');
                    fetchQuotations();
                }
            } catch (err: any) {
                alert(err.message || 'Error cancelling quotation');
            }
        }
    };

    const handleDownloadPDF = async (q: Quotation) => {
        setIsLoadingDetails(true);
        try {
            const res = await quotationsApi.getQuotation(q.id);
            if (res.success && res.data) {
                setSelectedQuotation(res.data);

                // We need to wait for the state to update and the component to render
                setTimeout(() => {
                    if (invoiceRef.current) {
                        const element = invoiceRef.current;
                        const opt: any = {
                            margin: 10,
                            filename: `Quotation_${q.voucher_no}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        html2pdf().from(element).set(opt).save();
                        setSelectedQuotation(null); // Clear it back after generating
                    }
                }, 100);
            }
        } catch (err) {
            console.error('Failed to prepare download', err);
            alert('Could not download quotation at this time.');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (partyDropdownRef.current && !partyDropdownRef.current.contains(event.target as Node)) {
                setIsPartyDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allParties = useMemo(() => ['All', ...new Set(quotations.map(d => d.party_name).filter(Boolean))], [quotations]);

    const filteredPartyList = useMemo(() => {
        if (!partySearchQuery) return allParties;
        return allParties.filter(p => p.toLowerCase().includes(partySearchQuery.toLowerCase()));
    }, [partySearchQuery, allParties]);

    const filteredQuotations = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return quotations.filter(item => {
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
    }, [quotations, searchTerm, filterParty, startDate, endDate, filterStatus]);

    const totalFilteredAmount = useMemo(() => {
        return filteredQuotations.reduce((acc, curr) => acc + parseFloat(curr.total_amount || '0'), 0);
    }, [filteredQuotations]);

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
        if (selectedBills.length === filteredQuotations.length && filteredQuotations.length > 0) {
            setSelectedBills([]);
        } else {
            setSelectedBills(filteredQuotations.map(q => q.voucher_no));
        }
    };

    if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/reports')}
                        className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Quotation</h1>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
                            <ShieldCheck size={12} className="text-emerald-500" /> Secure Financial Audit
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchQuotations} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500">
                        <RotateCcw size={20} />
                    </button>
                    {/* <button className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <Printer size={18} /> Batch Print
                      </button> */}
                    <button onClick={() => navigate('/vouchers/quotation')} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 transform">
                        <Plus size={20} /> New Entry
                    </button>
                </div>
            </div>

            {/* Analytics Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by Voucher ID or Client Name..."
                            autoComplete="off"
                            className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
                        />
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border rounded-[1.5rem] transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 shadow-sm'}`}>
                        <Filter size={24} />
                    </button>
                </div>

                <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50 flex items-center justify-between group hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
                    <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Total Sales</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</h3>
                    </div>
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Quotations</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">{filteredQuotations.length}</h3>
                    </div>
                    <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                </div>
            </div>

            {/* Advanced Filter Reveal */}
            {showFilters && (
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 animate-in slide-in-from-top-6 duration-500">
                    <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                <SlidersHorizontal size={20} />
                            </div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Advanced Filter Controls</h4>
                        </div>
                        <button onClick={resetFilters} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 px-4 py-2 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all">Reset All Parameters</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="space-y-3 relative" ref={partyDropdownRef}>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Client / Ledger Account</label>
                            <div onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)} className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-indigo-300 transition-all">
                                <span className={filterParty === 'All' ? 'text-slate-400' : 'text-slate-900'}>{filterParty}</span>
                                <ChevronDown size={20} className="text-slate-400" />
                            </div>
                            {isPartyDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <input
                                        type="text"
                                        placeholder="Type to filter list..."
                                        value={partySearchQuery}
                                        onChange={(e) => setPartySearchQuery(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs mb-3 outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-300 transition-all"
                                    />
                                    <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                                        {filteredPartyList.map(p => (
                                            <button key={p} onClick={() => { setFilterParty(p); setIsPartyDropdownOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${filterParty === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{p}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">From Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">To Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
                            </div>
                        </div>
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


            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden bento-item">
                <div className="overflow-x-auto overflow-visible">
                    <table className="w-full text-left table-fixed min-w-[1200px]">
                        <thead className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-8 w-[80px] text-center">
                                    <button onClick={toggleSelectAll} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${selectedBills.length === filteredQuotations.length && filteredQuotations.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
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
                        <tbody className="divide-y divide-slate-100">
                            {filteredQuotations.length > 0 ? filteredQuotations.map((q) => (
                                <tr
                                    key={q.id}
                                    onClick={() => handleView(q)}
                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                >
                                    <td className="px-8 py-8 text-center" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => toggleSelectBill(q.voucher_no)} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${selectedBills.includes(q.voucher_no) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white group-hover:border-indigo-300'}`}>
                                            {selectedBills.includes(q.voucher_no) && <Check size={14} className="text-white mx-auto stroke-[4]" />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-600">{new Date(q.voucher_date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-xs uppercase tracking-tight">{q.voucher_no}</span></td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{q.party_name}</td>
                                    {/* <td className="px-6 py-4 text-slate-500 font-medium">{q.item_count} Items</td> */}
                                    <td className="px-6 py-4 text-right font-black text-slate-900">₹{parseFloat(q.total_amount).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${q.status === 'cancelled' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                            }`}>
                                            {q.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                                            {/* <button
                                                onClick={(e) => { e.stopPropagation(); handleDownloadPDF(q); }}
                                                title="Download Quotation"
                                                className="p-2.5 text-emerald-500 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm hover:text-white hover:bg-emerald-600 transition-all active:scale-90"
                                            >
                                                <Download size={16} />
                                            </button> */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(q); }}
                                                className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCancel(q.id); }}
                                                className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">No quotations found matching your search</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 hidden lg:flex">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Total Turnover</span>
                            <span className="text-3xl font-black tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</span>
                        </div>
                        <div className="h-10 w-px bg-white/10 hidden md:block" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Entry Density</span>
                            <span className="text-xl font-black">{filteredQuotations.length} <span className="text-xs opacity-50">Vouchers</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quotation Preview Modal */}
            {isViewModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
                    <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Quotation Preview</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedQuotation?.voucher_no}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handlePrint}
                                    className="p-3 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all flex items-center gap-2"
                                    title="Print"
                                >
                                    <Printer size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest hidden md:inline">Print</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadPDF(selectedQuotation)}
                                    className="p-3 bg-slate-50 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all flex items-center gap-2"
                                    title="Save as PDF"
                                >
                                    <Download size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest hidden md:inline">Save PDF</span>
                                </button>
                                <button
                                    onClick={() => setIsViewModalOpen(false)}
                                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8 custom-scrollbar">
                            <div className="max-w-[800px] mx-auto">
                                {isLoadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                        <Loader2 size={40} className="animate-spin mb-4 text-indigo-600" />
                                        <p className="font-bold uppercase tracking-widest text-[10px]">Loading...</p>
                                    </div>
                                ) : (
                                    selectedQuotation && isViewModalOpen && (
                                        <QuotationTemplate
                                            ref={invoiceRef}
                                            quotation={{
                                                ...selectedQuotation,
                                                items: selectedQuotation.items || []
                                            }}
                                            businessDetails={businessDetails}
                                            bankDetails={defaultBank}
                                            title="Quotation"
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Hidden template for PDF generation when downloading directly */}
            {
                !isViewModalOpen && selectedQuotation && (
                    <div style={{ display: 'none' }}>
                        <QuotationTemplate
                            ref={invoiceRef}
                            quotation={{
                                ...selectedQuotation,
                                items: selectedQuotation.items || []
                            }}
                            businessDetails={businessDetails}
                            bankDetails={defaultBank}
                            title="Quotation"
                        />
                    </div>
                )
            }
        </div >
    );
};

export default QuotationRegister;
