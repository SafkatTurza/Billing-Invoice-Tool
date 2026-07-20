import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { FinanceProvider } from './context/FinanceContext.jsx'
import './styles/index.css'
import './styles/finance.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <FinanceProvider>
          <App />
        </FinanceProvider>
      </AppProvider>
    </HashRouter>
  </React.StrictMode>,
)
