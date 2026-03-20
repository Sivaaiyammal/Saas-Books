import React from 'react';

interface VoucherRow {
  id: string;
  date: string;
  party: string;
  amount: number;
  status: string;
}

interface VoucherTableProps {
  data: VoucherRow[];
  total: number;
  isPurchase?: boolean;
}

export const VoucherTable: React.FC<VoucherTableProps> = ({ data, total, isPurchase }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Voucher No</th>
            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Party</th>
            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-bold text-indigo-600">{row.id}</td>
              <td className="px-6 py-4 text-slate-600">{row.date}</td>
              <td className="px-6 py-4 text-slate-700 font-medium">{row.party}</td>
              <td className="px-6 py-4 text-right font-black text-slate-900">
                ₹{row.amount.toLocaleString()}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                  row.status === 'posted'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total {isPurchase ? 'Purchase' : 'Sales'}
            </td>
            <td className="px-6 py-4 text-right font-black text-slate-900">
              ₹{total.toLocaleString()}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
