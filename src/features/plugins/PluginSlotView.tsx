import type { PluginUiSlotName } from '@pulse/plugin-sdk';
import { usePluginStore } from '@/stores/pluginStore';

interface PluginSlotViewProps {
  readonly slot: PluginUiSlotName;
}

export function PluginSlotView({ slot }: PluginSlotViewProps) {
  const items = usePluginStore((s) => s.slotOutputs[slot]);

  if (items.length === 0) {
    return null;
  }

  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
      {items.map((item) => (
        <span
          key={`${item.pluginId}_${item.slot}`}
          className="pulse-mono-pill"
          data-tone={item.tone === 'accent' || item.tone === 'signal' ? item.tone : undefined}
          style={{ fontSize: '0.7rem', padding: '1px 7px' }}
        >
          {item.text}
        </span>
      ))}
    </span>
  );
}
