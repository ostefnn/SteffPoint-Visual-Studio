import { Icon } from './ui';

import { t } from '../i18n';

/** Makes the local-first guarantee visible at all times. */
export function PrivacyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-medium text-ok ring-1 ring-ok-line"
      title={t('Images, projects and exports are processed and stored in this browser only. Nothing is uploaded.')}
    >
      <Icon name="lock" className="size-3.5" />{' '}{t('Nothing leaves this device')}
    </span>
  );
}
