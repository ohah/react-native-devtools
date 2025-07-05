import { useState } from 'react';
import './App.css';
import DevTools from './components/DevTools';

function App() {
  const [webSocketUrl, setWebSocketUrl] = useState('');

  return (
    <div className='App'>
      <div className='devtools-container'>
        <div className='devtools-header'>
          <div className='settings-panel'>
            <div className='setting-group'>
              <label htmlFor='websocket-url'>WebSocket URL:</label>
              <input
                id='websocket-url'
                type='text'
                value={webSocketUrl}
                onChange={e => setWebSocketUrl(e.target.value)}
                placeholder='자동으로 React Native Inspector에서 가져옵니다'
              />
            </div>
          </div>
          <span>Chrome DevTools</span>
        </div>
        <DevTools webSocketUrl={webSocketUrl} />
      </div>
    </div>
  );
}

export default App;
