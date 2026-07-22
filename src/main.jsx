import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { FinanceProvider } from './context/FinanceContext.jsx'
import { AssetProvider } from './context/AssetContext.jsx'
import './styles/index.css'
import './styles/finance.css'
import './styles/assets.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <FinanceProvider>
          <AssetProvider>
            <App />
          </AssetProvider>
        </FinanceProvider>
      </AppProvider>
    </HashRouter>
  </React.StrictMode>,
)
