import { createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import palette from "./palette";

/**
 * ============================================================
 * Goal Tracker Management System — Material UI Theme
 * ============================================================
 * Design-system pass. Was previously built but never actually applied
 * anywhere (no ThemeProvider existed in the app) — that's the real reason
 * the UI still looked like unmodified MUI defaults. Fixed in main.jsx.
 *
 * Spacing: MUI's `spacing: 8` means every theme.spacing(n) call already
 * multiplies by 8px, so most of this file just needs to actually be used
 * consistently by components (sx={{ p: 2 }} = 16px, sx={{ p: 3 }} = 24px,
 * etc.) instead of components hardcoding arbitrary px/rem values.
 * ============================================================
 */

const getTheme = (mode = "light") => {
  const selectedPalette = mode === "dark" ? palette.dark : palette.light;

  return createTheme({
    palette: selectedPalette,

    spacing: 8,

    shape: {
      borderRadius: 10,
    },

    typography: {
      fontFamily: [
        "Inter",
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ].join(","),

      h1: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.25 },
      h2: { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.28 },
      h3: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.35 },
      h5: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 },

      subtitle1: { fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.5 },
      subtitle2: { fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.5 },

      body1: { fontSize: "0.95rem", lineHeight: 1.6 },
      body2: { fontSize: "0.875rem", lineHeight: 1.6 },

      // Explicit label/caption scale so components stop reaching for
      // ad-hoc fontSize values for small text (table meta, timestamps,
      // helper text under inputs, chip labels, etc).
      caption: { fontSize: "0.75rem", lineHeight: 1.5, color: selectedPalette.text.secondary },
      overline: {
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: selectedPalette.text.secondary,
      },

      button: {
        fontWeight: 600,
        textTransform: "none",
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            margin: 0,
            padding: 0,
            backgroundColor: selectedPalette.background.default,
          },
          "*": { boxSizing: "border-box" },
          a: { textDecoration: "none", color: "inherit" },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: { boxShadow: "none" },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: { borderRight: `1px solid ${selectedPalette.divider}` },
        },
      },

      // One consistent card language app-wide: flat (no shadow), thin
      // border, 12px radius. Previously different pages used different
      // ad-hoc shadow/radius combinations.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${selectedPalette.divider}`,
            backgroundImage: "none",
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { borderRadius: 10, backgroundImage: "none" },
          elevation1: {
            boxShadow: "0 1px 3px rgba(20,23,31,0.06), 0 1px 2px rgba(20,23,31,0.04)",
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true, variant: "contained" },
        styleOverrides: {
          root: { borderRadius: 8, padding: "8px 18px", fontWeight: 600 },
          sizeSmall: { padding: "6px 14px" },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },

      MuiTextField: {
        defaultProps: { fullWidth: true, size: "small" },
      },

      MuiTableHead: {
        styleOverrides: {
          root: { backgroundColor: selectedPalette.grey[50] },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: "0.8rem",
            color: selectedPalette.text.secondary,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
      },

      // Consistent stepper look for the goal-workflow status indicator.
      MuiStepIcon: {
        styleOverrides: {
          root: {
            color: selectedPalette.grey[300],
            "&.Mui-active": { color: selectedPalette.primary.main },
            "&.Mui-completed": { color: selectedPalette.success.main },
          },
        },
      },
      MuiStepConnector: {
        styleOverrides: {
          line: { borderColor: selectedPalette.divider },
        },
      },

      // Consistent toast/alert style for error/success/warning/info states
      // across forms and API failures instead of raw error objects.
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, fontSize: "0.875rem" },
        },
      },

      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: selectedPalette.grey[100] },
        },
      },
    },
  });
};

export { CssBaseline };

export default getTheme;
