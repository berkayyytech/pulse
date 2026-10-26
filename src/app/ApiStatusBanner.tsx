import { AlertTriangle, X } from 'lucide-react';
import { t } from '@/i18n';
import { useCapabilityStore } from '@/stores/capabilityStore';

export function ApiStatusBanner() {
  const alerts = useCapabilityStore((s) => s.alerts);
  const dismissAlert = useCapabilityStore((s) => s.dismissAlert);

  const visibleAlert = alerts.find((a) => !a.dismissed);
  if (!visibleAlert) {
    return null;
  }

  return (
    <div className="pulse-banner" role="status" aria-live="polite">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={16} aria-hidden="true" />
        <strong>{t('status.apiChangeDetected')}</strong> {visibleAlert.message}
      </span>
      <button
        type="button"
        onClick={() => {
          dismissAlert(visibleAlert.id);
        }}
        aria-label={t('status.dismiss')}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
