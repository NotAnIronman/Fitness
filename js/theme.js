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
    text: '#1E1B16', textDim: '#70695E', accent: '#A94224', accent2: '#2F6E5E',
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
    text: '#3A2A1E', textDim: '#79614E', accent: '#91451D', accent2: '#356B4F',
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
    text: '#4A2E2A', textDim: '#765A55', accent: '#A33D4A', accent2: '#8A651D',
    radius: 16, font: 'serif',
  },
  orchid: {
    label: 'Orchid',
    bg: '#F8F5FB', surface: '#FFFFFF', surface2: '#EDE3F5', border: '#DCC8EA',
    text: '#3A2B47', textDim: '#715F80', accent: '#7040A5', accent2: '#9B4E8E',
    radius: 16, font: 'serif',
  },
  peony: {
    label: 'Peony Garden',
    bg: '#FFF6F8', surface: '#FFFFFF', surface2: '#FBE3EA', border: '#F3C9D6',
    text: '#4A2438', textDim: '#795469', accent: '#AC2E60', accent2: '#4E7765',
    radius: 20, font: 'rounded',
  },
  blushgold: {
    label: 'Blush & Gold',
    bg: '#FBF8F3', surface: '#FFFFFF', surface2: '#F3E7D8', border: '#E8D5B8',
    text: '#3D3226', textDim: '#705F49', accent: '#7D570B', accent2: '#9D4F5A',
    radius: 12, font: 'serif',
  },
};

const FONT_STACKS = {
  condensed: { display: "'Oswald', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  serif:     { display: "'Fraunces', serif",     body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  mono:      { display: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace", mono: "'JetBrains Mono', monospace" },
  rounded:   { display: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  grotesk:   { display: "'Space Grotesk', sans-serif", body: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace" },
  classic_serif: { display: "'Playfair Display', serif", body: "'Lora', serif", mono: "'JetBrains Mono', monospace" },
  elegant_script: { display: "'Cormorant Garamond', serif", body: "'Lora', serif", mono: "'JetBrains Mono', monospace" },
  friendly_round: { display: "'Quicksand', sans-serif", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  bold_display: { display: "'Bebas Neue', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  clean_system: { display: "'Work Sans', sans-serif", body: "'Work Sans', sans-serif", mono: "'JetBrains Mono', monospace" },
  editorial: { display: "'Libre Baskerville', serif", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  playful: { display: "'Baloo 2', sans-serif", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  whimsical: { display: "'Macondo', cursive", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  storybook: { display: "'Leckerli One', cursive", body: "'Quicksand', sans-serif", mono: "'JetBrains Mono', monospace" },
  bubbly: { display: "'Pacifico', cursive", body: "'Comfortaa', sans-serif", mono: "'JetBrains Mono', monospace" },
  handwritten: { display: "'Dancing Script', cursive", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  cozy_note: { display: "'Caveat', cursive", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
  soft_rounded: { display: "'Comfortaa', sans-serif", body: "'Comfortaa', sans-serif", mono: "'JetBrains Mono', monospace" },
  cheerful: { display: "'Fredoka', sans-serif", body: "'Nunito', sans-serif", mono: "'JetBrains Mono', monospace" },
  candy: { display: "'Chewy', cursive", body: "'Quicksand', sans-serif", mono: "'JetBrains Mono', monospace" },
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
  root.setProperty('--accent-ink', themeContrastRatio('#05100E', theme.accent) >= themeContrastRatio('#FFFFFF', theme.accent) ? '#05100E' : '#FFFFFF');
  root.setProperty('--radius', (theme.radius ?? 10) + 'px');
  const fonts = FONT_STACKS[theme.font] || FONT_STACKS.condensed;
  root.setProperty('--font-display', fonts.display);
  root.setProperty('--font-body', fonts.body);
  root.setProperty('--font-mono', fonts.mono);

  // Native form controls (the date-picker calendar icon, number spinners, etc)
  // render using whichever of light/dark best matches color-scheme, which
  // defaults to following the OS setting, not this app's own theme. That's
  // what made the calendar icon blend into the background on a dark theme
  // paired with a light OS setting (or vice versa). Deciding it from the
  // theme's actual background luminance keeps native controls visible
  // regardless of what the OS happens to be set to.
  root.setProperty('color-scheme', themeLuminance(theme.bg) < 0.5 ? 'dark' : 'light');
}

// WCAG relative luminance from an RGB hex color. It supports both native
// light/dark control selection and the theme contrast checks below.
function themeLuminance(hex) {
  const clean = (hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const linear = value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(parseInt(full.substring(0, 2), 16));
  const g = linear(parseInt(full.substring(2, 4), 16));
  const b = linear(parseInt(full.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function themeContrastRatio(colorA, colorB) {
  const a = themeLuminance(colorA), b = themeLuminance(colorB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function getThemeAccessibilityIssues(theme) {
  const checks = [
    ['Main text on cards', theme.text, theme.surface],
    ['Muted text on cards', theme.textDim, theme.surface],
    ['Accent links on the page', theme.accent, theme.bg],
  ];
  return checks.filter(([, foreground, background]) => themeContrastRatio(foreground, background) < 4.5)
    .map(([label, foreground, background]) => `${label}: ${themeContrastRatio(foreground, background).toFixed(1)}:1`);
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
