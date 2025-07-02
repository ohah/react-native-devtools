import { useState } from 'react';
import './App.css';
import DevTools from './components/DevTools';

function App() {
  const [webSocketUrl, setWebSocketUrl] = useState('ws://localhost:8081/debugger-proxy?role=client');
  const [targetUrl, setTargetUrl] = useState('http://localhost:8081');

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
                placeholder="ws://localhost:8081/debugger-proxy?role=client"
              />
            </div>

            <div className="setting-group">
              <label>Target URL:</label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="http://localhost:8081"
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
