import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Layers,
  Package,
  Save,
  Loader2,
  TrendingDown,
  TrendingUp,
  Info,
  ShieldCheck,
  ChevronDown,
  Zap,
  Activity,
  Box,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { mastersApi, vouchersApi } from '../../services/api';

interface ConversionItem {
  id: string;
  item_id: number | '';
  qty: string;
}

const customSelectStyles = {
  control: (provided: any, state: { isFocused: any; }) => ({
    ...provided,
    backgroundColor: '#f8fafc', // bg-slate-50
    border: state.isFocused ? '1px solid #4f46e5' : '1px solid #e2e8f0', // border-slate-200, focus:border-indigo-600
    borderRadius: '0.75rem', // rounded-xl
    padding: '0.25rem 0', // custom padding to match height
    boxShadow: state.isFocused ? '0 0 0 2px rgba(79, 70, 229, 0.1)' : 'none', // focus:ring-2 focus:ring-indigo-600/10
    '&:hover': {
      borderColor: state.isFocused ? '#4f46e5' : '#cbd5e1',
    },
    minHeight: '38px', // match input height
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: '#0f172a', // text-slate-900
    fontSize: '0.75rem', // text-xs
    fontWeight: '700', // font-bold
  }),
  input: (provided: any) => ({
    ...provided,
    color: '#0f172a',
    fontSize: '0.75rem',
    fontWeight: '700',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#94a3b8', // placeholder:text-slate-400
    fontSize: '0.75rem',
    fontWeight: '700',
  }),
  option: (provided: any, state: { isSelected: any; isFocused: any; }) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? 'white' : '#0f172a',
    fontSize: '0.75rem',
    fontWeight: '700',
    '&:active': {
      backgroundColor: '#eef2ff',
    },
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: '0.75rem', // rounded-xl
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', // shadow-xl
    border: '1px solid #e2e8f0', // border-slate-200
  }),
};

const StockConvert: React.FC = () => {
  const navigate = useNavigate();

  // Master Data
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  // Form State
  const [isSaving, setIsSaving] = useState(false);
  const [conversionDate, setConversionDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');

  // Multi-item States
  const [fromItems, setFromItems] = useState<ConversionItem[]>([
    { id: crypto.randomUUID(), item_id: '', qty: '' }
  ]);
  const [toItems, setToItems] = useState<ConversionItem[]>([
    { id: crypto.randomUUID(), item_id: '', qty: '' }
  ]);

  // Fetch items and units
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, unitsRes] = await Promise.all([
          mastersApi.getItems(),
          mastersApi.getUnits()
        ]);
        if (itemsRes.success) setItems(itemsRes.data.items);
        if (unitsRes.success) setUnits(unitsRes.data.units);
      } catch (err) {
        console.error('Failed to load catalog', err);
      } finally {
        setIsLoadingItems(false);
      }
    };
    fetchData();
  }, []);

  // Helper to get unit symbol for an item
  const getUnitSymbol = (item: any) => {
    if (item.unit_symbol) return item.unit_symbol;
    const unit = units.find(u => u.id === item.unit_id);
    return unit?.symbol || unit?.name || '';
  };

  const itemOptions = useMemo(() => items.map(i => ({
    value: i.id,
    label: `${i.name} (${i.item_code || 'N/A'}) - Stock: ${parseFloat(i.opening_stock).toLocaleString()} ${getUnitSymbol(i)}`
  })).sort((a, b) => a.label.localeCompare(b.label)), [items, units]);

  const addFromRow = () => setFromItems([...fromItems, { id: crypto.randomUUID(), item_id: '', qty: '' }]);
  const addToRow = () => setToItems([...toItems, { id: crypto.randomUUID(), item_id: '', qty: '' }]);

  const removeFromRow = (id: string) => fromItems.length > 1 && setFromItems(fromItems.filter(i => i.id !== id));
  const removeToRow = (id: string) => toItems.length > 1 && setToItems(toItems.filter(i => i.id !== id));

  const updateFromItem = (id: string, field: keyof ConversionItem, value: any) => {
    setFromItems(fromItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const updateToItem = (id: string, field: keyof ConversionItem, value: any) => {
    setToItems(toItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const totals = useMemo(() => {
    const fromTotal = fromItems.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
    const toTotal = toItems.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
    return { fromTotal, toTotal };
  }, [fromItems, toItems]);

  const handleSave = async () => {
    const validFrom = fromItems.filter(i => i.item_id && parseFloat(i.qty) > 0);
    const validTo = toItems.filter(i => i.item_id && parseFloat(i.qty) > 0);

    if (validFrom.length === 0 || validTo.length === 0) {
      alert("Configuration Error: At least one item with valid quantity is required on both sides.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        from_items: validFrom.map(i => ({ item_id: Number(i.item_id), qty: parseFloat(i.qty) })),
        to_items: validTo.map(i => ({ item_id: Number(i.item_id), qty: parseFloat(i.qty) })),
        conversion_date: conversionDate,
        narration: narration.trim() || undefined
      };

      const res = await vouchersApi.stockConvert(payload);
      if (res.success) {
        alert(res.message || "Transformation complete!");
        navigate('/reports/stock-movement');
      } else {
        alert(res.message || "Process rejected by server.");
      }
    } catch (err: any) {
      alert(err.message || "Network link failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingItems) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16" />
        <div className="flex items-center gap-6 relative z-10">
          <button onClick={() => navigate(-1)} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner border border-indigo-100">
            <ArrowRightLeft size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none ">Stock Conversion</h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Bulk Stock Update</span>

            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 md:flex-none bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="text-emerald-400" />}
            {isSaving ? 'Processing...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Left Column: Flow Out (Consumption) */}
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl relative h-full flex flex-col">
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 rounded-l-[3rem]" />
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm"><TrendingDown size={20} /></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Consumption (Flow Out)</h3>
                 </div>
                 <button onClick={addFromRow} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"><Plus size={14} /> Add Input</button>
              </div>

              <div className="flex-1">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                          <th className="py-4 px-2">Source Item</th>
                          <th className="py-4 px-2 w-[160px]">Qty to Consume</th>
                          <th className="py-4 px-2 w-[50px]"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {fromItems.map((item) => {
                         const itemDetails = items.find(i => i.id === Number(item.item_id));
                         const selectedValue = itemOptions.find(opt => opt.value === Number(item.item_id));
                         return (
                          <tr key={item.id} className="group animate-in fade-in slide-in-from-left-4 duration-300">
                             <td className="py-4 px-2 align-top">
                                <div className="space-y-2">
                                   <div className="relative">
                                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                      <select
                                        value={item.item_id}
                                        onChange={(e) => updateFromItem(item.id, 'item_id', e.target.value)}
                                        className="hidden"
                                      >
                                        <option value="">Select Item...</option>
                                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code}) - {i.opening_stock} {getUnitSymbol(i)}</option>)}
                                      </select>
                                      <Select
                                        value={selectedValue}
                                        onChange={(option) => updateFromItem(item.id, 'item_id', option ? option.value : '')}
                                        options={itemOptions}
                                        styles={{...customSelectStyles, control: (base, state) => ({...customSelectStyles.control(base, state), paddingLeft: '2rem', borderColor: state.isFocused ? '#f43f5e' : '#e2e8f0' })}}
                                        placeholder="Select Item to Consume..."
                                      />
                                   </div>
                                   {itemDetails && (
                                     <div className="flex items-center gap-2 px-3 py-1 bg-rose-50/50 rounded-lg w-fit border border-rose-100/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span className="text-[9px] font-black text-rose-600 uppercase">Avail: {parseFloat(itemDetails.opening_stock).toLocaleString()} {getUnitSymbol(itemDetails)}</span>
                                     </div>
                                   )}
                                </div>
                             </td>
                             <td className="py-4 px-2 align-top">
                                <div className="relative group/input">
                                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-rose-400">-</span>
                                   <input
                                     type="number"
                                     value={item.qty}
                                     onChange={(e) => updateFromItem(item.id, 'qty', e.target.value)}
                                     placeholder="0.00"
                                     className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-rose-500 outline-none"
                                   />
                                </div>
                             </td>
                             <td className="py-4 px-2 text-right">
                                <button onClick={() => removeFromRow(item.id)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                             </td>
                          </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Input Qty</p>
                 <p className="text-xl font-black text-slate-900">{totals.fromTotal.toLocaleString()}</p>
              </div>
           </div>
        </div>

        {/* Right Column: Flow In (Production) */}
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl relative h-full flex flex-col">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 rounded-r-[3rem]" />
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm"><TrendingUp size={20} /></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Production (Flow In)</h3>
                 </div>
                 <button onClick={addToRow} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"><Plus size={14} /> Add Output</button>
              </div>

              <div className="flex-1">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                          <th className="py-4 px-2">Produced Item</th>
                          <th className="py-4 px-2 w-[160px]">Qty Created</th>
                          <th className="py-4 px-2 w-[50px]"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {toItems.map((item) => {
                         const itemDetails = items.find(i => i.id === Number(item.item_id));
                         const selectedValue = itemOptions.find(opt => opt.value === Number(item.item_id));
                         return (
                          <tr key={item.id} className="group animate-in fade-in slide-in-from-right-4 duration-300">
                             <td className="py-4 px-2 align-top">
                                <div className="space-y-2">
                                   <div className="relative">
                                      <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                      <select
                                        value={item.item_id}
                                        onChange={(e) => updateToItem(item.id, 'item_id', e.target.value)}
                                        className="hidden"
                                      >
                                        <option value="">Select Item...</option>
                                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code}) - {i.opening_stock} {getUnitSymbol(i)}</option>)}
                                      </select>
                                      <Select
                                        value={selectedValue}
                                        onChange={(option) => updateToItem(item.id, 'item_id', option ? option.value : '')}
                                        options={itemOptions}
                                        styles={{...customSelectStyles, control: (base, state) => ({...customSelectStyles.control(base, state), paddingLeft: '2rem', borderColor: state.isFocused ? '#10b981' : '#e2e8f0' })}}
                                        placeholder="Select Item to Produce..."
                                      />
                                   </div>
                                   {itemDetails && (
                                     <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50/50 rounded-lg w-fit border border-emerald-100/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Stock: {parseFloat(itemDetails.opening_stock).toLocaleString()} {getUnitSymbol(itemDetails)}</span>
                                     </div>
                                   )}
                                </div>
                             </td>
                             <td className="py-4 px-2 align-top">
                                <div className="relative group/input">
                                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500">+</span>
                                   <input
                                     type="number"
                                     value={item.qty}
                                     onChange={(e) => updateToItem(item.id, 'qty', e.target.value)}
                                     placeholder="0.00"
                                     className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-emerald-500 outline-none"
                                   />
                                </div>
                             </td>
                             <td className="py-4 px-2 text-right">
                                <button onClick={() => removeToRow(item.id)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                             </td>
                          </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Output Qty</p>
                 <p className="text-xl font-black text-slate-900">{totals.toTotal.toLocaleString()}</p>
              </div>
           </div>
        </div>

        {/* Shared Configuration */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-12 gap-8">
           <div className="md:col-span-8 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-lg grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Transformation Date</label>
                 <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600" size={18} />
                    <input
                      type="date"
                      value={conversionDate}
                      onChange={(e) => setConversionDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none"
                    />
                 </div>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Narration</label>
                 <div className="relative group">
                    <FileText className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-600" size={18} />
                    <textarea
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="e.g. Mixing Batch #102 for Export Order..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none h-[54px] resize-none"
                    />
                 </div>
              </div>
           </div>

           <div className="md:col-span-4 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-12 -mb-12 group-hover:scale-110 transition-transform duration-700" />
              <div className="space-y-6 relative z-10">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                    <ShieldCheck size={14} /> Movement Protocol
                 </h4>
                 <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                       <CheckCircle2 size={16} className="text-emerald-400 mt-0.5" />
                       <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase">Balances will be adjusted for <span className="text-white">{fromItems.filter(i=>i.item_id).length + toItems.filter(i=>i.item_id).length} items</span>.</p>
                    </li>
                    <li className="flex items-start gap-3">
                       <Info size={16} className="text-indigo-400 mt-0.5" />
                       <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase">Inventory values will be transferred via <span className="text-white">Weighted Moving Average</span>.</p>
                    </li>
                 </ul>
              </div>
              <div className="pt-6 border-t border-white/10 mt-6 flex justify-between items-center relative z-10">
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Efficiency Ratio</span>
                    <span className="text-lg font-black text-emerald-400">{totals.fromTotal > 0 ? (totals.toTotal / totals.fromTotal).toFixed(2) : '0.00'}</span>
                 </div>
                 <Zap className="text-amber-400 animate-pulse" size={20} />
              </div>
           </div>
        </div>

      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default StockConvert;