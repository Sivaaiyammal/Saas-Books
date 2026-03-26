
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  X,
  Plus,
  Calendar,
  ChevronDown,
  Building2,
  ArrowLeft,
  Wallet,
  Receipt,
  FileText,
  Check,
  Zap,
  Info,
  Loader2,
  Calculator,
  ShieldCheck,
  Search,
  Hash,
  ArrowDownRight,
  Landmark,
  Banknote
} from 'lucide-react';
import { mastersApi, vouchersApi } from '../services/api';

interface BillAllocation {
  id: number;
  invoice_no: string;
  voucher_date: string;
  pending_amount: number;
  allocated_amount: number;
  selected: boolean;
}

const PaymentVoucher: React.FC = () => {
  const navigate = useNavigate();

  // Master Data
  const [parties, setParties] = useState<any[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<any[]>([]);
  const [tdsLedgers, setTdsLedgers] = useState<any[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<BillAllocation[]>([]);
  const [vendorOutstanding, setVendorOutstanding] = useState<{total: number; count: number} | null>(null);

  // Form State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partyId, setPartyId] = useState<number | ''>('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [paidFromId, setPaidFromId] = useState<number | ''>('');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  // TDS State
  const [hasTds, setHasTds] = useState(false);
  const [tdsAmount, setTdsAmount] = useState<string>('');
  const [tdsLedgerId, setTdsLedgerId] = useState<number | ''>('');

  // Bill Adjustments
  const [useBillAdjustments, setUseBillAdjustments] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isFetchingBills, setIsFetchingBills] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'adjustable' | 'on_account' | 'advance'>('on_account');

  // Computed: Selected Party details
  const selectedParty = useMemo(() => {
    return parties.find(p => p.id === Number(partyId));
  }, [parties, partyId]);

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [creditorsRes, debtorsRes, bankRes, cashRes, tdsRes] = await Promise.all([
          mastersApi.getLedgersByGroup(3), // Sundry Creditors
          mastersApi.getLedgersByGroup(2), // Sundry Debtors
          mastersApi.getLedgersByGroup(4), // Bank Accounts
          mastersApi.getLedgersByGroup(5), // Cash Accounts
          mastersApi.getLedgersByGroup(8)  // TDS Ledgers
        ]);

        const combinedParties = [
          ...(creditorsRes.success ? creditorsRes.data.ledgers : []),
          ...(debtorsRes.success ? debtorsRes.data.ledgers : []),
        ];
        const uniqueParties = Array.from(new Map(combinedParties.map((ledger: any) => [ledger.id, ledger])).values());
        setParties(uniqueParties);

        // Merge bank and cash for Paid From
        const combined = [
          ...(bankRes.success ? bankRes.data.ledgers : []),
          ...(cashRes.success ? cashRes.data.ledgers : [])
        ];
        setSourceAccounts(combined);

        if (tdsRes.success) setTdsLedgers(tdsRes.data.ledgers);

      } catch (err) {
        setError('Failed to initialize master data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch Pending Invoices and Outstanding when Party changes
  useEffect(() => {
    if (partyId) {
      const fetchVendorStats = async () => {
        setIsFetchingBills(true);
        try {
          const res = await vouchersApi.getPaymentOutstandingBills(Number(partyId));
          if (res.success && res.data) {
            const billCount = 'bill_count' in res.data ? Number((res.data as any).bill_count || 0) : 0;
            setVendorOutstanding({
               total: res.data.total_outstanding || 0,
              count: billCount
            });

            if (res.data.bills && res.data.bills.length > 0) {
              setPendingInvoices(res.data.bills.map((bill: any) => ({
                id: bill.allocation_id,
                invoice_no: bill.bill_no || bill.voucher_no,
                voucher_date: bill.bill_date || bill.voucher_date,
                pending_amount: parseFloat(bill.pending_amount || '0'),
                allocated_amount: 0,
                selected: false
              })));
            } else {
              setPendingInvoices([]);
            }
          }
        } catch (err) {
          console.warn("Could not load bills for this vendor:", err);
          setPendingInvoices([]);
        } finally {
          setIsFetchingBills(false);
        }
      };
      fetchVendorStats();
    } else {
      setVendorOutstanding(null);
      setPendingInvoices([]);
    }
  }, [partyId]);

  useEffect(() => {
    setUseBillAdjustments(paymentMode === 'adjustable');
  }, [paymentMode]);

  const allocatedTotal = useMemo(() => {
    return pendingInvoices.filter(i => i.selected).reduce((acc, i) => acc + i.allocated_amount, 0);
  }, [pendingInvoices]);

  const handleSave = async () => {
    const numericAmount = parseFloat(amount || '0');
    if (!partyId || !paidFromId || numericAmount <= 0) {
      alert("Missing Required Fields: Please select a Vendor, a Payment source, and enter a valid Amount.");
      return;
    }

    if (paymentMode === 'adjustable' && !pendingInvoices.some(i => i.selected && i.allocated_amount > 0)) {
      alert("Select at least one bill and allocation amount in Adjustable mode.");
      return;
    }

    const payload: any = {
      party_ledger_id: Number(partyId),
      voucher_date: voucherDate,
      amount: numericAmount,
      paid_from: Number(paidFromId),
      payment_mode: paymentMode,
      reference_no: referenceNo || undefined,
      narration: narration || undefined,
    };

    if (hasTds && parseFloat(tdsAmount || '0') > 0 && tdsLedgerId) {
      payload.tds_amount = parseFloat(tdsAmount);
      payload.tds_ledger_id = Number(tdsLedgerId);
    }

    if (paymentMode === 'adjustable' && pendingInvoices.some(i => i.selected)) {
      payload.bill_adjustments = pendingInvoices
        .filter(i => i.selected)
        .map(i => ({
          allocation_id: i.id,
          bill_no: i.invoice_no,
          amount: i.allocated_amount
        }));
    }

    setIsSaving(true);
    try {
      const res = await vouchersApi.createPayment(payload);
      if (res.success) {
        alert("Payment saved successfully!");
        navigate('/reports/payables');
      } else {
        alert(res.message || "Failed to save payment.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20 font-sans">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
        <div className="flex items-center gap-6 relative z-10">
          <button onClick={() => navigate(-1)} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-amber-600 hover:bg-white transition-all shadow-sm active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div className="w-16 h-16 rounded-[1.5rem] bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner border border-amber-100">
            <Banknote size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Payment (Post Payment)</h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-200">Financial Outward</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                 <ShieldCheck size={12} className="text-amber-500" /> Audit Verified Terminal
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 md:flex-none bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="text-amber-400" />}
            {isSaving ? 'Processing...' : 'Save Payment'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

        {/* Left Column: Flow Control */}
        <div className="md:col-span-8 space-y-8">

          {/* Main Transaction Card */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-10">
            <div className="flex items-center justify-between border-b border-slate-50 pb-6">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-3">
                 <ArrowDownRight size={16} /> Disbursement Details
               </h3>
               <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl">
                  <Calendar size={14} className="text-slate-400" />
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="text-xs font-black text-slate-900 bg-transparent outline-none focus:text-indigo-600 transition-colors uppercase"
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Vendor Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Paid To (Debtor/Creditor)</label>
                <div className="relative group">
                  <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-14 pr-10 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-inner"
                  >
                    <option value="">Search Ledger...</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                {vendorOutstanding && (
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                       <span>Payable Balance</span>
                       <div className="flex items-center gap-2">
                          <span className="text-sm font-black">₹{vendorOutstanding.total.toLocaleString()}</span>
                          {/* <span className="bg-white px-1.5 py-0.5 rounded border border-indigo-200">{vendorOutstanding.count} Bills</span> */}
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Paid From (Source)</label>
                <div className="relative group">
                  <Wallet className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                  <select
                    value={paidFromId}
                    onChange={(e) => setPaidFromId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-14 pr-10 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none transition-all shadow-inner"
                  >
                    <option value="">Choose Account...</option>
                    {sourceAccounts.map(a => (
                       <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                {paidFromId && (
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                      {sourceAccounts.find(a => a.id === paidFromId)?.name.toLowerCase().includes('cash') ? <Banknote size={12} className="text-amber-500" /> : <Landmark size={12} className="text-blue-500" />}
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Liquid Capital Source</span>
                   </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Payment Amount */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Voucher Amount (Net Paid)</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl group-focus-within:text-amber-600 transition-colors">₹</div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-5 bg-amber-50/20 border border-amber-100 rounded-[1.5rem] text-2xl font-black text-slate-900 focus:ring-8 focus:ring-amber-600/5 focus:border-amber-600 outline-none transition-all shadow-inner placeholder:text-slate-300"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {/* Reference */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NEFT / RTGS / Ref No.</label>
                <div className="relative group">
                  <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
                    placeholder="e.g. TXN-987654321"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Strategy Card */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-6 overflow-hidden relative">
             <div className="flex flex-wrap items-center gap-3 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Type</span>
                <button
                  onClick={() => setPaymentMode('adjustable')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMode === 'adjustable' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'}`}
                >
                  Adjustable
                </button>
                <button
                  onClick={() => setPaymentMode('on_account')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMode === 'on_account' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'}`}
                >
                  On Account
                </button>
                <button
                  onClick={() => setPaymentMode('advance')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMode === 'advance' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:text-emerald-600'}`}
                >
                  Advance
                </button>
             </div>

             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Adjustment Selection</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Settle specific purchase invoices</p>
                  </div>
                </div>
                   <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-slate-50 text-slate-500 border-slate-200">
                    {paymentMode === 'adjustable' ? 'Adjustable' : paymentMode === 'advance' ? 'Advance' : 'On Account'}
                   </span>
             </div>

                 {paymentMode === 'advance' ? (
                   <div className="p-8 bg-emerald-50/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center justify-center gap-3 border border-emerald-100">
                     <Zap size={14} className="text-emerald-500" /> Advance mode selected. Bill mapping is disabled.
                   </div>
                 ) : paymentMode === 'on_account' ? (
                   <div className="p-8 bg-slate-50/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-3 border border-slate-100">
                     <Zap size={14} className="text-indigo-400" /> On Account mode selected. Amount will post to On Account.
                   </div>
                 ) : (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500 pt-4">
                   {isFetchingBills ? (
                      <div className="py-12 flex flex-col items-center gap-3">
                         <Loader2 className="animate-spin text-indigo-400" size={32} />
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Procurement Database...</p>
                      </div>
                   ) : pendingInvoices.length > 0 ? (
                      <div className="space-y-6">
                         <div className="flex flex-wrap gap-3 min-h-[50px] items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            {pendingInvoices.filter(i => i.selected).length > 0 ? (
                               pendingInvoices.filter(i => i.selected).map(i => (
                                  <div key={i.id} className="flex items-center gap-3 px-4 py-2 bg-white border border-indigo-100 rounded-xl shadow-sm group hover:border-rose-200 transition-all">
                                     <span className="text-[10px] font-black text-indigo-600">{i.invoice_no}</span>
                                     <span className="text-[10px] font-bold text-slate-400">₹{i.allocated_amount.toLocaleString()}</span>
                                     <button onClick={() => {
                                       setPendingInvoices(prev => prev.map(inv => inv.id === i.id ? {...inv, selected: false, allocated_amount: 0} : inv));
                                     }} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={12} /></button>
                                  </div>
                               ))
                            ) : (
                               <p className="text-[10px] font-bold text-slate-400 uppercase italic ml-2">No bills mapped yet.</p>
                            )}
                            <button
                              onClick={() => setIsAllocationModalOpen(true)}
                              className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 ml-auto"
                            >
                               <Plus size={14} /> Open Invoice Grid
                            </button>
                         </div>
                         <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                               <Info size={14} className="text-indigo-400" />
                               <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">On Account Remainder:</span>
                               <span className="text-[11px] font-black text-slate-900">₹{Math.max(0, parseFloat(amount || '0') - allocatedTotal).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-4">
                               <span className="text-[10px] font-black uppercase text-slate-400">Total Allocated:</span>
                               <span className={`text-sm font-black ${allocatedTotal > parseFloat(amount || '0') ? 'text-rose-600' : 'text-indigo-600'}`}>
                                  ₹{allocatedTotal.toLocaleString()}
                               </span>
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="p-10 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center gap-3 text-center">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 shadow-sm"><Info size={24} /></div>
                         <p className="text-xs font-bold text-slate-500 leading-relaxed px-10">We couldn't find any pending purchase invoices for this vendor.<br/><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Voucher will be posted as 'On Account'</span></p>
                      </div>
                   )}
                </div>
             )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="md:col-span-4 space-y-8">

          {/* Statutory (TDS) Configuration */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm"><Calculator size={20} /></div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900">TDS Withholding</h3>
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Statutory Deductions</p>
                  </div>
               </div>
               <button
                  onClick={() => setHasTds(!hasTds)}
                  className={`w-10 h-6 rounded-full transition-all relative ${hasTds ? 'bg-rose-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${hasTds ? 'right-1' : 'left-1'}`} />
                </button>
            </div>

            {hasTds && (
              <div className="space-y-5 animate-in slide-in-from-right-4 duration-500 pt-2">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Deduction Amount</label>
                    <input
                      type="number"
                      value={tdsAmount}
                      onChange={(e) => setTdsAmount(e.target.value)}
                      className="w-full px-5 py-4 bg-rose-50/30 border border-rose-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-rose-600/5 outline-none transition-all placeholder:text-rose-200"
                      placeholder="0.00"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tax Duty Ledger</label>
                    <div className="relative">
                      <select
                        value={tdsLedgerId}
                        onChange={(e) => setTdsLedgerId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full pl-4 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-rose-600 transition-all appearance-none"
                      >
                        <option value="">Map To Duty Ledger...</option>
                        {tdsLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Narration & High-Contrast Summary */}
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex flex-col h-full space-y-10 relative z-10">
               <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-4">Internal Remarks</p>
                  <textarea
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Enter transaction narrative for historical audit trail..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium focus:bg-white/10 focus:border-white/20 outline-none h-24 resize-none placeholder:text-slate-600 transition-all"
                  />
               </div>

               <div className="pt-6 border-t border-white/10 space-y-5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                     <span>Liquid Funds (Net Paid)</span>
                     <span className="text-white font-black">₹{parseFloat(amount || '0').toLocaleString()}</span>
                  </div>
                  {hasTds && (
                    <div className="flex justify-between items-center text-xs font-bold text-rose-400">
                       <span>Tax Offset (TDS)</span>
                       <span className="font-black">+ ₹{parseFloat(tdsAmount || '0').toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-6 flex justify-between items-end border-t border-white/20">
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Gross Ledger Debit</p>
                        <h2 className="text-4xl font-black tracking-tighter">₹{(parseFloat(amount || '0') + (hasTds ? parseFloat(tdsAmount || '0') : 0)).toLocaleString()}</h2>
                     </div>
                     <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-2">
                        <Check size={24} className="text-white stroke-[4]" />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Selection Modal */}
      {isAllocationModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setIsAllocationModalOpen(false)} />
           <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Search size={24} /></div>
                    <div>
                       <h2 className="text-xl font-black text-slate-900">Purchase Bill Allocation</h2>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Settle liabilities from Ledger database</p>
                    </div>
                 </div>
                 <button onClick={() => setIsAllocationModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-90"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2rem] mb-10 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-600/5 rounded-full -mr-16 -mt-16" />
                    <div>
                       <p className="text-[10px] font-black uppercase text-indigo-400 mb-1 tracking-widest">Available Funds to Map</p>
                       <p className="text-3xl font-black text-indigo-900 tracking-tighter">₹{parseFloat(amount || '0').toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Currently Allocated</p>
                       <p className={`text-3xl font-black tracking-tighter ${allocatedTotal > parseFloat(amount || '0') ? 'text-rose-500' : 'text-emerald-600'}`}>₹{allocatedTotal.toLocaleString()}</p>
                    </div>
                 </div>

                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
                          <th className="py-4 px-6 w-[80px]">Map</th>
                          <th className="py-4 px-6">Purchase Ref</th>
                          <th className="py-4 px-6">Bill Date</th>
                          <th className="py-4 px-6 text-right">Balance O/S</th>
                          <th className="py-4 px-6 text-right">Settlement Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {pendingInvoices.map((inv, idx) => (
                          <tr key={inv.id} className={`group hover:bg-slate-50 transition-all ${inv.selected ? 'bg-indigo-50/20' : ''}`}>
                             <td className="py-6 px-6">
                                <button
                                  onClick={() => {
                                    const next = [...pendingInvoices];
                                    next[idx].selected = !next[idx].selected;
                                    if (next[idx].selected) {
                                      const remaining = Math.max(0, parseFloat(amount || '0') - allocatedTotal);
                                      next[idx].allocated_amount = Math.min(remaining, inv.pending_amount);
                                    } else {
                                      next[idx].allocated_amount = 0;
                                    }
                                    setPendingInvoices(next);
                                  }}
                                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${inv.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white group-hover:border-indigo-400'}`}
                                >
                                   {inv.selected && <Check size={16} strokeWidth={4} />}
                                </button>
                             </td>
                             <td className="py-6 px-6 font-black text-sm text-indigo-600 tracking-tight underline underline-offset-4 decoration-indigo-100">{inv.invoice_no}</td>
                             <td className="py-6 px-6 font-bold text-xs text-slate-500 uppercase">{inv.voucher_date}</td>
                             <td className="py-6 px-6 text-right font-black text-slate-900">₹{inv.pending_amount.toLocaleString()}</td>
                             <td className="py-6 px-6 text-right">
                                <div className="relative group">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 group-focus-within:text-indigo-600">₹</span>
                                  <input
                                    type="number"
                                    disabled={!inv.selected}
                                    value={inv.allocated_amount}
                                    onChange={(e) => {
                                      const next = [...pendingInvoices];
                                      next[idx].allocated_amount = parseFloat(e.target.value) || 0;
                                      setPendingInvoices(next);
                                    }}
                                    className={`w-36 pl-8 pr-4 py-2.5 rounded-xl text-sm font-black text-right outline-none transition-all ${inv.selected ? 'bg-white border-2 border-indigo-200 shadow-sm focus:border-indigo-600' : 'bg-slate-100 border-transparent text-slate-300'}`}
                                  />
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                 <button onClick={() => setIsAllocationModalOpen(false)} className="px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-rose-500 transition-all bg-white border border-slate-200 shadow-sm">Go Back</button>
                 <button onClick={() => setIsAllocationModalOpen(false)} className="bg-slate-900 text-white px-12 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-slate-200 flex items-center gap-3 hover:bg-black transition-all transform active:scale-95">
                    <Check size={18} className="text-emerald-400 stroke-[3]" /> Confirm Mappings
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVoucher;
