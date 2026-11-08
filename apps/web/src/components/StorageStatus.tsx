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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface px-4 py-3 text-xs text-muted ring-1 ring-line" data-testid="storage-status">
      <span>
        Storage on this device: <strong className={nearlyFull ? 'text-danger' : 'text-ink'}>{mb(h.usage)}</strong>
        {h.quota ? ` of ${mb(h.quota)} available` : ''}
      </span>
      {h.quota ? (
        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-subtle-strong" aria-hidden="true">
          <span className={`block h-full ${nearlyFull ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </span>
      ) : null}
      {h.persisted === true && <span className="text-ok">Protected from automatic clean-up</span>}
      {h.persisted === false && projectCount > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-warn">Your browser may clear this data. Export important projects as JSON.</span>
          <Button size="sm" variant="ghost" onClick={() => requestPersistence().then(refresh)}>
            Ask to Keep Data
          </Button>
        </span>
      )}
    </div>
  );
}
