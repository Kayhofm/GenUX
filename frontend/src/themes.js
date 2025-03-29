import { createTheme } from '@mui/material/styles';

export const defaultTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3f51b5',
      light: '#757de8',
      dark: '#002984',
      contrastText: '#fff'
    },
    secondary: {
      main: '#f50057',
      light: '#ff5983',
      dark: '#bb002f',
      contrastText: '#fff'
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#fff'
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: '#000'
    },
    info: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
      contrastText: '#fff'
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#000'
    },
    background: {
      paper: '#fff',
      default: '#fafafa'
    },
    text: {
      primary: '#000',
      secondary: '#555'
    },
    divider: '#e0e0e0'
  }
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: '#000'
    },
    secondary: {
      main: '#f48fb1',
      light: '#f8bbd0',
      dark: '#f06292',
      contrastText: '#000'
    },
    error: {
      main: '#ef5350',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#fff'
    },
    warning: {
      main: '#ffb74d',
      light: '#ffe57f',
      dark: '#ffa726',
      contrastText: '#000'
    },
    info: {
      main: '#64b5f6',
      light: '#90caf9',
      dark: '#42a5f5',
      contrastText: '#000'
    },
    success: {
      main: '#66bb6a',
      light: '#a5d6a7',
      dark: '#388e3c',
      contrastText: '#000'
    },
    background: {
      paper: '#424242',
      default: '#303030'
    },
    text: {
      primary: '#fff',
      secondary: '#aaa'
    },
    divider: '#555'
  }
});

export const natureTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#fff'
    },
    secondary: {
      main: '#ff8f00',
      light: '#ffa726',
      dark: '#f57c00',
      contrastText: '#000'
    },
    background: {
      default: '#f1f8e9',
      paper: '#ffffff'
    },
    text: {
      primary: '#1b5e20',
      secondary: '#33691e'
    },
    divider: '#81c784'
  }
});

export const modernTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#212121',
      light: '#484848',
      dark: '#000000',
      contrastText: '#fff'
    },
    secondary: {
      main: '#bdbdbd',
      light: '#efefef',
      dark: '#8d8d8d',
      contrastText: '#000'
    },
    background: {
      default: '#ffffff',
      paper: '#fafafa'
    },
    text: {
      primary: '#212121',
      secondary: '#757575'
    },
    divider: '#e0e0e0'
  }
});
