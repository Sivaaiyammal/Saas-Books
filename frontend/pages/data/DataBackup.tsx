
import React, { useState, useRef } from 'react';
import { Download, Upload, FolderOpen, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api';

const DataBackup: React.FC = () => {
  const [backupFilename, setBackupFilename] = useState(
    `backup_${new Date().toISOString().slice(0, 10)}.json`
  );
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState('');
  const [backupScope, setBackupScope] = useState<'all' | 'vouchers' | 'masters'>('all');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const supportsDirectoryPicker =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handleSelectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirectoryHandle(handle);
      setFolderName(handle.name);
    } catch {
      // User cancelled picker
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const response = await apiClient(`/data/backup.php?scope=${backupScope}`);
      if (!response.success) throw new Error(response.message || 'Backup failed');

      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = backupFilename.trim() || `backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (directoryHandle) {
        const fileHandle = await (directoryHandle as any).getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setMessage({ type: 'success', text: `Backup saved to ${directoryHandle.name}/${filename}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: `Backup downloaded as ${filename}` });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Backup failed.' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const response = await apiClient('/data/backup.php', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.success) throw new Error(response.message || 'Restore failed');
      setMessage({ type: 'success', text: 'Data restored successfully.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Restore failed. Check file format.' });
    } finally {
      setIsRestoring(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Backup & Restore</h1>
        <p className="text-sm text-slate-500 font-bold mt-1">
          Export your company data or restore from a previous backup.
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

      {/* Backup Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Download size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Create Backup</h2>
            <p className="text-xs text-slate-500 font-bold">Export company data as a JSON file</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Scope */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
              Backup Scope
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['all', 'vouchers', 'masters'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setBackupScope(s)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                    backupScope === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {s === 'all' ? 'All Data' : s === 'vouchers' ? 'Vouchers Only' : 'Masters Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Filename */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
              File Name
            </label>
            <input
              type="text"
              value={backupFilename}
              onChange={(e) => setBackupFilename(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="backup_2025-03-26.json"
            />
          </div>

          {/* Save Location */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
              Save Location
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                readOnly={supportsDirectoryPicker}
                placeholder={
                  supportsDirectoryPicker
                    ? 'Click Browse to select folder...'
                    : 'Default: Downloads folder'
                }
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 bg-slate-50 focus:outline-none"
              />
              {supportsDirectoryPicker && (
                <button
                  onClick={handleSelectFolder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200 whitespace-nowrap"
                >
                  <FolderOpen size={16} /> Browse
                </button>
              )}
            </div>
            {!supportsDirectoryPicker && (
              <p className="text-[11px] text-slate-400 font-bold mt-1.5">
                Folder selection requires a Chromium-based browser. File will download to your
                default Downloads folder.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-60"
        >
          {isBackingUp ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isBackingUp ? 'Creating Backup...' : 'Download Backup'}
        </button>
      </div>

      {/* Restore Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Restore from Backup</h2>
            <p className="text-xs text-slate-500 font-bold">
              Import data from a previously exported JSON backup file
            </p>
          </div>
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-amber-300 transition-colors">
          <RefreshCw size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-black text-slate-500 mb-4">Select a backup JSON file to restore</p>
          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
            <Upload size={14} />
            Choose File
            <input
              ref={restoreFileRef}
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              disabled={isRestoring}
              className="hidden"
            />
          </label>
        </div>

        {isRestoring && (
          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <Loader2 size={16} className="animate-spin" />
            Restoring data, please wait...
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-700">
            Restoring will overwrite existing records with the same IDs. Backup your current data
            before restoring.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataBackup;
