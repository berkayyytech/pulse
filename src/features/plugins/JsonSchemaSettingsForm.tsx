import type { PluginManifest } from '@pulse/plugin-sdk';

interface JsonSchemaSettingsFormProps {
  readonly schema: NonNullable<PluginManifest['settingsSchema']>;
  readonly values: Readonly<Record<string, unknown>>;
  readonly onChange: (key: string, nextValue: unknown) => void;
}

export function JsonSchemaSettingsForm({
  schema,
  values,
  onChange,
}: JsonSchemaSettingsFormProps) {
  const entries = Object.entries(schema.properties);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
      {entries.map(([key, prop]) => {
        const label = prop.title ?? key;
        const currentVal = values[key] ?? prop.default;

        if (prop.type === 'boolean') {
          return (
            <label
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: '0.88rem' }}>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(currentVal)}
                onChange={(e) => {
                  onChange(key, e.target.checked);
                }}
              />
            </label>
          );
        }

        if (prop.enum && prop.enum.length > 0) {
          return (
            <label
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: '0.88rem' }}>{label}</span>
              <select
                value={typeof currentVal === 'string' ? currentVal : (prop.enum[0] ?? '')}
                onChange={(e) => {
                  onChange(key, e.target.value);
                }}
                style={{
                  background: 'var(--pulse-color-bg-canvas)',
                  border: '1px solid var(--pulse-color-border-strong)',
                  borderRadius: 'var(--pulse-radius-sm)',
                  padding: '4px 8px',
                }}
              >
                {prop.enum.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (prop.type === 'number') {
          return (
            <label
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: '0.88rem' }}>{label}</span>
              <input
                type="number"
                min={prop.minimum}
                max={prop.maximum}
                value={typeof currentVal === 'number' ? currentVal : 0}
                onChange={(e) => {
                  onChange(key, Number(e.target.value));
                }}
                style={{
                  width: '100px',
                  padding: '4px 8px',
                  background: 'var(--pulse-color-bg-canvas)',
                  border: '1px solid var(--pulse-color-border-strong)',
                  borderRadius: 'var(--pulse-radius-sm)',
                }}
              />
            </label>
          );
        }

        return (
          <label
            key={key}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ fontSize: '0.88rem' }}>{label}</span>
            <input
              type="text"
              value={typeof currentVal === 'string' ? currentVal : ''}
              onChange={(e) => {
                onChange(key, e.target.value);
              }}
              style={{
                width: '160px',
                padding: '4px 8px',
                background: 'var(--pulse-color-bg-canvas)',
                border: '1px solid var(--pulse-color-border-strong)',
                borderRadius: 'var(--pulse-radius-sm)',
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
