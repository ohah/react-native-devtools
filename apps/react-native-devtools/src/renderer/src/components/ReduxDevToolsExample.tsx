import React, { useState, useEffect, useMemo } from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { createDevTools } from '@redux-devtools/core';
import { DockMonitor } from '@redux-devtools/dock-monitor';
import { LogMonitor } from '@redux-devtools/log-monitor';
import { PersistGate } from 'redux-persist/integration/react';
import { Root } from './redux-devtools-app';

// ============================================================================
// @redux-devtools/dock-monitor 실제 구현
// ============================================================================

// DockMonitor DevTools 컴포넌트 생성
const DevTools = createDevTools(
  // <DockMonitor
  //   toggleVisibilityKey='ctrl-h'
  //   changePositionKey='ctrl-q'
  //   defaultIsVisible={true}
  //   fluid={false}
  //   defaultPosition='bottom'
  //   defaultSize={0.3}
  // >
  <LogMonitor
    theme='tomorrow'
    expandActionRoot={true}
    expandStateRoot={true}
    markStateDiff={true}
  />
  // </DockMonitor>
);

// ============================================================================
// 테스트용 리듀서
// ============================================================================

interface TestState {
  count: number;
  todos: Array<{ id: number; text: string; completed: boolean }>;
  user: { name: string; email: string } | null;
}

const initialState: TestState = {
  count: 0,
  todos: [],
  user: null,
};

const testReducer = (state = initialState, action: { type: string; payload?: unknown }) => {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
    case 'SET_COUNT':
      return { ...state, count: (action.payload as number) || 0 };
    case 'ADD_TODO':
      return {
        ...state,
        todos: [
          ...state.todos,
          { id: Date.now(), text: action.payload as string, completed: false },
        ],
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === (action.payload as number) ? { ...todo, completed: !todo.completed } : todo
        ),
      };
    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== (action.payload as number)),
      };
    case 'SET_USER':
      return { ...state, user: action.payload as { name: string; email: string } };
    case 'CLEAR_USER':
      return { ...state, user: null };
    default:
      return state;
  }
};

// ============================================================================
// Store 생성
// ============================================================================

const createTestStore = () => {
  const enhancer = DevTools.instrument();
  return createStore(testReducer, initialState, enhancer);
};

// ============================================================================
// DockMonitor 사용 예제 컴포넌트
// ============================================================================

const ReduxDevToolsExample: React.FC = () => {
  const [store] = useState(() => createTestStore());
  const [state, setState] = useState(store.getState());
  const [newTodo, setNewTodo] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });

    return unsubscribe;
  }, [store]);

  const handleIncrement = () => {
    store.dispatch({ type: 'INCREMENT' });
  };

  const handleDecrement = () => {
    store.dispatch({ type: 'DECREMENT' });
  };

  const handleAddTodo = () => {
    if (newTodo.trim()) {
      store.dispatch({ type: 'ADD_TODO', payload: newTodo.trim() });
      setNewTodo('');
    }
  };

  const handleToggleTodo = (id: number) => {
    store.dispatch({ type: 'TOGGLE_TODO', payload: id });
  };

  const handleDeleteTodo = (id: number) => {
    store.dispatch({ type: 'DELETE_TODO', payload: id });
  };

  const handleSetUser = () => {
    if (userName.trim() && userEmail.trim()) {
      store.dispatch({
        type: 'SET_USER',
        payload: { name: userName.trim(), email: userEmail.trim() },
      });
      setUserName('');
      setUserEmail('');
    }
  };

  const handleClearUser = () => {
    store.dispatch({ type: 'CLEAR_USER' });
  };

  return (
    <div className='p-6 mx-auto h-full overflow-y-auto w-full'>
      <Provider store={store}>
        <Root />
      </Provider>
      <h1 className='text-3xl font-bold mb-6 text-white'>@redux-devtools/dock-monitor 실제 동작</h1>

      {/* 실제 DockMonitor DevTools */}
      <div className='bg-green-900/20 border border-green-500/30 p-4 rounded-lg mb-6'>
        <h2 className='text-xl font-semibold mb-4 text-white'>실제 DockMonitor DevTools</h2>
        <p className='text-gray-200 mb-4'>단축키: Ctrl+H (표시/숨김), Ctrl+Q (위치 변경)</p>
        <div className='bg-gray-900 border border-gray-600 p-4 rounded h-96 overflow-hidden w-full relative'>
          <DevTools store={store} />
        </div>
      </div>

      {/* 현재 상태 */}
      <div className='bg-gray-800/50 border border-gray-600 p-4 rounded-lg mb-6'>
        <h2 className='text-xl font-semibold mb-4 text-white'>현재 Redux 상태</h2>
        <pre className='bg-gray-900 border border-gray-600 p-3 rounded text-sm overflow-auto max-h-60 text-gray-200'>
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>

      {/* 테스트 액션들 */}
      <div className='bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg mb-6'>
        <h2 className='text-xl font-semibold mb-4 text-white'>DockMonitor에서 확인할 액션들</h2>
        <p className='text-gray-200 mb-4'>
          아래 버튼들을 클릭하여 Redux 액션을 발생시키고, DockMonitor에서 액션과 상태 변화를 확인할
          수 있습니다.
        </p>

        {/* 카운터 */}
        <div className='mb-6'>
          <h3 className='text-lg font-medium text-white mb-2'>카운터: {state.count}</h3>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handleIncrement}
              className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
            >
              증가
            </button>
            <button
              type='button'
              onClick={handleDecrement}
              className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'
            >
              감소
            </button>
          </div>
        </div>

        {/* Todo */}
        <div className='mb-6'>
          <h3 className='text-lg font-medium text-white mb-2'>Todo 리스트</h3>
          <div className='flex gap-2 mb-4'>
            <input
              type='text'
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              placeholder='새로운 할 일을 입력하세요'
              className='flex-1 px-3 py-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400'
              onKeyPress={e => e.key === 'Enter' && handleAddTodo()}
            />
            <button
              type='button'
              onClick={handleAddTodo}
              className='bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600'
            >
              추가
            </button>
          </div>
          <div className='space-y-2'>
            {state.todos.map(todo => (
              <div
                key={todo.id}
                className='flex items-center gap-2 p-2 bg-gray-800 rounded border border-gray-600'
              >
                <input
                  type='checkbox'
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo.id)}
                  className='w-4 h-4'
                />
                <span
                  className={`flex-1 text-gray-200 ${todo.completed ? 'line-through text-gray-400' : ''}`}
                >
                  {todo.text}
                </span>
                <button
                  type='button'
                  onClick={() => handleDeleteTodo(todo.id)}
                  className='bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600'
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 사용자 정보 */}
        <div>
          <h3 className='text-lg font-medium text-white mb-2'>사용자 정보</h3>
          {state.user ? (
            <div className='mb-4'>
              <p className='text-gray-200'>
                <strong className='text-white'>이름:</strong> {state.user.name}
              </p>
              <p className='text-gray-200'>
                <strong className='text-white'>이메일:</strong> {state.user.email}
              </p>
              <button
                type='button'
                onClick={handleClearUser}
                className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'
              >
                사용자 정보 삭제
              </button>
            </div>
          ) : (
            <div className='space-y-2 mb-4'>
              <input
                type='text'
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder='사용자 이름'
                className='w-full px-3 py-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400'
              />
              <input
                type='email'
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder='사용자 이메일'
                className='w-full px-3 py-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400'
              />
              <button
                type='button'
                onClick={handleSetUser}
                className='bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600'
              >
                사용자 정보 설정
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReduxDevToolsExample;
