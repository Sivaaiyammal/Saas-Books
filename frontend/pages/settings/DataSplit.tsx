import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scissors, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Info,
  Loader2,
  History
} from 'lucide-react';
import { settingsApi, setSelectedFinancialYearId, getSelectedFinancialYearId } from '../../services/api';

const DataSplit: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [currentFy, setCurrentFy] = useState<any>(null);
  const [nextFy, setNextFy] = useState({
    code: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchCurrentFy();
  }, []);

  const fetchCurrentFy = async () => {
    setLoading(true);
    try {
      const selectedId = getSelectedFinancialYearId();
      const res = await settingsApi.getFinancialYears();
      if (res.success && res.data.financial_years) {
        const current = res.data.financial_years.find(fy => fy.id === selectedId) || res.data.financial_years[0];
        setCurrentFy(current);
        
        // Predetermine next FY
        if (current) {
          const startYear = parseInt(current.start_date.split('-')[0]) + 1;
          const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
          setNextFy({
            code: `${startYear}-${endYearShort}`,
            startDate: `${startYear}-04-01`,
            endDate: `${startYear + 1}-03-31`
          });
        }
      }
    } catch (error) {
      alert("Failed to load financial years");
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = async () => {
    if (!window.confirm("Are you sure you want to split the financial year? This will create opening balances in the new year and set the current year to read-only.")) {
      return;
    }

    setSplitting(true);
    try {
      const res = await settingsApi.splitFinancialYear({
        new_fy_code: nextFy.code,
        start_date: nextFy.startDate,
        end_date: nextFy.endDate
      });

      if (res.success && res.data?.new_financial_year_id) {
        alert("Financial year split successfully!");
        setSelectedFinancialYearId(res.data.new_financial_year_id);
        navigate('/');
        window.location.reload();
      } else {
        alert(res.message || "Split failed");
      }
    } catch (error: any) {
      alert(error.message || "An error occurred during split");
    } finally {
      setSplitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 text-indigo-50/50">
          <Scissors size={120} strokeWidth={1} />
        </div>
        
        <div className="relative">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4">
            <History size={14} />
            <span>Data Management</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Financial Year Split</h1>
          <p className="text-slate-500 max-w-xl">
            Cleanly separate your data by financial year. This process calculates closing balances from the current year and carries them forward as opening entries for the new year.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Year Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Source Year</h3>
            <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
              Moving From
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                <Calendar size={24} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Year</div>
                <div className="text-xl font-black text-slate-900 tracking-tight">FY {currentFy?.code}</div>
              </div>
            </div>
            
            <div className="text-xs text-slate-500 px-2 italic">
              * This year's data will become read-only history.
            </div>
          </div>
        </div>

        {/* Next Year Card */}
        <div className="bg-white rounded-3xl border border-indigo-200 p-8 shadow-sm relative ring-4 ring-indigo-50/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-indigo-900 tracking-tight">Target Year</h3>
            <div className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
              New Year
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <div className="w-12 h-12 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-500 shadow-sm">
                <Scissors size={24} />
              </div>
              <div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">New Financial Year</div>
                <div className="text-xl font-black text-indigo-900 tracking-tight">FY {nextFy.code}</div>
              </div>
            </div>
            
            <div className="text-xs text-indigo-600 font-bold px-2 flex items-center space-x-2">
              <CheckCircle2 size={14} />
              <span>Starting balances will be generated automatically.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings & Info */}
      <div className="bg-amber-50 rounded-3xl p-8 border border-amber-200">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-sm">
            <AlertTriangle size={24} strokeWidth={2.5} />
          </div>
          <div className="space-y-4 flex-1">
            <h3 className="text-lg font-black text-amber-900 tracking-tight">Important Prerequisites</h3>
            <ul className="text-sm text-amber-800/80 space-y-3">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Ensure all transactions for <strong>FY {currentFy?.code}</strong> are final and verified.</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Verify that there are no pending stock adjustments.</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>The old year (FY {currentFy?.code}) will be locked for editing after the split.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center space-y-6 pt-4 pb-12">
        <button
          onClick={handleSplit}
          disabled={splitting}
          className="group relative w-full max-w-sm flex items-center justify-center h-16 bg-slate-900 text-white rounded-2xl font-black text-lg tracking-tight hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl disabled:bg-slate-400 disabled:cursor-not-allowed overflow-hidden active:scale-98"
        >
          {splitting ? (
            <div className="flex items-center space-x-3">
              <Loader2 className="animate-spin" size={24} />
              <span>Splitting Year...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <span>Perform Financial Year Split</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </button>
        
        <div className="flex items-center space-x-2 text-slate-400 text-sm font-bold">
          <Info size={16} />
          <span>This action is irreversible. We recommend ensuring data is ready.</span>
        </div>
      </div>
    </div>
  );
};

export default DataSplit;
