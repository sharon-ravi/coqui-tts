// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// There should be NO <React.StrictMode> tags here.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);