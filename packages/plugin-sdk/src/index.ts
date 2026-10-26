import { z } from 'zod';

export const PULSE_PLUGIN_SDK_VERSION = '1.0' as const;

export const PluginPermissionSchema = z.union([
  z.literal('read:player'),
  z.literal('control:playback'),
  z.literal('read:library'),
  z.literal('write:playlists'),
  z.literal('ui:slot'),
  z.literal('ui:command'),
  z.string().regex(/^network:[a-z0-9.-]+\.[a-z]{2,}$/i, 'Invalid network:<hostname> permission'),
]);

export type PluginPermission = z.infer<typeof PluginPermissionSchema>;

export interface JsonSchemaProperty {
  readonly type: 'boolean' | 'string' | 'number';
  readonly title?: string;
  readonly description?: string;
  readonly default?: boolean | string | number;
  readonly enum?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface PluginJsonSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
}

export const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,63}$/),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i),
  sdkVersion: z.literal(PULSE_PLUGIN_SDK_VERSION),
  author: z.string().min(1).max(80),
  description: z.string().max(280),
  entry: z.string().min(1),
  permissions: z.array(PluginPermissionSchema).default([]),
  settingsSchema: z
    .object({
      type: z.literal('object'),
      properties: z.record(
        z.string(),
        z.object({
          type: z.enum(['boolean', 'string', 'number']),
          title: z.string().optional(),
          description: z.string().optional(),
          default: z.union([z.boolean(), z.string(), z.number()]).optional(),
          enum: z.array(z.string()).optional(),
          minimum: z.number().optional(),
          maximum: z.number().optional(),
        }),
      ),
    })
    .optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export type PluginUiSlotName = 'now-playing-badge' | 'sidebar-footer';

export interface PluginSlotPayload {
  readonly slot: PluginUiSlotName;
  readonly text: string;
  readonly tone?: 'neutral' | 'accent' | 'signal';
}

export interface PluginCommandDescriptor {
  readonly commandId: string;
  readonly title: string;
}

export interface PluginPlayerSnapshot {
  readonly isPlaying: boolean;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly track: {
    readonly id: string | null;
    readonly uri: string;
    readonly name: string;
    readonly artistNames: readonly string[];
    readonly albumName: string;
  } | null;
}

export type PluginRpcRequest =
  | { readonly id: string; readonly method: 'player.getState' }
  | { readonly id: string; readonly method: 'player.togglePlay' }
  | { readonly id: string; readonly method: 'player.next' }
  | { readonly id: string; readonly method: 'player.previous' }
  | { readonly id: string; readonly method: 'library.getSavedCount' }
  | { readonly id: string; readonly method: 'settings.get'; readonly key: string }
  | { readonly id: string; readonly method: 'ui.renderSlot'; readonly payload: PluginSlotPayload }
  | {
      readonly id: string;
      readonly method: 'ui.registerCommand';
      readonly command: PluginCommandDescriptor;
    }
  | {
      readonly id: string;
      readonly method: 'network.fetchJson';
      readonly url: string;
    };

export type PluginRpcResponse =
  | { readonly id: string; readonly ok: true; readonly result: unknown }
  | { readonly id: string; readonly ok: false; readonly error: string };

export type HostToPluginEvent =
  | { readonly event: 'player.changed'; readonly snapshot: PluginPlayerSnapshot }
  | {
      readonly event: 'settings.changed';
      readonly settings: Readonly<Record<string, unknown>>;
    }
  | { readonly event: 'command.invoked'; readonly commandId: string };

export interface PulsePluginContext {
  readonly sdkVersion: typeof PULSE_PLUGIN_SDK_VERSION;
  onPlayerChange(listener: (snapshot: PluginPlayerSnapshot) => void): () => void;
  getSetting<T = unknown>(key: string): Promise<T | undefined>;
  renderSlot(payload: PluginSlotPayload): Promise<void>;
  registerCommand(commandId: string, title: string, handler: () => void): Promise<void>;
}

export interface PulsePluginDefinition {
  readonly manifest: PluginManifest;
  activate(ctx: PulsePluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export function definePlugin(definition: PulsePluginDefinition): PulsePluginDefinition {
  PluginManifestSchema.parse(definition.manifest);
  return definition;
}
