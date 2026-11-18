import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import './index.css';
import './i18n';
import App from './App';

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
