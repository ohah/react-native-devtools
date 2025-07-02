import { useState } from 'react';
import './App.css';
import DevTools from './components/DevTools';

function App() {
  const [webSocketUrl, setWebSocketUrl] = useState('ws://localhost:9222');
  const [targetUrl, setTargetUrl] = useState('http://localhost:9222');

  return (
    <div className="App">
      <div className="devtools-container">
        <div className="devtools-header">
          <div className="settings-panel">
            <div className="setting-group">
              <label>WebSocket URL:</label>
              <input
                type="text"
                value={webSocketUrl}
                onChange={(e) => setWebSocketUrl(e.target.value)}
                placeholder="ws://localhost:9222"
              />
            </div>

            <div className="setting-group">
              <label>Target URL:</label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="http://localhost:9222"
              />
            </div>
          </div>
          <span>Chrome DevTools</span>
        </div>
        <DevTools webSocketUrl={webSocketUrl} targetUrl={targetUrl} />
      </div>
    </div>
  );
}

export default App;
