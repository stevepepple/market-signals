import { useRef, useState } from "react";
import type { DipHolding } from "../../types/dip";
import { parseRobinhoodCSV, mergeImportedHoldings } from "../../lib/csvImport";

interface CsvImportButtonProps {
  existing: DipHolding[];
  onImport: (merged: DipHolding[]) => void;
}

export default function CsvImportButton({ existing, onImport }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{
    merged: DipHolding[];
    newCount: number;
    updatedCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const imported = parseRobinhoodCSV(text);
        if (imported.length === 0) {
          setError("No holdings found in CSV. Check that it's a Robinhood transaction history export.");
          return;
        }
        const result = mergeImportedHoldings(existing, imported);
        setPreview(result);
      } catch {
        setError("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleConfirm() {
    if (!preview) return;
    onImport(preview.merged);
    setPreview(null);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1.5 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Import CSV
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Import Summary</h3>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <p>Found <span className="font-medium">{preview.newCount + preview.updatedCount}</span> holdings in CSV</p>
              {preview.newCount > 0 && <p className="text-green-600 dark:text-green-400">+ {preview.newCount} new</p>}
              {preview.updatedCount > 0 && <p className="text-blue-600 dark:text-blue-400">~ {preview.updatedCount} updated (shares & avg cost)</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPreview(null)}
                className="px-3 py-1.5 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
