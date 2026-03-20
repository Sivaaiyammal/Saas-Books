
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  FileText,
  Printer,
  Share2,
  Calendar,
  ArrowUpRight
} from 'lucide-react';

const Reports: React.FC = () => {
  const navigate = useNavigate();

  const reportCategories = [
    {
      title: 'Accounting Reports',
      items: [
        // { name: 'Balance Sheet', desc: 'Financial position as of date', id: 'balance_sheet' },
        // { name: 'Profit & Loss', desc: 'Income and Expenditure summary', id: 'pl_statement' },
        // { name: 'Trial Balance', desc: 'Summary of all ledger balances', id: 'trial_balance' },
        // { name: 'Cash/Bank Book', desc: 'Chronological recording of cash/bank', id: 'cash_book' },
        { name: 'Outstanding Report', desc: 'Amount due from customers', id: 'outstaing_report' }
      ]
    },
    {
      title: 'Inventory Reports',
      items: [
        { name: 'Stock Summary', desc: 'Status of stock-in-hand group-wise', id: 'stock_summary' },
        // { name: 'Godown Stock', desc: 'Inventory distribution across godowns', id: 'godown_stock' },
        // { name: 'Stock Ageing', desc: 'Analysis of stock duration', id: 'stock_ageing' },
        { name: 'Movement Analysis', desc: 'Flow of items in and out', id: 'movement' },
      ]
    },
    {
      title: 'Sales & Purchases',
      items: [
        { name: 'Sales Register', desc: 'Detailed list of all sales invoices', id: 'sales_register' },
        { name: 'Purchase Register', desc: 'Detailed list of all purchase invoices', id: 'purchase_register' },
        { name: 'Quotation Register', desc: 'Detailed list of all quotations', id: 'quotation_register' },
        // { name: 'Outstanding Payables', desc: 'Amount due to suppliers', id: 'payables' },
      ]
    }
  ];

  const handleReportClick = (id: string) => {
    switch (id) {
      case 'sales_register':
        navigate('/reports/sales-register');
        break;
      case 'purchase_register':
        navigate('/reports/purchase-register');
        break;
      case 'quotation_register':
        navigate('/reports/quotation-register');
        break;
      case 'outstaing_report':
        navigate('/reports/outstanding');
        break;
      case 'stock_summary':
        navigate('/reports/summary');
        break;
      case 'movement':
        navigate('/reports/movement');
        break;
      default:
        // Other reports not yet implemented
        break;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Advanced Reporting</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium uppercase tracking-widest text-[10px]">Financial & Inventory Intelligence</p>
        </div>
        {/* <div className="flex gap-2">
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
            <Printer size={20} />
          </button>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
            <Share2 size={20} />
          </button>
        </div> */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reportCategories.map((category, idx) => (
          <div key={idx} className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-2">
              {category.title}
            </h3>
            <div className="space-y-4">
              {category.items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleReportClick(item.id)}
                  className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-100/30 hover:border-indigo-200 transition-all group cursor-pointer relative overflow-hidden active:scale-[0.98]"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-500" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.name}</h4>
                          <p className="text-xs text-slate-500 mt-1 font-medium">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <Calendar size={12} className="text-indigo-400" /> Last run: 2h ago
                      </div>
                      <button className="p-2 rounded-xl text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Audit Logs / Activity */}
      {/* <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-indigo-200/20 p-8 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full -ml-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                <BarChart2 size={20} />
              </div>
              <span className="uppercase tracking-widest text-xs font-black">System Audit Intelligence</span>
            </h3>
            <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">Export Comprehensive Logs</button>
          </div>
          <div className="space-y-4">
            {[
              { user: 'Anand Kumar', action: 'Posted Sales Voucher #S-102', time: '10 mins ago', type: 'sale' },
              { user: 'Priya S.', action: 'Created Stock Item: Silk Premium', time: '45 mins ago', type: 'master' },
              { user: 'Anand Kumar', action: 'Modified Ledger: Modern Weaves', time: '2 hours ago', type: 'ledger' },
              { user: 'System', action: 'Cloud Snapshot successful', time: '5 hours ago', type: 'system' },
            ].map((log, i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border ${log.type === 'sale' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    log.type === 'master' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                      'bg-slate-500/10 border-slate-500/20 text-slate-400'
                    }`}>
                    {log.user[0]}
                  </div>
                  <div>
                    <span className="font-bold text-slate-100 text-sm group-hover:text-indigo-400 transition-colors">{log.user}</span>
                    <span className="text-slate-500 ml-3 text-sm font-medium">{log.action}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default Reports;
