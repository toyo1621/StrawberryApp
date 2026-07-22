export type AppTheme = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  input: string;
  focus: string;
  action: string;
  danger: string;
  dangerBackground: string;
  success: string;
  successBackground: string;
  info: string;
  infoBackground: string;
};

export const LIGHT_THEME: AppTheme = {
  background: '#fff1f5',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  text: '#172033',
  textMuted: '#475569',
  border: '#cbd5e1',
  input: '#ffffff',
  focus: '#be185d',
  action: '#be185d',
  danger: '#9f1239',
  dangerBackground: '#fff1f2',
  success: '#166534',
  successBackground: '#f0fdf4',
  info: '#1e40af',
  infoBackground: '#eff6ff',
};

export const DARK_THEME: AppTheme = {
  background: '#151923',
  surface: '#222837',
  surfaceMuted: '#2d3547',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  border: '#64748b',
  input: '#151923',
  focus: '#f472b6',
  action: '#be185d',
  danger: '#fecdd3',
  dangerBackground: '#4c1d2a',
  success: '#bbf7d0',
  successBackground: '#173c2a',
  info: '#bfdbfe',
  infoBackground: '#172554',
};

export const getTheme = (darkMode: boolean): AppTheme => darkMode ? DARK_THEME : LIGHT_THEME;
