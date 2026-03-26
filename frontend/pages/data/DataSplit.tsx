
import React, { useState } from 'react';
import {
  Scissors,
  ShieldCheck,
  Copy,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Building2,
  FileText,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AffectedVoucher {
  voucher_no: string;
  voucher_type: string;
  voucher_date: string;
  total_amount: number;
  entry_dr: number;
  entry_cr: number;
}

interface VerifyCheck {
  type: 'ok' | 'warning' | 'error';
  code: string;
  count: number;
  message: string;
  affected_vouchers?: AffectedVoucher[];
}

interface VerifyResult {
  checks: VerifyCheck[];
  can_proceed: boolean;
  summary: {
    vouchers_before_split: number;
    vouchers_from_split: number;
    total_ledgers: number;
  };
}

interface SplitResult {
  company_a: { id: number; name: string; code: string; voucher_count: number; period: string };
  company_b: { id: number; name: string; code: string; voucher_count: number; period: string };
  opening_balances_set: number;
  split_date: string;
}

type Stage = 'configure' | 'verify' | 'execute' | 'done';

// ── Sub-components ─────────────────────────────────────────────────────────────

const StageIndicator: React.FC<{ current: Stage }> = ({ current }) => {
  const stages: { key: Stage; label: string; icon: React.ReactNode }[] = [
    { key: 'configure', label: 'Configure',    icon: <Scissors size={14} /> },
    { key: 'verify',    label: 'Verification', icon: <ShieldCheck size={14} /> },
    { key: 'execute',   label: 'Clone & Split', icon: <Copy size={14} /> },
    { key: 'done',      label: 'Done',         icon: <CheckCircle size={14} /> },
  ];

  const order: Stage[] = ['configure', 'verify', 'execute', 'done'];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex items-center gap-0 mb-8">
      {stages.map((s, i) => {
        const idx = order.indexOf(s.key);
        const isDone    = idx < currentIdx;
        const isActive  = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all font-black text-xs border-2 ${
                  isDone
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
              >
                {isDone ? <CheckCircle size={16} /> : s.icon}
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                  isActive ? 'text-indigo-600' : isDone ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-5 mx-1 transition-all ${
                  idx < currentIdx ? 'bg-emerald-300' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const FIX_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  draft_vouchers: {
    title: 'How to fix: Draft Vouchers',
    steps: [
      'Go to Vouchers → Sales / Purchase register',
      'Filter by status = Draft',
      'Open each draft voucher and click "Post" or "Cancel" it',
      'Re-run verification once all drafts are resolved',
    ],
  },
  pending_bills: {
    title: 'About: Pending Bills',
    steps: [
      'These are outstanding receivables/payables not yet settled before the split date',
      'Their ledger closing balance will automatically become the opening balance in Company B',
      'No manual action is needed — you can safely proceed',
    ],
  },
  trial_balance_mismatch: {
    title: 'About: Trial Balance Difference',
    steps: [
      'This typically happens with vouchers created before double-entry (Dr/Cr) entries were enabled',
      'Opening balances are still calculated correctly per-ledger from individual entries',
      'You can safely proceed — the split will not lose any data',
      'Optional: open each affected voucher below, edit and re-save it to regenerate its entries',
    ],
  },
};

const CheckRow: React.FC<{ check: VerifyCheck }> = ({ check }) => {
  const [expanded, setExpanded] = useState(false);

  const config = {
    ok:      { icon: <CheckCircle size={16} />,    bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
    warning: { icon: <AlertTriangle size={16} />,  bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-800',   iconColor: 'text-amber-500' },
    error:   { icon: <XCircle size={16} />,        bg: 'bg-rose-50',    border: 'border-rose-100',    text: 'text-rose-700',    iconColor: 'text-rose-500' },
  }[check.type];

  const fix = FIX_INSTRUCTIONS[check.code];
  const hasDetail = fix || (check.affected_vouchers && check.affected_vouchers.length > 0);

  return (
    <div className={`rounded-xl border ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3 p-4">
        <span className={`${config.iconColor} shrink-0 mt-0.5`}>{config.icon}</span>
        <div className="flex-1">
          <p className={`text-sm font-bold ${config.text}`}>{check.message}</p>
          {check.count > 0 && (
            <span className={`text-xs font-black uppercase tracking-widest ${config.iconColor}`}>
              {check.count} record{check.count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {hasDetail && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-xs font-black uppercase tracking-widest shrink-0 ${config.iconColor} hover:underline`}
          >
            {expanded ? 'Hide' : 'How to fix'}
          </button>
        )}
      </div>

      {expanded && fix && (
        <div className={`px-4 pb-4 border-t ${config.border}`}>
          <p className={`text-xs font-black uppercase tracking-widest ${config.iconColor} mt-3 mb-2`}>
            {fix.title}
          </p>
          <ol className="space-y-1.5">
            {fix.steps.map((step, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs font-bold ${config.text}`}>
                <span className={`font-black shrink-0 ${config.iconColor}`}>{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>

          {check.affected_vouchers && check.affected_vouchers.length > 0 && (
            <div className="mt-3">
              <p className={`text-xs font-black uppercase tracking-widest ${config.iconColor} mb-2`}>
                Affected Vouchers (top 5)
              </p>
              <div className="overflow-x-auto rounded-lg border border-amber-200">
                <table className="w-full text-xs font-bold">
                  <thead>
                    <tr className="bg-amber-100/60">
                      <th className="text-left px-3 py-2 text-amber-700 uppercase tracking-wider">Voucher No</th>
                      <th className="text-left px-3 py-2 text-amber-700 uppercase tracking-wider">Type</th>
                      <th className="text-left px-3 py-2 text-amber-700 uppercase tracking-wider">Date</th>
                      <th className="text-right px-3 py-2 text-amber-700 uppercase tracking-wider">Amount</th>
                      <th className="text-right px-3 py-2 text-amber-700 uppercase tracking-wider">Dr</th>
                      <th className="text-right px-3 py-2 text-amber-700 uppercase tracking-wider">Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.affected_vouchers.map((v, i) => (
                      <tr key={i} className="border-t border-amber-100">
                        <td className="px-3 py-2 text-amber-900">{v.voucher_no}</td>
                        <td className="px-3 py-2 text-amber-700">{v.voucher_type}</td>
                        <td className="px-3 py-2 text-amber-700">{v.voucher_date}</td>
                        <td className="px-3 py-2 text-right text-amber-900">₹{Number(v.total_amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-blue-600">₹{Number(v.entry_dr).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-rose-600">₹{Number(v.entry_cr).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const DataSplit: React.FC = () => {
  const [stage, setStage] = useState<Stage>('configure');

  // Configure form
  const [splitDate,    setSplitDate]    = useState('');
  const [companyAName, setCompanyAName] = useState('');
  const [companyACode, setCompanyACode] = useState('');
  const [companyBName, setCompanyBName] = useState('');
  const [companyBCode, setCompanyBCode] = useState('');

  // Results
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [splitResult,  setSplitResult]  = useState<SplitResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  // ── Verify ──────────────────────────────────────────────────────────────────
  const runVerify = async () => {
    if (!splitDate) { setError('Please select a split date.'); return; }
    if (!companyAName.trim() || !companyACode.trim() || !companyBName.trim() || !companyBCode.trim()) {
      setError('Please fill in all company name and code fields.');
      return;
    }
    setError(null);
    setLoading(true);
    setStage('verify');
    try {
      const res = await apiClient(`/data/split.php?action=verify&split_date=${splitDate}`);
      if (!res.success) throw new Error(res.message || 'Verification failed');
      setVerifyResult(res.data);
    } catch (e: any) {
      setError(e.message || 'Verification failed');
      setStage('configure');
    } finally {
      setLoading(false);
    }
  };

  // ── Execute ─────────────────────────────────────────────────────────────────
  const runSplit = async () => {
    setError(null);
    setLoading(true);
    setStage('execute');
    try {
      const res = await apiClient('/data/split.php', {
        method: 'POST',
        body: JSON.stringify({
          action:         'execute',
          split_date:     splitDate,
          company_a_name: companyAName,
          company_a_code: companyACode,
          company_b_name: companyBName,
          company_b_code: companyBCode,
        }),
      });
      if (!res.success) throw new Error(res.message || 'Split failed');
      setSplitResult(res.data);
      setStage('done');
    } catch (e: any) {
      setError(e.message || 'Split execution failed');
      setStage('verify');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStage('configure');
    setSplitDate('');
    setCompanyAName('');
    setCompanyACode('');
    setCompanyBName('');
    setCompanyBCode('');
    setVerifyResult(null);
    setSplitResult(null);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Split Company Data</h1>
        <p className="text-sm text-slate-500 font-bold mt-1">
          Partition your data into two separate companies at a specific date.
        </p>
      </div>

      <StageIndicator current={stage} />

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm font-bold text-rose-700">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stage 1: Configure ─────────────────────────────────────────────── */}
      {stage === 'configure' && (
        <div className="space-y-5">
          {/* How it works */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-indigo-900 text-sm uppercase tracking-widest flex items-center gap-2">
              <Info size={16} /> How Split Works
            </h3>
            <div className="space-y-2 text-xs font-bold text-indigo-700">
              {[
                { icon: <ShieldCheck size={13} />, text: 'Pre-split verification checks for draft vouchers, pending bills, and trial balance.' },
                { icon: <Copy size={13} />,        text: 'All masters (ledgers, items, groups) are cloned into both new companies.' },
                { icon: <FileText size={13} />,    text: 'Company A receives all vouchers before the split date. Company B receives vouchers from the split date onwards.' },
                { icon: <TrendingUp size={13} />,  text: 'Opening balances for Company B are auto-calculated from the closing balances of every ledger as of the split date.' },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">{row.icon}</span>
                  {row.text}
                </div>
              ))}
            </div>
          </div>

          {/* Split Date */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Scissors size={20} className="text-purple-600" />
              </div>
              <div>
                <h2 className="font-black text-slate-900">Split Configuration</h2>
                <p className="text-xs text-slate-500 font-bold">Choose the date and names for the two new companies</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Split Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={splitDate}
                onChange={(e) => setSplitDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-slate-400 font-bold mt-1.5">
                Company A: all vouchers before this date. Company B: vouchers from this date onwards.
              </p>
            </div>

            {/* Company A */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/60">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={13} className="text-slate-400" /> Company A — Pre-Split Period
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyAName}
                    onChange={(e) => setCompanyAName(e.target.value)}
                    placeholder="e.g. JustBuyPC (Old)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Company Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyACode}
                    onChange={(e) => setCompanyACode(e.target.value.toUpperCase())}
                    placeholder="e.g. JBPC-A"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Company B */}
            <div className="border border-indigo-100 rounded-xl p-4 space-y-3 bg-indigo-50/40">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={13} /> Company B — Post-Split Period (with Opening Balances)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyBName}
                    onChange={(e) => setCompanyBName(e.target.value)}
                    placeholder="e.g. JustBuyPC (New)"
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                    Company Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyBCode}
                    onChange={(e) => setCompanyBCode(e.target.value.toUpperCase())}
                    placeholder="e.g. JBPC-B"
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={runVerify}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-purple-700 transition-all"
            >
              <ShieldCheck size={16} /> Run Verification
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Stage 2: Verification (loading) ──────────────────────────────────── */}
      {stage === 'verify' && loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-purple-500" />
          <p className="font-black text-slate-700 uppercase tracking-widest text-sm">Running Verification…</p>
          <p className="text-xs text-slate-400 font-bold">Checking drafts, pending bills, and trial balance</p>
        </div>
      )}

      {/* ── Stage 2: Verification (results) ──────────────────────────────────── */}
      {stage === 'verify' && !loading && verifyResult && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Data Summary — Split at {splitDate}</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Vouchers (Company A)', value: verifyResult.summary.vouchers_before_split, color: 'text-blue-600' },
                { label: 'Vouchers (Company B)', value: verifyResult.summary.vouchers_from_split,   color: 'text-purple-600' },
                { label: 'Ledgers to Clone',     value: verifyResult.summary.total_ledgers,         color: 'text-indigo-600' },
              ].map((s) => (
                <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Checks */}
          <div className="space-y-2">
            {verifyResult.checks.map((check, i) => (
              <CheckRow key={i} check={check} />
            ))}
            {verifyResult.checks.length === 0 && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700">
                <CheckCircle size={16} /> All checks passed. No issues found.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            {verifyResult.can_proceed ? (
              <div className="space-y-3">
                {verifyResult.checks.some(c => c.type === 'warning') && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs font-bold text-amber-700 space-y-1">
                      <p className="font-black">
                        {verifyResult.checks.filter(c => c.type === 'warning').length} warning(s) found — you can still proceed.
                      </p>
                      <p>
                        Click <span className="font-black">"How to fix"</span> on each warning above for instructions.
                        The original company remains intact throughout this process.
                        Two new companies will be created — this cannot be undone.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStage('configure')}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={runSplit}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    <Scissors size={14} /> Proceed with Split
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-xs font-bold text-rose-700 space-y-1">
                    <p className="font-black">Blocking errors found — resolve them before proceeding.</p>
                    <p>Click <span className="font-black">"How to fix"</span> on each red item above for step-by-step instructions.</p>
                  </div>
                </div>
                <button
                  onClick={() => setStage('configure')}
                  className="px-5 py-2.5 border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage 3: Executing ────────────────────────────────────────────────── */}
      {stage === 'execute' && loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center gap-5">
          <div className="relative">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-black text-slate-900 uppercase tracking-widest text-sm">Splitting Data…</p>
            <p className="text-xs text-slate-400 font-bold">Cloning masters, partitioning vouchers, calculating opening balances</p>
            <p className="text-[11px] text-slate-400 font-bold">This may take a moment — do not close this window.</p>
          </div>
          <div className="w-full max-w-xs space-y-2 mt-2">
            {[
              'Creating company records…',
              'Cloning ledgers & groups…',
              'Partitioning vouchers…',
              'Calculating opening balances…',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stage 4: Done ─────────────────────────────────────────────────────── */}
      {stage === 'done' && splitResult && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-black text-emerald-900 text-lg">Split Complete!</h2>
              <p className="text-sm font-bold text-emerald-700">
                Two new companies have been created from your data.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Company A card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">{splitResult.company_a.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{splitResult.company_a.code}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Period</span>
                  <span className="text-slate-700">{splitResult.company_a.period}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Vouchers</span>
                  <span className="text-blue-700 font-black">{splitResult.company_a.voucher_count}</span>
                </div>
              </div>
            </div>

            {/* Company B card */}
            <div className="bg-white border border-indigo-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Building2 size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">{splitResult.company_b.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{splitResult.company_b.code}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Period</span>
                  <span className="text-slate-700">{splitResult.company_b.period}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Vouchers</span>
                  <span className="text-indigo-700 font-black">{splitResult.company_b.voucher_count}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Opening Balances Set</span>
                  <span className="text-emerald-700 font-black">{splitResult.opening_balances_set} ledgers</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Next Steps</h3>
            <ul className="space-y-2 text-sm text-slate-600 font-bold">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                Switch to the new companies from the company selector in the header
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                Verify the Trial Balance and Balance Sheet for each new company
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                Confirm that Company B's opening balances match Company A's closing balances
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                The original company remains intact as the parent archive
              </li>
            </ul>
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <RefreshCw size={14} /> Start Another Split
          </button>
        </div>
      )}
    </div>
  );
};

export default DataSplit;
