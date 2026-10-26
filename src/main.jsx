import './index.css';

import App from './App.jsx';
import LCARSDialogHost from './components/LCARSDialogHost';
import { SettingsProvider } from './contexts/SettingsContext';
import { SoundProvider } from './contexts/SoundContext';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SoundProvider>
      <SettingsProvider>
        <App />
        <LCARSDialogHost />
      </SettingsProvider>
    </SoundProvider>
  </StrictMode>,
);
