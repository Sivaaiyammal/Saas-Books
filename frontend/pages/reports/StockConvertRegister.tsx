import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  Package,
  Layers,
  ChevronRight,
  Hash,
  Eye,
  X,
  FileDown,
  Printer,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Plus,
  SlidersHorizontal,
  Trash2,
  ArrowRightLeft,
  Calendar,
  Zap,
  TriangleAlert,
  CheckCircle2,
  Box,
  FileText,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { vouchersApi } from '../../services/api';

interface ConversionBatch {
  id: number;
  voucher_no: string;
  conversion_date: string;
  narration: string | null;
  status: string;
  from_items_summary: string;
  to_items_summary: string;
  from_items?: any[];
  to_items?: any[];
  created_by_name?: string;
}

const StockConvertRegister: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<ConversionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ConversionBatch | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stats Calculation
  const stats = useMemo(() => {
    return {
      total: batches.length,
      posted: batches.filter(b => b.status === 'posted').length,
      cancelled: batches.filter(b => b.status === 'cancelled').length
    };
  }, [batches]);

  const handlePrint = () => {
    window.print();
  };

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await vouchersApi.getStockConversions({
        search: searchTerm,
        from_date: fromDate,
        to_date: toDate
      });
      if (res.success) {
        setBatches(res.data.conversions || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load conversion history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [searchTerm, fromDate, toDate]);

  const handleOpenDetail = async (batch: ConversionBatch) => {
    setSelectedBatch(batch);
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);
    try {
      const res = await vouchersApi.getStockConversion(batch.id);
      if (res.success) {
        setSelectedBatch(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleEdit = () => {
    if (!selectedBatch) return;
    navigate('/vouchers/stock-convert', {
      state: { editVoucher: selectedBatch }
    });
  };

  const confirmDelete = async () => {
    if (!selectedBatch) return;
    setIsDeleting(true);
    try {
      const res = await vouchersApi.deleteStockConversion(selectedBatch.id);
      if (res.success) {
        setBatches(batches.filter(b => b.id !== selectedBatch.id));
        setIsDeleteModalOpen(false);
        setIsDetailModalOpen(false);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/reports')} className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Conversion Register</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
               <ShieldCheck size={12} className="text-emerald-500" /> Transformation Audit History
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchBatches} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500">
            <RotateCcw size={20} />
          </button>
          <button onClick={() => navigate('/vouchers/stock-convert')} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 transform">
            <Plus size={20} /> New Conversion
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-40">
        <div className="md:col-span-8 glass-panel p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Voucher # or Transformation notes..."
              className="w-full pl-14 pr-6 py-3.5 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner placeholder:text-slate-300"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border rounded-[1.2rem] transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
            <Filter size={24} />
          </button>
        </div>

        <div className="md:col-span-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 flex items-center justify-between shadow-sm">
           <div className="flex-1 space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aggregate Operations</p>
              <h4 className="text-xl font-black text-slate-900 tracking-tighter">{batches.length} Transformation Points</h4>
           </div>
           <button className="p-3 bg-indigo-50 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><Activity size={20} /></button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl animate-in slide-in-from-top-6 duration-500 overflow-hidden relative z-30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Timeline Start</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none uppercase" /></div>
             <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Timeline End</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none uppercase" /></div>
          </div>
        </div>
      )}

      {/* Batch Table Card */}
      <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden relative z-10 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left table-fixed min-w-[1300px]">
            <thead className="bg-slate-50/80 text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-8 w-[160px]">Post Date</th>
                <th className="px-4 py-8 w-[160px]">Voucher Ref</th>
                <th className="px-4 py-8 min-w-[300px]">Consumption Summary (Out)</th>
                <th className="px-4 py-8 min-w-[300px]">Production Summary (In)</th>
                <th className="px-4 py-8 w-[120px] text-center">Status</th>
                <th className="px-8 py-8 w-[100px] text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="py-40 text-center"><Loader2 className="animate-spin text-indigo-600 mx-auto" size={48} /><p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">Loading...</p></td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={6} className="py-40 text-center text-slate-300"><ArrowRightLeft size={64} className="mx-auto opacity-20" /><p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">No conversion batches found</p></td></tr>
              ) : batches.map((b) => (
                <tr key={b.id} onClick={() => handleOpenDetail(b)} className="hover:bg-indigo-50/30 transition-all group cursor-pointer border-l-4 border-transparent hover:border-indigo-500">
                  <td className="px-8 py-6">
                    <span className="text-[11px] font-black text-slate-900 tracking-tight uppercase">{new Date(b.conversion_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </td>
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-2">
                       <Hash size={12} className="text-slate-300" />
                       <span className="text-xs font-black text-indigo-600 tracking-tighter uppercase">{b.voucher_no}</span>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-xs font-bold text-rose-500 truncate">{b.from_items_summary}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Flow Outward</p>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-xs font-bold text-emerald-600 truncate">{b.to_items_summary}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Flow Inward</p>
                  </td>
                  <td className="px-4 py-6 text-center">
                    <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${b.status === 'posted' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{b.status}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm transition-all"><Eye size={16} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aggregate Footer Section */}
        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 relative overflow-hidden">
           <div className="absolute right-0 bottom-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32" />
           <div className="flex flex-wrap items-center gap-12 relative z-10">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-[0.2em]">Total Transformations</span>
                 <div className="flex items-baseline gap-4">
                    <span className="text-5xl font-black tracking-tighter text-white">{stats.total}</span>
                    <div className="px-4 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <CheckCircle2 size={12} /> Live Sync
                    </div>
                 </div>
              </div>
              <div className="h-16 w-px bg-white/10 hidden md:block" />
              <div className="flex gap-8">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Active Batches</span>
                    <span className="text-xl font-black text-emerald-400">{stats.posted}</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Voided</span>
                    <span className="text-xl font-black text-rose-400">{stats.cancelled}</span>
                 </div>
              </div>
           </div>
           <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
              <button className="flex-1 md:flex-none px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95">
                 <FileDown size={18} className="text-indigo-400" /> Export Audit
              </button>
           </div>
        </div>
      </div>

      {/* Detail Batch Passport Modal */}
      {isDetailModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl" onClick={() => setIsDetailModalOpen(false)} />
          <div className="relative w-full max-w-6xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">

            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100"><ArrowRightLeft size={28} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Transformation Passport</h2>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-100 tracking-widest">{selectedBatch.voucher_no}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5"><ShieldCheck size={12} className="text-emerald-500" /> Multi-Step Audit Log</span>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button onClick={handlePrint} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-95"><Printer size={20} /></button>
                  <button
                    disabled={selectedBatch.status === 'cancelled'}
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 ml-2 disabled:opacity-30 disabled:grayscale"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button onClick={() => setIsDetailModalOpen(false)} className="p-3.5 text-slate-400 hover:text-rose-500 transition-all bg-slate-50 border border-slate-200 rounded-2xl ml-4"><X size={24} /></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar">
              {isLoadingDetail ? (
                <div className="py-40 text-center flex flex-col items-center gap-6"><Loader2 className="animate-spin text-indigo-600" size={64} /><p className="text-[10px] font-black text-slate-400 uppercase">Pulling Transformation Data...</p></div>
              ) : (
                <div className="space-y-10">
                   {/* Batch Header */}
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
                      <div>
                         <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Batch Strategy</p>
                         <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{selectedBatch.narration || 'Standard Internal Conversion Batch'}</h3>
                         <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-50">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Operator</p><p className="text-xs font-black text-slate-900">{selectedBatch.created_by_name || 'System Auto'}</p></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Date</p><p className="text-xs font-black text-slate-900">{selectedBatch.conversion_date}</p></div>
                         </div>
                      </div>
                      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl min-w-[240px]">
                         <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.3em] mb-2">Protocol Status</span>
                         <h4 className="text-2xl font-black tracking-widest uppercase">{selectedBatch.status}</h4>
                      </div>
                   </div>

                   {/* Transformation Grid */}
                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {/* Consumption Side */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm"><TrendingDown size={18} /></div>
                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Flow Out (Consumption)</h4>
                         </div>
                         <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-lg overflow-hidden">
                            <table className="w-full text-left">
                               <thead className="bg-slate-50/80 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                  <tr><th className="px-6 py-4">Item Identity</th><th className="px-6 py-4 text-right">Qty Consumed</th></tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {selectedBatch.from_items?.map((item, idx) => (
                                    <tr key={idx}><td className="px-6 py-4"><p className="text-xs font-bold text-slate-900 uppercase">{item.item_name}</p><p className="text-[9px] font-black text-indigo-500 uppercase mt-1">Code: {item.item_code}</p></td><td className="px-6 py-4 text-right font-black text-rose-600 text-sm">-{parseFloat(item.qty).toLocaleString()} <span className="text-[9px] uppercase opacity-50">{item.unit_symbol}</span></td></tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>

                      {/* Production Side */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm"><TrendingUp size={18} /></div>
                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Flow In (Production)</h4>
                         </div>
                         <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-lg overflow-hidden">
                            <table className="w-full text-left">
                               <thead className="bg-slate-50/80 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                  <tr><th className="px-6 py-4">Produced Item</th><th className="px-6 py-4 text-right">Qty Created</th></tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {selectedBatch.to_items?.map((item, idx) => (
                                    <tr key={idx}><td className="px-6 py-4"><p className="text-xs font-bold text-slate-900 uppercase">{item.item_name}</p><p className="text-[9px] font-black text-indigo-500 uppercase mt-1">Code: {item.item_code}</p></td><td className="px-6 py-4 text-right font-black text-emerald-600 text-sm">+{parseFloat(item.qty).toLocaleString()} <span className="text-[9px] uppercase opacity-50">{item.unit_symbol}</span></td></tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4 sticky bottom-0 z-30">
               <button onClick={() => setIsDetailModalOpen(false)} className="w-full sm:w-auto px-12 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-2xl">Close Batch</button>
               <div className="flex-1" />
               <button
                 onClick={handleEdit}
                 className="w-full sm:w-auto px-12 py-4 bg-white border border-indigo-200 text-indigo-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-indigo-50 active:scale-95"
               >
                 <Edit2 size={18} /> Revise Transformation
               </button>
               <button onClick={handlePrint} className="w-full sm:w-auto px-16 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all hover:bg-black active:scale-95"><Printer size={18} /> Batch Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Confirmation */}
      {isDeleteModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-rose-100 overflow-hidden p-12 text-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-100 shadow-inner"><TriangleAlert size={48} /></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Reverse Transformation?</h3>
              <p className="text-sm font-bold text-slate-500 mt-4 leading-relaxed px-4">This batch <span className="text-rose-600 font-black">#{selectedBatch.voucher_no}</span> will be cancelled. Stock consumed will be restored and produced items will be deducted from inventory.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button disabled={isDeleting} onClick={confirmDelete} className="w-full py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />} Confirm Permanent Reversal
              </button>
              <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Discard Deletion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockConvertRegister;