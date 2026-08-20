'use client';
import AppShell from '@/components/layout/AppShell';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import {
  Upload, FileSpreadsheet, CheckCircle2, Download,
  Trash2, Calendar, Hash, RefreshCw, AlertCircle, BarChart2, Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// Column definitions matching the exact upload format
const FORMAT_COLS = [
  'Consignee', 'Dealer Code', 'Loc', 'Part Category Code',
  'Part Num', 'Root Part Num', 'Day', 'Fiscal Year', 'Month',
  'Month Year', 'Cons Party Code', 'Cons Party Name', 'Party Type',
  'Document Num', 'Remarks', 'Net Retail Qty', 'Net Retail Selling',
  'Discount Amount', 'Net Retail DDL',
];

interface UploadResult {
  batchId: string;
  fileName: string;
  periods: string[];
  totalRows: number;
  insertedRows: number;
  deletedRows: number;
  skippedRows: number;
  status: string;
}

export default function SalesUploadPage() {
  const { isSuperAdmin, hasRole } = useAuth();
  const isAllowed = isSuperAdmin || hasRole('HO_Finance', 'Admin');

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('');

  const { data: history, mutate: mutateHistory } = useSWR('/retail-sales-upload/history', fetcher);
  const { data: periods } = useSWR('/retail-sales-upload/periods', fetcher);
  const { data: records } = useSWR(
    filterPeriod ? `/retail-sales-upload/records?monthYear=${encodeURIComponent(filterPeriod)}&pageSize=100` : null,
    fetcher
  );

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/retail-sales-upload/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      mutateHistory();
      toast.success(`✅ ${res.data.insertedRows} records inserted for: ${res.data.periods.join(', ')}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [mutateHistory]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const downloadTemplate = async (fmt: 'xlsx' | 'csv') => {
    try {
      const res = await api.get(`/retail-sales-upload/template?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retail_sales_template.${fmt}`;
      a.click();
      toast.success('Template downloaded!');
    } catch {
      toast.error('Template download failed');
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('Rollback this batch? This will delete all its uploaded records.')) return;
    try {
      await api.delete(`/retail-sales-upload/batch/${batchId}`);
      toast.success('Batch rolled back');
      mutateHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Rollback failed');
    }
  };

  const rawHistory = Array.isArray(history?.data) ? history.data : Array.isArray(history) ? history : [];
  const historyList = rawHistory.slice(0, 3);
  const periodsList: string[] = Array.isArray(periods) ? periods : [];
  const recordsList = Array.isArray(records?.data) ? records.data : [];

  if (!isAllowed) {
    return (
      <AppShell title="Sales Upload" breadcrumb="Retail Operations">
        <div className="max-w-xl mx-auto mt-16 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <Lock size={26} />
          </div>
          <h2 className="font-extrabold text-lg text-slate-900">Head Office Restricted Module</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Raw retail sales spreadsheet uploads are managed centrally by Head Office Finance & SuperAdmin. Branch accounts are not authorized to upload master sales files.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Sales Upload">
      <div className="max-w-6xl space-y-6">

        {/* Format Info + Template Download */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800 mb-1">Upload Retail Sales Data</h2>
              <p className="text-sm text-slate-500 mb-3">
                Upload 1 month, 2 months, or more in a single file. Existing data for detected periods is <strong className="text-blue-700">automatically replaced</strong> — no duplicates.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FORMAT_COLS.map(col => (
                  <span key={col} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono border border-blue-100">{col}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={() => downloadTemplate('xlsx')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition whitespace-nowrap">
                <Download size={13} /> Download .xlsx Template
              </button>
              <button onClick={() => downloadTemplate('csv')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition whitespace-nowrap">
                <Download size={13} /> Download .csv Template
              </button>
            </div>
          </div>
        </div>

        {/* Rewrite Note */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Rewrite Mode:</strong> When you upload data for <em>Jun 2026</em>, all existing records for <em>Jun 2026</em> are deleted first, then replaced with the new file's data. Re-uploading is always safe — zero duplicates.
          </div>
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragActive ? 'border-blue-400 bg-blue-50' : uploading ? 'border-slate-200 bg-slate-50 opacity-60 cursor-wait' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? 'bg-blue-100' : 'bg-blue-50'}`}>
              {uploading
                ? <RefreshCw size={32} className="text-blue-500 animate-spin" />
                : <FileSpreadsheet size={32} className="text-blue-500" />
              }
            </div>
            {uploading ? (
              <>
                <p className="text-slate-700 font-semibold text-lg">Uploading & Processing...</p>
                <p className="text-slate-400 text-sm">Deleting old period data, inserting new records</p>
              </>
            ) : isDragActive ? (
              <p className="text-blue-600 font-semibold text-lg">Drop the file here</p>
            ) : (
              <>
                <p className="text-slate-700 font-semibold text-lg">Drag & drop your Excel / CSV file</p>
                <p className="text-slate-400 text-sm">Supports .xlsx · .xls · .csv</p>
                <span className="mt-1 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition">Choose File</span>
              </>
            )}
          </div>
        </div>

        {/* Upload Result */}
        {result && (
          <div className="card p-5 border-l-4 border-emerald-500 fade-in">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <h2 className="font-semibold text-slate-800">Upload Successful</h2>
              <span className="ml-auto text-xs font-mono text-slate-400">{result.batchId.slice(0, 8)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Periods Detected', value: result.periods.join(', '), icon: Calendar },
                { label: 'Total Rows in File', value: result.totalRows, icon: Hash },
                { label: 'Records Inserted', value: result.insertedRows, icon: Upload },
                { label: 'Old Records Deleted', value: result.deletedRows, icon: Trash2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className="font-bold text-slate-800 text-sm">{value}</p>
                </div>
              ))}
            </div>
            {result.skippedRows > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                ⚠ {result.skippedRows} rows were skipped due to missing required fields.
              </p>
            )}
          </div>
        )}

        {/* Records Viewer */}
        {periodsList.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <BarChart2 size={16} className="text-blue-500" />
              <h2 className="font-semibold text-slate-800">Browse Records by Period</h2>
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select Period —</option>
                {periodsList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {filterPeriod && (
              <>
                {/* Totals row */}
                {records?.totals && (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Total Qty', value: records.totals.totalQty },
                      { label: 'Net Selling', value: `₹${Number(records.totals.totalSelling).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                      { label: 'Discount', value: `₹${Number(records.totals.totalDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                      { label: 'Net DDL', value: `₹${Number(records.totals.totalDdl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-blue-500">{label}</p>
                        <p className="font-bold text-blue-800">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
                  <table className="w-full text-xs min-w-[1200px] text-center align-middle border-collapse">
                    <thead className="table-header-navy sticky top-0 select-none">
                      <tr>
                        {['Consignee', 'Dealer Code', 'Loc', 'Part Category', 'Part Num', 'Root Part Num', 'Day', 'FY', 'Month', 'Month Year', 'Party Code', 'Party Name', 'Party Type', 'Doc Num', 'Remarks', 'Qty', 'Net Selling', 'Discount', 'DDL'].map((h, idx, arr) => (
                          <th key={h} className={`px-3 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase whitespace-nowrap ${idx < arr.length - 1 ? 'border-r border-slate-700/80' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white font-medium text-slate-800 align-middle">
                      {recordsList.length === 0 ? (
                        <tr><td colSpan={19} className="text-center align-middle py-8 text-slate-400 font-semibold border-b border-slate-200">No records found for {filterPeriod}</td></tr>
                      ) : recordsList.map((r: any, idx: number) => (
                        <tr key={r.id} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-rose-600 text-xs">{r.consignee}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-blue-700 text-xs">{r.dealerCode}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-800 text-xs">{r.loc}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-800 text-xs">{r.partCategoryCode}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-xs text-slate-800">{r.partNum}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-xs text-slate-600">{r.rootPartNum}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-800">{r.day}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-800">{r.fiscalYear}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-800 uppercase">{r.month}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-900">{r.monthYear}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-700">{r.consPartyCode}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-900 text-xs uppercase">{r.consPartyName}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200"><span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-semibold text-[10px] uppercase">{r.partyType}</span></td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-xs text-slate-800">{r.documentNum}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-600 font-medium">{r.remarks}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900">{r.netRetailQty}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-emerald-700">{r.netRetailSelling?.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-rose-600">{r.discountAmount?.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center align-middle font-mono font-semibold text-blue-700">{r.netRetailDdl?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {records?.total > 100 && (
                  <p className="text-xs text-slate-500 mt-2 text-center font-semibold">Showing first 100 of {records.total} records</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Upload History */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-blue-600" />
            <h2 className="font-extrabold text-slate-900 text-sm">Upload History & Audit Log</h2>
            <span className="ml-1 text-xs text-slate-500 font-bold">(Latest {historyList.length} batches)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
            <table className="w-full text-xs text-center align-middle border-collapse">
              <thead className="table-header-navy select-none">
                <tr>
                  {['Batch ID', 'File Name', 'Periods', 'Total Rows', 'Inserted', 'Deleted', 'Status', 'Uploaded At', 'Actions'].map((h, idx, arr) => (
                    <th key={h} className={`px-3 py-3 text-center align-middle text-[11px] font-black text-white uppercase whitespace-nowrap ${idx < arr.length - 1 ? 'border-r border-slate-700/80' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {historyList.length === 0 ? (
                  <tr><td colSpan={9} className="text-center align-middle py-10 text-slate-400 font-bold border-b border-slate-200">No uploads yet. Upload your first file above.</td></tr>
                ) : historyList.map((b: any, idx: number) => (
                  <tr key={b.batchId} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-black text-xs text-blue-700">
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-md">
                        {b.batchId?.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-extrabold text-slate-900 max-w-[160px] truncate">{b.fileName}</td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                      <div className="flex items-center justify-center flex-wrap gap-1">
                        {(b.monthYear || '').split(',').map((p: string) => (
                          <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] rounded-md font-mono font-black">{p.trim()}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-black text-slate-900">{b.totalRows}</td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-emerald-700 font-mono font-black">{b.insertedRows}</td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-rose-600 font-mono font-black">{b.deletedRows}</td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black ${b.status === 'DONE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-bold font-mono text-[11px] whitespace-nowrap">{b.createdAt ? new Date(b.createdAt).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <button onClick={() => deleteBatch(b.batchId)} className="inline-flex items-center justify-center gap-1 text-[11px] px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-black hover:bg-rose-100 transition shadow-xs">
                        <Trash2 size={11} /> Rollback
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
