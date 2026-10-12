import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'
import toast, { Toaster } from 'react-hot-toast'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { getErrorMessage } from './utils/notifications.js'

// Set axios base URL from environment variable
// Use empty string to leverage Vite proxy for both local and network access
axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

window.addEventListener('error', (event) => {
  toast.error(getErrorMessage(event.error, 'An unexpected application error occurred'))
});

window.addEventListener('unhandledrejection', (event) => {
  toast.error(getErrorMessage(event.reason, 'An unexpected operation failed'))
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <Toaster position="top-right" />
  </React.StrictMode>,
)
