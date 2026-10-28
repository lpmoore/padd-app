import '@fontsource/antonio/latin-400.css';
import '@fontsource/antonio/latin-700.css';
import './index.css';

import App from './App.jsx';
import NotificationHost from './components/NotificationHost';
import { SettingsProvider } from './contexts/SettingsContext';
import { SoundProvider } from './contexts/SoundContext';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SoundProvider>
      <SettingsProvider>
        <App />
        <NotificationHost />
      </SettingsProvider>
    </SoundProvider>
  </StrictMode>,
);
