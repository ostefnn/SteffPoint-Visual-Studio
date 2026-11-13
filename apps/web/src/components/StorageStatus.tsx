import { useEffect, useState } from 'react';
import { getStorageHealth, persistenceRefused, requestPersistence, type StorageHealth } from '../lib/db';
import { Button } from './ui';

import { t } from '../i18n';

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
        {t('Storage on this device:')} <strong className={nearlyFull ? 'text-danger' : 'text-ink'}>{mb(h.usage)}</strong>
        {h.quota ? ` ${t('of {size} available', { size: mb(h.quota) })}` : ''}
      </span>
      {h.quota ? (
        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-subtle-strong" aria-hidden="true">
          <span className={`block h-full ${nearlyFull ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </span>
      ) : null}
      {h.persisted === true && <span className="text-ok">{t('Protected from automatic clean-up')}</span>}
      {h.persisted === false && projectCount > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          {/* A warning only once the browser has actually refused; before that, a plain offer. */}
          {persistenceRefused() ? (
            <span className="text-warn">{t('Your browser may clear this data. Export important projects as JSON.')}</span>
          ) : (
            <span>{t('Your projects are kept in this browser.')}</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => requestPersistence().then(refresh)}>
            {t('Ask to Keep Data')}
          </Button>
        </span>
      )}
    </div>
  );
}
