'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { trpc } from '@/lib/trpc-client';

type Step = 'upload' | 'preview' | 'mapping' | 'importing' | 'done';

const FIELD_OPTIONS = ['name', 'barcode', 'sku', 'categoryName', 'costPrice', 'retailPrice', 'location', 'supplier', 'skip'] as const;

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; reason: string }[] } | null>(null);

  const importBatch = trpc.products.importBatch.useMutation();

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) return;
        setHeaders(data[0]);
        setRawData(data.slice(1).filter(row => row.some(cell => cell.trim())));

        const autoMap: Record<number, string> = {};
        data[0].forEach((h, i) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes('name') || lower.includes('product')) autoMap[i] = 'name';
          else if (lower.includes('barcode') || lower.includes('upc') || lower.includes('ean')) autoMap[i] = 'barcode';
          else if (lower.includes('cost')) autoMap[i] = 'costPrice';
          else if (lower.includes('retail') || lower.includes('price') || lower.includes('sell')) autoMap[i] = 'retailPrice';
          else if (lower.includes('category') || lower.includes('dept')) autoMap[i] = 'categoryName';
          else if (lower.includes('location') || lower.includes('aisle')) autoMap[i] = 'location';
          else if (lower.includes('supplier') || lower.includes('vendor')) autoMap[i] = 'supplier';
          else if (lower.includes('sku')) autoMap[i] = 'sku';
        });
        setMapping(autoMap);
        setStep('preview');
      },
    });
  }, []);

  async function runImport() {
    setStep('importing');
    const BATCH_SIZE = 200;
    let totalImported = 0;
    const allErrors: { row: number; reason: string }[] = [];

    const products = rawData.map((row) => {
      const obj: any = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field !== 'skip') {
          const val = row[parseInt(colIdx)]?.trim() || '';
          if (field === 'costPrice' || field === 'retailPrice') {
            obj[field] = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          } else {
            obj[field] = val;
          }
        }
      });
      return obj;
    }).filter(p => p.name);

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      try {
        const res = await importBatch.mutateAsync({ products: batch });
        totalImported += res.imported;
        allErrors.push(...res.errors.map((e: { row: number; reason: string }) => ({ ...e, row: e.row + i })));
      } catch (err: any) {
        allErrors.push({ row: i, reason: err.message || 'Batch failed' });
      }
      setProgress(Math.min(100, Math.round(((i + batch.length) / products.length) * 100)));
    }

    setResult({ imported: totalImported, errors: allErrors });
    setStep('done');
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Products
      </button>

      <h1 className="text-3xl font-black text-on-surface mb-8">Import Products</h1>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm max-w-2xl">
          <div
            className="border-2 border-dashed border-outline-variant rounded-xl p-12 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => document.getElementById('csv-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <span className="material-symbols-outlined text-[48px] text-outline mb-4">upload_file</span>
            <p className="text-on-surface font-bold">Drop CSV file here or click to browse</p>
            <p className="text-sm text-on-surface-variant mt-2">Supports .csv files from your POS export</p>
          </div>
          <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Preview</h2>
              <p className="text-sm text-on-surface-variant">{rawData.length} rows detected</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr>
                  {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left text-xs text-on-surface-variant font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rawData.slice(0, 5).map((row, ri) => (
                  <tr key={ri} className="border-t border-outline-variant/10">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-on-surface truncate max-w-[150px]">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setStep('mapping')} className="h-14 px-8 bg-primary text-on-primary font-bold rounded-xl active:scale-95 transition-all">
            Next: Map Columns
          </button>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 'mapping' && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm max-w-2xl space-y-4">
          <h2 className="text-lg font-bold text-on-surface">Map Columns</h2>
          <p className="text-sm text-on-surface-variant">Match your CSV columns to product fields</p>
          <div className="space-y-3">
            {headers.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm font-medium text-on-surface truncate flex-1">{h}</span>
                <select
                  value={mapping[i] || 'skip'}
                  onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}
                  className="h-10 px-3 bg-surface-container-high rounded-lg text-sm text-on-surface border-0 focus:outline-none"
                >
                  {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f === 'skip' ? '— Skip —' : f}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep('preview')} className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all">Back</button>
            <button
              onClick={runImport}
              disabled={!Object.values(mapping).includes('name') || !Object.values(mapping).includes('costPrice')}
              className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
            >
              Import {rawData.length} Products
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm max-w-md text-center">
          <span className="material-symbols-outlined animate-spin text-primary text-[48px] mb-4">progress_activity</span>
          <h2 className="text-lg font-bold text-on-surface">Importing...</h2>
          <div className="mt-4 h-3 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-on-surface-variant mt-2">{progress}% complete</p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && result && (
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm max-w-md">
          <div className="text-center mb-6">
            <span className="material-symbols-outlined text-success text-[48px] mb-2">check_circle</span>
            <h2 className="text-lg font-bold text-on-surface">Import Complete</h2>
            <p className="text-3xl font-black text-primary mt-2">{result.imported}</p>
            <p className="text-sm text-on-surface-variant">products imported</p>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-error/5 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-error">{result.errors.length} rows skipped</p>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-on-surface-variant space-y-1">
                {result.errors.slice(0, 10).map((e, i) => (
                  <p key={i}>Row {e.row}: {e.reason}</p>
                ))}
                {result.errors.length > 10 && <p>...and {result.errors.length - 10} more</p>}
              </div>
            </div>
          )}
          <button onClick={() => router.push('/admin/products')} className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl active:scale-95 transition-all">
            View Products
          </button>
        </div>
      )}
    </div>
  );
}
