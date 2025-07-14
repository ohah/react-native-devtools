import { useState } from 'react';
// import './assets/index.css';
import { Root } from '@redux-devtools/app';
import './globlas.css';
import DevTools from './components/DevTools';
import ReactDevTools from './components/ReactDevTools';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'root' | 'devtools' | 'react'>('devtools');

  return (
    <div className='flex flex-row h-dvh w-dvw'>
      <div className='flex-1 flex flex-col'>
        <div className='flex border-b border-gray-200'>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'root'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('root')}
          >
            Root
          </button>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'devtools'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('devtools')}
          >
            DevTools
          </button>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'react'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('react')}
          >
            React DevTools
          </button>
        </div>
        <div className='flex-1 overflow-hidden'>
          {activeTab === 'root' && <Root />}
          {activeTab === 'devtools' && <DevTools />}
          {activeTab === 'react' && <ReactDevTools />}
        </div>
      </div>
    </div>
  );
}

export default App;
