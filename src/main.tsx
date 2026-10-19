import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './services/pwa/serviceWorkerClient';
import { requestPersistentStorage } from './services/storage/appStorage';
import { recordLaunch } from './services/session/launchTracker';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/themes/dark.css';
import './styles/themes/light.css';
import './styles/global.css';

recordLaunch();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Best-effort: ask the browser not to evict local data, then enable offline support.
void requestPersistentStorage();
registerServiceWorker();
