const STORAGE_KEY = 'todo-desk-settings';

export const DEFAULT_SETTINGS = {
  theme: 'system', // dark | light | system
  defaultPriority: 'medium',
  defaultStatus: 'todo',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resolveTheme(theme) {
  if (theme === 'dark' || theme === 'light') return theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
