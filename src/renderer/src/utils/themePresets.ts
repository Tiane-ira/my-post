export type ThemeType = 'dark' | 'light';

export type ThemePresetId =
  | 'default-dark'
  | 'default-light'
  | 'cyber-teal'
  | 'midnight-purple'
  | 'sunset-amber';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgSidebar: string;
  bgRail: string;
  bgHover: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  statusSuccess: string;
  statusWarning: string;
  statusInfo: string;
  statusError: string;
  statusPurple: string;
  statusTeal: string;
  scrollbarThumb: string;
  scrollbarHover: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  subtitle: string;
  type: ThemeType;
  accentColor: string;
  previewColors: {
    canvas: string;
    surface: string;
    border: string;
    accent: string;
    text: string;
  };
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default-dark',
    name: '深邃暗黑',
    subtitle: 'Obsidian Slate · 经典黑曜暗调与暖橙点缀',
    type: 'dark',
    accentColor: '#fa8c16',
    previewColors: {
      canvas: '#121212',
      surface: '#181818',
      border: '#323235',
      accent: '#fa8c16',
      text: '#ededed',
    },
    colors: {
      bgPrimary: '#121212',
      bgSecondary: '#1c1c1e',
      bgCard: '#181818',
      bgSidebar: '#1c1c1e',
      bgRail: '#262628',
      bgHover: '#303033',
      borderColor: '#323235',
      textPrimary: '#ededed',
      textSecondary: '#b8b8bb',
      textMuted: '#929297',
      accent: '#fa8c16',
      accentHover: '#ffa333',
      statusSuccess: '#42cba4',
      statusWarning: '#efb759',
      statusInfo: '#78a4f5',
      statusError: '#fb7c85',
      statusPurple: '#bb9af5',
      statusTeal: '#62cdd0',
      scrollbarThumb: '#3e3e42',
      scrollbarHover: '#55555c',
    },
  },
  {
    id: 'default-light',
    name: '素雅明白',
    subtitle: 'Clean Ivory · 纯净通透高对比浅色视觉',
    type: 'light',
    accentColor: '#fa8c16',
    previewColors: {
      canvas: '#ffffff',
      surface: '#ffffff',
      border: '#e6e7e8',
      accent: '#fa8c16',
      text: '#333639',
    },
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f6f8fa',
      bgCard: '#ffffff',
      bgSidebar: '#f9fafb',
      bgRail: '#f1f3f6',
      bgHover: '#eef1f4',
      borderColor: '#e6e7e8',
      textPrimary: '#333639',
      textSecondary: '#66686a',
      textMuted: '#85878a',
      accent: '#fa8c16',
      accentHover: '#e77908',
      statusSuccess: '#168767',
      statusWarning: '#ad650b',
      statusInfo: '#3768c9',
      statusError: '#d83b40',
      statusPurple: '#7958d6',
      statusTeal: '#16858b',
      scrollbarThumb: '#dcdfe2',
      scrollbarHover: '#c4c8ce',
    },
  },
  {
    id: 'cyber-teal',
    name: '赛博青翠',
    subtitle: 'Cyber Emerald · 黑曜青蓝底色与霓虹青翠',
    type: 'dark',
    accentColor: '#06b6d4',
    previewColors: {
      canvas: '#0d1518',
      surface: '#111b20',
      border: '#243b45',
      accent: '#06b6d4',
      text: '#e2f3f5',
    },
    colors: {
      bgPrimary: '#0d1518',
      bgSecondary: '#142025',
      bgCard: '#111b20',
      bgSidebar: '#131f24',
      bgRail: '#1a2b32',
      bgHover: '#20363f',
      borderColor: '#243b45',
      textPrimary: '#e2f3f5',
      textSecondary: '#8cbac0',
      textMuted: '#61858b',
      accent: '#06b6d4',
      accentHover: '#22d3ee',
      statusSuccess: '#10b981',
      statusWarning: '#f59e0b',
      statusInfo: '#38bdf8',
      statusError: '#f43f5e',
      statusPurple: '#a855f7',
      statusTeal: '#14b8a6',
      scrollbarThumb: '#2a4550',
      scrollbarHover: '#395c6b',
    },
  },
  {
    id: 'midnight-purple',
    name: '夜魅极光',
    subtitle: 'Midnight Aurora · 幽邃紫黑与幻彩罗兰荧光',
    type: 'dark',
    accentColor: '#8b5cf6',
    previewColors: {
      canvas: '#12111c',
      surface: '#171524',
      border: '#353051',
      accent: '#8b5cf6',
      text: '#f0eeff',
    },
    colors: {
      bgPrimary: '#12111c',
      bgSecondary: '#1b1929',
      bgCard: '#171524',
      bgSidebar: '#1a1827',
      bgRail: '#252238',
      bgHover: '#312c4b',
      borderColor: '#353051',
      textPrimary: '#f0eeff',
      textSecondary: '#b3aed0',
      textMuted: '#827c9f',
      accent: '#8b5cf6',
      accentHover: '#a78bfa',
      statusSuccess: '#34d399',
      statusWarning: '#fbbf24',
      statusInfo: '#60a5fa',
      statusError: '#f87171',
      statusPurple: '#c084fc',
      statusTeal: '#2dd4bf',
      scrollbarThumb: '#3c365f',
      scrollbarHover: '#514981',
    },
  },
  {
    id: 'sunset-amber',
    name: '日落暖阳',
    subtitle: 'Sunset Glow · 温润石墨灰调与金黄落日余晖',
    type: 'dark',
    accentColor: '#f59e0b',
    previewColors: {
      canvas: '#181614',
      surface: '#1e1b17',
      border: '#413a30',
      accent: '#f59e0b',
      text: '#f6f1ea',
    },
    colors: {
      bgPrimary: '#181614',
      bgSecondary: '#24201c',
      bgCard: '#1e1b17',
      bgSidebar: '#221f1a',
      bgRail: '#2d2822',
      bgHover: '#3d372e',
      borderColor: '#413a30',
      textPrimary: '#f6f1ea',
      textSecondary: '#c2b8ab',
      textMuted: '#938a7d',
      accent: '#f59e0b',
      accentHover: '#fbbf24',
      statusSuccess: '#10b981',
      statusWarning: '#f59e0b',
      statusInfo: '#38bdf8',
      statusError: '#ef4444',
      statusPurple: '#a855f7',
      statusTeal: '#14b8a6',
      scrollbarThumb: '#4d453a',
      scrollbarHover: '#63584a',
    },
  },
];

export const DEFAULT_THEME_ID: ThemePresetId = 'default-light';
export const DEFAULT_DARK_THEME_ID: ThemePresetId = 'default-dark';

export function getThemePreset(id: string): ThemePreset {
  const found = THEME_PRESETS.find((p) => p.id === id);
  return found || THEME_PRESETS[0];
}
