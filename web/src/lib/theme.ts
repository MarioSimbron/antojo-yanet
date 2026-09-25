import { createTheme } from '@mui/material/styles';

/**
 * Material UI theme for Antojo de Yanet: warm bakery palette (brown primary, amber
 * secondary, cream background), rounded shapes and no uppercase button labels.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const theme = createTheme({
  palette: {
    primary: { main: '#92400e', light: '#b45309', dark: '#78350f', contrastText: '#fff' },
    secondary: { main: '#f59e0b', contrastText: '#451a03' },
    background: { default: '#fffbeb', paper: '#ffffff' },
    text: { primary: '#451a03', secondary: '#78716c' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Roboto, system-ui, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#fde68a' } } },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'small' } },
  },
});
