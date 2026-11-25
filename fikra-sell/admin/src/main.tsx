import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { brand } from './brand.generated';
import { ToastProvider } from './lib';
import './styles.css';

// Brand colours come from the tokens extracted from the original logo.
const root = document.documentElement;
root.style.setProperty('--primary', brand.primary);
root.style.setProperty('--accent', brand.featured);
root.style.setProperty('--danger', brand.alert);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider><App /></ToastProvider>
  </React.StrictMode>,
);
