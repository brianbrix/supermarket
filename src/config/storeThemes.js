export const STORE_THEMES = {
  'fresh-emerald': {
    label: 'Fresh Emerald',
    mode: 'light',
    palette: {
      accent: '#0f6c3f',
      accentAlt: '#0c5a34',
      accentContrast: '#ffffff',
      accentSoft: '#e6f6ee',
      accentMuted: '#3e6c55'
    },
    productCard: {
      background: 'linear-gradient(145deg, #f9fef9 0%, #eef8f1 100%)',
      border: '1px solid rgba(15, 108, 63, 0.08)',
      shadow: '0 24px 48px -30px rgba(15, 108, 63, 0.25)',
      shadowHover: '0 28px 54px -30px rgba(12, 90, 54, 0.28)'
    },
    page: {
      surface: '#f6faf7',
      surfaceElevated: '#f0f6f1'
    },
    sectionDefaults: {
      hero: 'classic-fresh',
      category: 'fresh-canopy',
      carousel: 'glass-emerald',
      richText: 'calm-paper'
    }
  },
  'sunset-harvest': {
    label: 'Sunset Harvest',
    mode: 'light',
    palette: {
      accent: '#c2551d',
      accentAlt: '#a94516',
      accentContrast: '#fff6f2',
      accentSoft: '#fff1e7',
      accentMuted: '#8c4c33'
    },
    productCard: {
      background: 'linear-gradient(145deg, #fff6ef 0%, #ffe6d6 100%)',
      border: '1px solid rgba(194, 85, 29, 0.12)',
      shadow: '0 24px 48px -30px rgba(194, 85, 29, 0.28)',
      shadowHover: '0 28px 56px -32px rgba(161, 62, 21, 0.32)'
    },
    page: {
      surface: '#fff8f1',
      surfaceElevated: '#ffeede'
    },
    sectionDefaults: {
      hero: 'sunrise-citrus',
      category: 'sunset-horizon',
      carousel: 'sunset-candy',
      richText: 'sunset-quartz'
    }
  },
  'midnight-indigo': {
    label: 'Midnight Indigo',
    mode: 'dark',
    palette: {
      accent: '#4f72ff',
      accentAlt: '#6d87ff',
      accentContrast: '#f3f5ff',
      accentSoft: '#1c243f',
      accentMuted: '#a5b5ff'
    },
    productCard: {
      background: 'linear-gradient(145deg, rgba(24, 29, 48, 0.92) 0%, rgba(32, 38, 62, 0.94) 100%)',
      border: '1px solid rgba(119, 146, 255, 0.16)',
      shadow: '0 26px 60px -34px rgba(2, 7, 22, 0.75)',
      shadowHover: '0 32px 68px -34px rgba(4, 12, 34, 0.78)'
    },
    page: {
      surface: '#0f131f',
      surfaceElevated: '#141b2b'
    },
    sectionDefaults: {
      hero: 'midnight-bloom',
      category: 'midnight-velvet',
      carousel: 'midnight-luxe',
      richText: 'nocturne'
    }
  }
};

export const STORE_THEME_KEYS = Object.keys(STORE_THEMES);

export const DEFAULT_STORE_THEME = 'fresh-emerald';

export function normalizeStoreTheme(value) {
  if (!value) return DEFAULT_STORE_THEME;
  const key = String(value).toLowerCase();
  if (STORE_THEMES[key]) {
    return key;
  }
  if (key === 'light') return 'fresh-emerald';
  if (key === 'dark') return 'midnight-indigo';
  return DEFAULT_STORE_THEME;
}
