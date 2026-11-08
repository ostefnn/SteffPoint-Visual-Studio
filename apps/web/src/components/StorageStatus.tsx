import { useEffect, useState } from 'react';
import { getStorageHealth, requestPersistence, type StorageHealth } from '../lib/db';
import { Button } from './ui';

const mb = (n?: number) => (n === undefined ? '?' : n < 1024 * 1024 * 1024 ? `${Math.round(n / 1024 / 1024)} MB` : `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`);

/**
 * Shows how much browser storage is used and whether it is protected from eviction.
 * Browsers may clear non-persistent site data (e.g. after a period without visits),
 * so we nudge users toward persistence and JSON backups.
 */
export function StorageStatus({ projectCount }: { projectCount: number }) {
  const [h, setH] = useState<StorageHealth>({});
  const refresh = () => getStorageHealth().then(setH);
  useEffect(() => {
    refresh();
  }, [projectCount]);

  const ratio = h.usage !== undefined && h.quota ? h.usage / h.quota : 0;
  const nearlyFull = ratio > 0.8;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white px-4 py-3 text-xs text-zinc-600 ring-1 ring-zinc-200" data-testid="storage-status">
      <span>
        Storage on this device: <strong className={nearlyFull ? 'text-red-600' : 'text-zinc-900'}>{mb(h.usage)}</strong>
        {h.quota ? ` of ${mb(h.quota)} available` : ''}
      </span>
      {h.quota ? (
        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
          <span className={`block h-full ${nearlyFull ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </span>
      ) : null}
      {h.persisted === true && <span className="text-emerald-700">Protected from automatic clean-up</span>}
      {h.persisted === false && projectCount > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-amber-700">Your browser may clear this data. Export important projects as JSON.</span>
          <Button size="sm" variant="ghost" onClick={() => requestPersistence().then(refresh)}>
            Ask to keep data
          </Button>
        </span>
      )}
    </div>
  );
}
