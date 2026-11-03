import { getSettingWithDefault } from '@screenly/edge-apps'

export const MODES = ['headlines', 'list'] as const

export type NewsMode = (typeof MODES)[number]

export const DEFAULT_MODE: NewsMode = 'headlines'

// Settings are free text at the API level, so an instance can hold a value
// this build has never heard of
export function resolveMode(value: string | undefined): NewsMode {
  const normalized = value?.trim().toLowerCase() as NewsMode
  return MODES.includes(normalized) ? normalized : DEFAULT_MODE
}

export function getNewsMode(): NewsMode {
  return resolveMode(getSettingWithDefault<string>('mode', DEFAULT_MODE))
}
