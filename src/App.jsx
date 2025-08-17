import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import HomePage from './pages/HomePage';
import TokensPage from './pages/TokensPage';
import SendPage from './pages/SendPage';
import ToolsPage from './pages/ToolsPage';

// Theme
import ThemeProvider from './components/ThemeProvider';

import './App.css';
import './styles/themes.css';
import './styles/layout.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/tokens" element={<TokensPage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/settings" element={<ToolsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;

