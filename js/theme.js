/* ============================================================
   THEME SYSTEM
   ============================================================ */

const THEME_PRESETS = {
  forge: {
    label: 'Forge (default)',
    bg: '#0B0F14', surface: '#141B22', surface2: '#1B242D', border: '#26323C',
    text: '#E7EEF3', textDim: '#8FA1AC', accent: '#5EEAD4', accent2: '#F97316',
    radius: 10, font: 'condensed',
  },
  daylight: {
    label: 'Daylight',
    bg: '#F7F5F0', surface: '#FFFFFF', surface2: '#F0EDE5', border: '#DEDAD0',
    text: '#1E1B16', textDim: '#7A7468', accent: '#C1502E', accent2: '#2F6E5E',
    radius: 8, font: 'serif',
  },
  neon: {
    label: 'Neon Grid',
    bg: '#08060F', surface: '#120E20', surface2: '#1B1533', border: '#2E2650',
    text: '#F1EEFF', textDim: '#9C93C2', accent: '#B6FF3C', accent2: '#FF3CAC',
    radius: 4, font: 'mono',
  },
  clay: {
    label: 'Clay Court',
    bg: '#FBF3EC', surface: '#FFFFFF', surface2: '#F2E3D5', border: '#E4CDB6',
    text: '#3A2A1E', textDim: '#8A7461', accent: '#B5622C', accent2: '#3E7A5B',
    radius: 14, font: 'rounded',
  },
  mono: {
    label: 'Monochrome',
    bg: '#101010', surface: '#181818', surface2: '#212121', border: '#333333',
    text: '#F2F2F2', textDim: '#9A9A9A', accent: '#FFFFFF', accent2: '#8F8F8F',
    radius: 2, font: 'grotesk',
  },
  ocean: {
    label: 'Deep Ocean',
    bg: '#071620', surface: '#0E2433', surface2: '#153044', border: '#1F415A',
    text: '#E4F3FA', textDim: '#7FAAC0', accent: '#38BDF8', accent2: '#FBBF24',
    radius: 10, font: 'grotesk',
  },
  rosewater: {
    label: 'Rosewater',
    bg: '#FDF4F2', surface: '#FFFFFF', surface2: '#FBE8E4', border: '#F2D2CB',
    text: '#4A2E2A', textDim: '#9C7A73', accent: '#E0796B', accent2: '#C9A15C',
    radius: 16, font: 'serif',
  },
  orchid: {
    label: 'Orchid',
    bg: '#F8F5FB', surface: '#FFFFFF', surface2: '#EDE3F5', border: '#DCC8EA',
    text: '#3A2B47', textDim: '#8B7A9B', accent: '#9B5DE0', accent2: '#E0A6D8',
    radius: 16, font: 'serif',
  },
  peony: {
    label: 'Peony Garden',
    bg: '#FFF6F8', surface: '#FFFFFF', surface2: '#FBE3EA', border: '#F3C9D6',
    text: '#4A2438', textDim: '#9C6E85', accent: '#EC5C88', accent2: '#7FA894',
    radius: 20, font: 'rounded',
  },
  blushgold: {
    label: 'Blush & Gold',
    bg: '#FBF8F3', surface: '#FFFFFF', surface2: '#F3E7D8', border: '#E8D5B8',
    text: '#3D3226', textDim: '#93826B', accent: '#D4A24C', accent2: '#E8A2A8',
    radius: 12, font: 'serif',
  },
};

const FONT_STACKS = {
  condensed: { display: "'Oswald', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  serif:     { display: "'Fraunces', serif",     body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  mono:      { display: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace", mono: "'JetBrains Mono', monospace" },
  rounded:   { display: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  grotesk:   { display: "'Space Grotesk', sans-serif", body: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace" },
};

function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--bg', theme.bg);
  root.setProperty('--surface', theme.surface);
  root.setProperty('--surface-2', theme.surface2 || theme.surface);
  root.setProperty('--border', theme.border);
  root.setProperty('--text', theme.text);
  root.setProperty('--text-dim', theme.textDim);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-2', theme.accent2);
  root.setProperty('--radius', (theme.radius ?? 10) + 'px');
  const fonts = FONT_STACKS[theme.font] || FONT_STACKS.condensed;
  root.setProperty('--font-display', fonts.display);
  root.setProperty('--font-body', fonts.body);
  root.setProperty('--font-mono', fonts.mono);
}

// Build a full theme object (for state.theme) from a preset key
function themeFromPreset(key) {
  const p = THEME_PRESETS[key] || THEME_PRESETS.forge;
  return {
    preset: key,
    bg: p.bg, surface: p.surface, surface2: p.surface2, border: p.border,
    text: p.text, textDim: p.textDim, accent: p.accent, accent2: p.accent2,
    radius: p.radius, font: p.font,
  };
}
