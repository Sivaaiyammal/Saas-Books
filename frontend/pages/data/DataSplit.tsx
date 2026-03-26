
import React, { useState } from 'react';
import { Scissors, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api';

const DataSplit: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [scope, setScope] = useState<'all' | 'vouchers'>('vouchers');
  const [isSplitting, setIsSplitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSplit = async () => {
    if (!fromDate || !toDate) {
      setMessage({ type: 'error', text: 'Please select both From and To dates.' });
      return;
    }
    if (fromDate > toDate) {
      setMessage({ type: 'error', text: '"From" date cannot be after "To" date.' });
      return;
    }
    setIsSplitting(true);
    setMessage(null);
    try {
      const response = await apiClient(
        `/data/backup.php?scope=${scope}&from_date=${fromDate}&to_date=${toDate}`
      );
      if (!response.success) throw new Error(response.message || 'Split export failed');

      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = `split_${fromDate}_to_${toDate}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: `Split data exported as ${filename}` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Split export failed.' });
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Split Data</h1>
        <p className="text-sm text-slate-500 font-bold mt-1">
          Export a specific date range of your data as a separate file.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <Scissors size={20} className="text-purple-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Split by Date Range</h2>
            <p className="text-xs text-slate-500 font-bold">
              Extract and download data for a specific period
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Scope */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
              Data Scope
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['all', 'vouchers'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                    scope === s
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-purple-300'
                  }`}
                >
                  {s === 'all' ? 'All Data' : 'Vouchers Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSplit}
          disabled={isSplitting}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-60"
        >
          {isSplitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isSplitting ? 'Exporting...' : 'Export Split Data'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="font-black text-slate-900 mb-3 text-sm uppercase tracking-widest">
          How Split Works
        </h3>
        <ul className="space-y-2 text-sm text-slate-600 font-bold">
          <li className="flex items-start gap-2">
            <span className="text-purple-500 mt-0.5">•</span>
            Select the date range you want to extract
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-500 mt-0.5">•</span>
            Choose whether to export all data or only vouchers for that period
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-500 mt-0.5">•</span>
            Download the extracted data as a JSON file
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-500 mt-0.5">•</span>
            The split file can be restored to another company account via Backup &amp; Restore
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DataSplit;
