import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Typefaces of the style presets, bundled with the app (OFL): no request leaves the device.
import '@fontsource-variable/geist';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
