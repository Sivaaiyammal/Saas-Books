
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  Search, 
  ChevronDown, 
  Settings, 
  FileText, 
  Truck, 
  Zap, 
  MapPin, 
  Building2, 
  Phone, 
  PackageCheck, 
  Package,
  ArrowLeft,
  History
} from 'lucide-react';
import { VoucherTable } from '../components/ReportComponents.tsx';
import EWayBillComponent from '../components/EWayBillComponent';


const Vouchers: React.FC = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'form' | 'history'>('form');
  
  // Mock Entries for History View
  const mockHistory = useMemo(() => [
    { id: 'INV/24-25/001', date: '2023-10-01', party: 'Silk Emporium', amount: 47250, status: 'posted' },
    { id: 'INV/24-25/002', date: '2023-10-02', party: 'Modern Weaves', amount: 91840, status: 'posted' },
    { id: 'INV/24-25/005', date: '2023-10-08', party: 'Surat Textiles', amount: 136400, status: 'posted' },
  ], []);

  // Mock Stock Items
  const stockItems = [
    { id: 'S1', name: 'Premium Cotton Blue', rate: 450, unit: 'Meters', stock: 1250, gst: 5 },
    { id: 'S2', name: 'Silk Saree Red', rate: 4200, unit: 'Pcs', stock: 45, gst: 12 },
    { id: 'S3', name: 'Linen Yarn White', rate: 850, unit: 'Kgs', stock: 85, gst: 5 },
  ];

  const gstRates = [0, 5, 12, 18, 28];
  const unitsList = ['Meters', 'Pcs', 'Kgs', 'Rolls', 'Cones'];

  const [rows, setRows] = useState([
    { id: 1, itemId: '', item: '', colour: '', dia: '', count: '', qty: 0, unit: 'Meters', rate: 0, gst: 5, amount: 0 }
  ]);
  
  const [prefix, setPrefix] = useState(type === 'purchase' ? 'PUR' : 'INV');
  const [suffix, setSuffix] = useState('24-25');
  const [sequence, setSequence] = useState('0012');
  const [isConsigneeSame, setIsConsigneeSame] = useState(true);

  const parties = [
    { id: '1', name: 'Silk Emporium', address: '123 Textile Market, Surat, GJ', gst: '24AAAAA0000A1Z5', phone: '+91 98765 43210' },
    { id: '2', name: 'Modern Weaves', address: '45 Fashion Street, Mumbai, MH', gst: '27BBBBB1111B2Z6', phone: '+91 88888 77777' },
  ];
  const [selectedParty, setSelectedParty] = useState(parties[0]);
  const [enableEWayBill, setEnableEWayBill] = useState(false);
  const [isEwbModalOpen, setIsEwbModalOpen] = useState(false);
  const [savedInvoiceData, setSavedInvoiceData] = useState<any>(null);

  const addRow = () => setRows([...rows, { id: Date.now(), itemId: '', item: '', colour: '', dia: '', count: '', qty: 0, unit: 'Meters', rate: 0, gst: 5, amount: 0 }]);
  const removeRow = (id: number) => rows.length > 1 && setRows(rows.filter(r => r.id !== id));

  const handleItemChange = (idx: number, itemId: string) => {
    const newRows = [...rows];
    const selected = stockItems.find(item => item.id === itemId);
    if (selected) {
      newRows[idx] = { ...newRows[idx], itemId, item: selected.name, rate: selected.rate, unit: selected.unit, gst: selected.gst, amount: newRows[idx].qty * selected.rate };
      setRows(newRows);
    }
  };

  const updateRowValue = (idx: number, field: string, value: any) => {
    const newRows = [...rows];
    (newRows[idx] as any)[field] = value;
    if (field === 'qty' || field === 'rate') newRows[idx].amount = newRows[idx].qty * newRows[idx].rate;
    setRows(newRows);
  };

  const totalAmount = rows.reduce((acc, curr) => acc + curr.amount, 0);
  const totalGst = rows.reduce((acc, curr) => acc + (curr.amount * (curr.gst / 100)), 0);

  if (viewMode === 'history') {
    return (
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button onClick={() => setViewMode('form')} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><ArrowLeft size={20} /></button>
             <div>
                <h1 className="text-2xl font-black text-slate-900 capitalize">{type} Register</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit Entries</p>
             </div>
          </div>
          <button onClick={() => setViewMode('form')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100">
             <Plus size={18} /> New Voucher
          </button>
        </div>
        <VoucherTable data={mockHistory} total={mockHistory.reduce((a, b) => a + b.amount, 0)} isPurchase={type === 'purchase'} />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all"><ArrowLeft size={20} /></button>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${type === 'sales' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {type?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 capitalize">{type} Voucher</h1>
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-0.5">{prefix}/{sequence}/{suffix}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setViewMode('history')} className="flex-1 md:flex-none px-6 py-3 rounded-xl text-indigo-600 bg-indigo-50 border border-indigo-100 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
            <History size={18} /> View History
          </button>
          <div className="flex items-center gap-2 mr-4 hidden md:flex">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest cursor-pointer flex items-center gap-2">
              <input 
                type="checkbox"
                checked={enableEWayBill} 
                onChange={(e) => setEnableEWayBill(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              Enable E-Way Bill
            </label>
          </div>
          <button 
            onClick={() => {
              // Mock save logic
              const newInvoice = {
                id: Date.now(),
                voucher_no: `${prefix}/${sequence}/${suffix}`,
                voucher_date: new Date().toISOString(),
                party_name: selectedParty.name,
                party_gstin: selectedParty.gst,
                total_amount: (totalAmount + totalGst).toString(),
                status: 'Posted',
                ewaybill: { status: 'not_generated' },
                consignee_name: selectedParty.name,
                consignee_gstin: selectedParty.gst,
                consignee_state: 'Maharashtra',
                consignee_address: selectedParty.address,
                consignee_city: 'Mumbai',
                consignee_pincode: '400001',
                // Add these as they are used in EWayBillComponent
                billing_name: selectedParty.name,
                billing_gstin: selectedParty.gst,
                billing_state: 'Maharashtra',
                billing_address: selectedParty.address,
                billing_city: 'Mumbai',
                billing_pincode: '400001'
              };
              
              setSavedInvoiceData(newInvoice);
              
              // Use setTimeout to ensure state is set before opening modal
              if (enableEWayBill) {
                setTimeout(() => {
                  setIsEwbModalOpen(true);
                }, 100);
              } else {
                alert('Voucher Saved Successfully!');
                navigate('/reports/sales');
              }
            }}
            className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Save size={18} /> Save & Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Ledger Selection</h3>
              <Building2 size={16} className="text-indigo-400" />
           </div>
           <select 
             onChange={(e) => setSelectedParty(parties.find(p => p.id === e.target.value) || parties[0])}
             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 outline-none appearance-none"
           >
             {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
           <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="text-xs font-bold text-slate-600 mb-1">{selectedParty.address}</div>
              <div className="text-[10px] font-black text-indigo-600 uppercase">GST: {selectedParty.gst}</div>
           </div>
        </div>
        <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center text-center items-center">
            <Calendar size={32} className="text-indigo-100 mb-2" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entry Date</p>
            <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 text-sm font-black text-slate-900 bg-transparent border-none text-center focus:ring-0" />
        </div>

        <div className="md:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Package size={18} className="text-indigo-600" /> Particulars</h3>
            <button onClick={addRow} className="bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl flex items-center gap-2"><Plus size={14} /> Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-4 w-[50px] text-center">#</th>
                  <th className="px-2 py-4 w-auto">Stock Item</th>
                  <th className="px-2 py-4 w-[120px]">Qty</th>
                  <th className="px-2 py-4 w-[110px]">Unit</th>
                  <th className="px-2 py-4 w-[130px]">Rate</th>
                  <th className="px-2 py-4 w-[150px] text-right pr-6">Amount</th>
                  <th className="px-2 py-4 w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="group hover:bg-slate-50/30">
                    <td className="px-4 py-4 text-[10px] font-bold text-slate-300 text-center">{idx + 1}</td>
                    <td className="px-2 py-4">
                      <select value={row.itemId} onChange={(e) => handleItemChange(idx, e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none">
                        <option value="">Select Item...</option>
                        {stockItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-4"><input type="number" value={row.qty} onChange={(e) => updateRowValue(idx, 'qty', parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black" /></td>
                    <td className="px-2 py-4">
                       <select value={row.unit} onChange={(e) => updateRowValue(idx, 'unit', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold">
                        {unitsList.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-4"><input type="number" value={row.rate} onChange={(e) => updateRowValue(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black" /></td>
                    <td className="px-2 py-4 text-right pr-6 font-black text-sm">₹{row.amount.toLocaleString()}</td>
                    <td className="px-2 py-4"><button onClick={() => removeRow(row.id)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
             <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Narration</p><input type="text" placeholder="Add remarks here..." className="bg-transparent border-none p-0 text-sm font-medium w-full mt-1 focus:ring-0 text-slate-300" /></div>
             <div className="text-right">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Grand Total</p>
                <p className="text-3xl font-black">₹{(totalAmount + totalGst).toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1 italic">Incl. Tax: ₹{totalGst.toLocaleString()}</p>
             </div>
          </div>
        </div>
      </div>
      <EWayBillComponent
        isOpen={isEwbModalOpen}
        onClose={() => setIsEwbModalOpen(false)}
        invoice={savedInvoiceData}
        businessDetails={{
          from_trade_name: 'Anus ERP Default User',
          gstin: '33AABCU9603R1ZM',
          from_state: 'Tamil Nadu',
          from_addr1: 'Main Street',
          from_place: 'Chennai',
          from_pincode: '600001',
          username: '',
        }}
        onSuccess={() => {
          navigate('/reports/sales');
        }}
        onPrintEwb={() => alert('Print EWB Functionality inside Voucher')}
        onViewEwb={() => alert('View EWB Functionality inside Voucher')}
        onCancelEwb={() => alert('Cancel EWB Functionality inside Voucher')}
      />
    </div>
  );
};

export default Vouchers;
