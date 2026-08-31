/**
 * ============================================================
 * Goal Tracker Management System — Color Palette
 * ============================================================
 * Design system pass (redesign, not a rebuild): replaces the previous
 * generic "MUI blue" (#1976D2) palette with a deliberate enterprise
 * HR/performance-management palette.
 *
 * Rationale:
 * - Primary: deep indigo-slate ("#2C3E82"). Reads as trustworthy and
 *   corporate without being cold or generic-SaaS-blue. Distinct enough
 *   from default MUI blue that the app no longer looks like an
 *   out-of-the-box template.
 * - Secondary: warm amber ("#B7791F"), used sparingly for highlights/
 *   accents (e.g. "in progress" emphasis, secondary CTAs) — a
 *   professional counterpoint to the cool primary, not flashy.
 * - Semantic colors (success/warning/error/info) are deliberately a shade
 *   more muted than pure Material defaults so status chips and alerts
 *   feel considered rather than like unmodified MUI defaults.
 * - Neutral/grey scale is a slate-tinted scale (not pure grey) so it
 *   harmonizes with the indigo primary instead of clashing.
 * ============================================================
 */

const common = {
  black: "#000000",
  white: "#FFFFFF",
};

const primary = {
  lighter: "#E7EAF6",
  light: "#5B6FB8",
  main: "#2C3E82",
  dark: "#1F2C61",
  darker: "#141B3D",
  contrastText: "#FFFFFF",
};

const secondary = {
  lighter: "#FBF0DD",
  light: "#D6A756",
  main: "#B7791F",
  dark: "#8A5A15",
  darker: "#5E3D0E",
  contrastText: "#FFFFFF",
};

const success = {
  lighter: "#E6F4EC",
  light: "#5FAE7F",
  main: "#2F7D52",
  dark: "#1F5C3A",
  contrastText: "#FFFFFF",
};

const warning = {
  lighter: "#FBF1DE",
  light: "#D9A544",
  main: "#B8791A",
  dark: "#8C5A11",
  contrastText: "#FFFFFF",
};

const error = {
  lighter: "#FBE9E9",
  light: "#D97B7B",
  main: "#B3403F",
  dark: "#8A2C2B",
  contrastText: "#FFFFFF",
};

const info = {
  lighter: "#E5EEF7",
  light: "#5B94C4",
  main: "#2E6394",
  dark: "#1F4568",
  contrastText: "#FFFFFF",
};

// Slate-tinted neutral scale (harmonizes with the indigo primary instead
// of clashing like a pure/cool grey would).
const grey = {
  50: "#F7F8FA",
  100: "#EEF0F4",
  200: "#E2E5EC",
  300: "#CBD0DB",
  400: "#A6ACBC",
  500: "#7D8499",
  600: "#5C6377",
  700: "#454B5C",
  800: "#2E3242",
  900: "#1B1E29",
};

export const lightPalette = {
  mode: "light",
  common,
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  grey,

  background: {
    default: "#F4F5F9",
    paper: "#FFFFFF",
  },

  text: {
    primary: "#1B1E29",
    secondary: "#5C6377",
    disabled: "#A6ACBC",
  },

  divider: "#E2E5EC",

  action: {
    active: "#2C3E82",
    hover: "rgba(44,62,130,0.06)",
    selected: "rgba(44,62,130,0.12)",
    disabled: "#A6ACBC",
    disabledBackground: "#EEF0F4",
  },
};

export const darkPalette = {
  mode: "dark",
  common,
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  grey,

  background: {
    default: "#14171F",
    paper: "#1C202B",
  },

  text: {
    primary: "#F1F2F5",
    secondary: "#A6ACBC",
    disabled: "#5C6377",
  },

  divider: "#2E3242",

  action: {
    active: "#8493C9",
    hover: "rgba(255,255,255,0.06)",
    selected: "rgba(255,255,255,0.12)",
    disabled: "#5C6377",
    disabledBackground: "#2E3242",
  },
};

const palette = {
  light: lightPalette,
  dark: darkPalette,
};

export default palette;
