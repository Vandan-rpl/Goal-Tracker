import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Redux Imports
import { Provider } from 'react-redux';
import store from './redux/store';

// Design system: theme.js/palette.js existed before but were never
// actually applied anywhere in the app (no ThemeProvider) — every
// screen was rendering with unmodified MUI defaults regardless of what
// the theme file said. Wiring it up here is what actually makes the
// redesign (Part B) take effect.
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Brand color only: MUI's default blue primary (#1976d2) becomes the
// Rubamin navy, so every color="primary" button, link, focus ring,
// switch, tab indicator, etc. matches. Nothing else in MUI changes.
const brandTheme = createTheme({
  palette: {
    primary: { main: '#2c3e82', dark: '#1f2c61', light: '#526198', contrastText: '#ffffff' },
    info: { main: '#2c3e82', dark: '#1f2c61', light: '#526198', contrastText: '#ffffff' },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={brandTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
