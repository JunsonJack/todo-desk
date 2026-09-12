const STORAGE_KEY = 'todo-desk-settings';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  defaultPriority: 'medium',
  defaultStatus: 'todo',
  wallpaper: 'default',
  wallpaperImage: '',
  wallpaperOpacity: 0.55,
  sidebarCollapsed: false,
};

export const WALLPAPER_PRESETS = [
  { id: 'default', label: '默认', desc: '跟随主题背景' },
  { id: 'dusk', label: '暮色', desc: '紫蓝晚霞渐变' },
  { id: 'ocean', label: '深海', desc: '海蓝静谧' },
  { id: 'forest', label: '林间', desc: '青绿自然' },
  { id: 'aurora', label: '极光', desc: '青紫极光' },
];

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    // custom wallpaper data URL may exceed quota
    if (next.wallpaper === 'custom') {
      const slim = {
        ...next,
        wallpaper: 'default',
        wallpaperImage: '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      throw new Error('背景图片过大，已回退为默认背景。请改用更小的图片。');
    }
    throw err;
  }
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

export function applyWallpaper(settings) {
  const wallpaper = settings?.wallpaper || 'default';
  const opacity = settings?.wallpaperOpacity ?? 0.55;
  const root = document.documentElement;
  root.setAttribute('data-wallpaper', wallpaper);
  root.style.setProperty('--wallpaper-opacity', String(opacity));
  if (wallpaper === 'custom' && settings?.wallpaperImage) {
    root.style.setProperty('--wallpaper-image', `url("${settings.wallpaperImage}")`);
  } else {
    root.style.removeProperty('--wallpaper-image');
  }
}
