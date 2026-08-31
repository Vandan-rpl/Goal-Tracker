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
import { ThemeProvider } from '@mui/material/styles';
import getTheme, { CssBaseline } from './theme/theme';

const theme = getTheme('light');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
