import { useState } from 'react';
import { Root } from '@redux-devtools/app';
import './globlas.css';
import DevTools from './components/DevTools';
import ReactDevTools from './components/ReactDevTools';
import ReduxDevToolsExample from './components/ReduxDevToolsExample';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'redux' | 'devtools' | 'react'>(
    'redux'
  );

  return (
    <div className='flex flex-row h-dvh w-dvw'>
      <div className='flex-1 flex flex-col'>
        <div className='flex border-b border-gray-200'>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'redux'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('redux')}
          >
            Redux
          </button>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'devtools'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('devtools')}
          >
            DevTools
          </button>
          <button
            type='button'
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'react'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('react')}
          >
            React DevTools
          </button>
        </div>
        <div className='flex-1 overflow-hidden'>
          {/* 모든 컴포넌트를 항상 렌더링하되, display 스타일로 숨김/표시 */}
          <div className={`h-full ${activeTab === 'redux' ? 'block' : 'hidden'}`}>
            <ReduxDevToolsExample />
          </div>
          <div className={`h-full ${activeTab === 'devtools' ? 'block' : 'hidden'}`}>
            <DevTools />
          </div>
          <div className={`h-full ${activeTab === 'react' ? 'block' : 'hidden'}`}>
            <ReactDevTools />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
