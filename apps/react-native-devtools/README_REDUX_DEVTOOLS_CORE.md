# @redux-devtools/core 사용 가이드

이 가이드는 React Native DevTools 일렉트론 앱에서 `@redux-devtools/core` 패키지를 사용하는 방법을 설명합니다.

## 개요

`@redux-devtools/core`는 Redux DevTools의 핵심 기능을 제공하는 패키지입니다. 이를 통해 Redux store의 상태 변화를 실시간으로 모니터링하고 디버깅할 수 있습니다.

## 주요 기능

- **createDevTools**: Redux DevTools UI 컴포넌트 생성
- **LogMonitor**: 액션과 상태를 로그 형태로 표시
- **DockMonitor**: DevTools를 도킹 가능한 형태로 표시
- **실시간 상태 모니터링**: 액션과 상태 변화 추적
- **시간 여행 디버깅**: 이전 상태로 되돌리기
- **액션 디스패치**: DevTools에서 직접 액션 실행

## 설치

```bash
npm install @redux-devtools/core @redux-devtools/lib
# 또는
yarn add @redux-devtools/core @redux-devtools/lib
```

## 기본 사용법

### 1. DevTools 설정

```typescript
// DevTools 설정 객체
const devToolsConfig = {
  name: 'React Native DevTools App',
  hostname: 'localhost',
  port: 8000,
  realtime: true,
  maxAge: 50,
  features: {
    pause: true,
    lock: true,
    persist: true,
    export: true,
    import: 'custom',
    jump: true,
    skip: true,
    reorder: true,
    dispatch: true,
    test: true,
  },
};
```

### 2. DevTools UI 컴포넌트 생성

```typescript
import { createDevTools } from '@redux-devtools/core';
import { LogMonitor } from '@redux-devtools/lib';

const DevTools = createDevTools(
  <LogMonitor theme="tomorrow" />
);

// 또는 DockMonitor 사용
import { DockMonitor } from '@redux-devtools/lib';

const DevTools = createDevTools(
  <DockMonitor toggleVisibilityKey="ctrl-h" changePositionKey="ctrl-q">
    <LogMonitor theme="tomorrow" />
  </DockMonitor>
);
```

### 3. Redux Toolkit과 함께 사용

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { createDevTools } from '@redux-devtools/core';
import { LogMonitor } from '@redux-devtools/lib';

const DevTools = createDevTools(
  <LogMonitor theme="tomorrow" />
);

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    todos: todoReducer,
  },
});

// App 컴포넌트에서 DevTools 사용
const App = () => {
  return (
    <Provider store={store}>
      <div>
        {/* 앱 컴포넌트들 */}
        <DevTools />
      </div>
    </Provider>
  );
};
```

## 예제 컴포넌트

이 프로젝트에는 `ReduxDevToolsExample.tsx` 컴포넌트가 포함되어 있으며, 다음과 같은 기능을 보여줍니다:

### 포함된 기능

1. **카운터**: 증가, 감소, 설정 기능
2. **Todo 리스트**: 추가, 토글, 삭제 기능
3. **사용자 정보**: 설정, 삭제 기능
4. **상태 내보내기/가져오기**: JSON 형태로 상태 저장/복원
5. **실시간 상태 표시**: 현재 Redux 상태를 JSON으로 표시

### 사용 방법

1. React Native DevTools 앱을 실행
2. "Redux DevTools Core 예제" 탭을 클릭
3. 다양한 액션을 실행하여 상태 변화를 관찰
4. DevTools 기능을 테스트

## 설정 옵션

### createDevTools 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| name | string | - | DevTools 인스턴스 이름 |
| hostname | string | 'localhost' | 호스트명 |
| port | number | 8000 | 포트 번호 |
| realtime | boolean | true | 실시간 업데이트 |
| maxAge | number | 50 | 최대 액션 개수 |
| features | object | - | 활성화할 기능들 |

### instrument 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| name | string | - | DevTools 이름 |
| maxAge | number | 50 | 최대 액션 개수 |
| shouldCatchErrors | boolean | false | 에러 캐치 여부 |
| shouldHotReload | boolean | true | 핫 리로드 지원 |
| shouldRecordChanges | boolean | true | 상태 변화 기록 |
| shouldStartLocked | boolean | false | 잠금 상태로 시작 |
| pauseActionType | string | '@@PAUSE' | 일시정지 액션 타입 |

## 고급 설정

### 커스텀 연결 설정

```typescript
// instrument 함수를 사용한 커스텀 enhancer
const customEnhancer = instrument({
  name: 'Custom DevTools',
  maxAge: 30,
  shouldCatchErrors: true,
  // 추가 설정들...
});
```

### 조건부 DevTools 활성화

```typescript
import { instrument } from '@redux-devtools/core';

const createConditionalStore = (reducer, initialState) => {
  const { createStore } = require('redux');
  
  let enhancer;
  
  if (process.env.NODE_ENV === 'development') {
    enhancer = compose(
      instrument({
        name: 'Development DevTools',
        maxAge: 50,
      })
    );
  } else {
    // 프로덕션에서는 DevTools 없이
    enhancer = compose();
  }
  
  return createStore(reducer, initialState, enhancer);
};
```

### 미들웨어와 함께 사용

```typescript
import { instrument } from '@redux-devtools/core';

const createLoggingMiddleware = () => {
  return (store) => (next) => (action) => {
    console.group(`DevTools: ${action.type}`);
    console.log('이전 상태:', store.getState());
    console.log('액션:', action);
    
    const result = next(action);
    
    console.log('다음 상태:', store.getState());
    console.groupEnd();
    
    return result;
  };
};

// DevTools와 함께 사용
const store = createStore(
  reducer,
  initialState,
  compose(
    applyMiddleware(createLoggingMiddleware()),
    instrument({
      name: 'Logging DevTools',
      maxAge: 30,
    })
  )
);
```

## 실제 사용 예제

### 카운터 앱 예제

```typescript
// counterReducer.ts
const counterReducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'SET_COUNT':
      return { count: action.payload || 0 };
    default:
      return state;
  }
};

// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { instrument } from '@redux-devtools/core';
import counterReducer from './counterReducer';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
  enhancers: (defaultEnhancers) => [
    ...defaultEnhancers,
    instrument({
      name: 'Counter App',
      maxAge: 30,
      shouldCatchErrors: true,
    }),
  ],
});
```

### Todo 앱 예제

```typescript
// todoReducer.ts
const todoReducer = (state = { todos: [] }, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        todos: [...state.todos, { id: Date.now(), text: action.payload, completed: false }]
      };
    case 'TOGGLE_TODO':
      return {
        todos: state.todos.map(todo =>
          todo.id === action.payload
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      };
    case 'DELETE_TODO':
      return {
        todos: state.todos.filter(todo => todo.id !== action.payload)
      };
    default:
      return state;
  }
};

// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { instrument } from '@redux-devtools/core';
import todoReducer from './todoReducer';

export const store = configureStore({
  reducer: {
    todos: todoReducer,
  },
  enhancers: (defaultEnhancers) => [
    ...defaultEnhancers,
    instrument({
      name: 'Todo App',
      maxAge: 50,
      shouldCatchErrors: true,
    }),
  ],
});
```

## 문제 해결

### DevTools가 연결되지 않는 경우

1. **포트 확인**: DevTools가 사용하는 포트가 다른 프로세스에 의해 사용되고 있지 않은지 확인
2. **네트워크 설정**: 방화벽이나 네트워크 설정으로 인해 연결이 차단되지 않았는지 확인
3. **환경 변수**: `NODE_ENV`가 올바르게 설정되어 있는지 확인

### 성능 문제

1. **maxAge 조정**: 너무 많은 액션을 기록하면 메모리 사용량이 증가할 수 있음
2. **필터링**: 불필요한 액션은 DevTools에서 제외
3. **프로덕션 비활성화**: 프로덕션 환경에서는 DevTools를 비활성화

### 타입 오류

```typescript
// TypeScript에서 타입 오류가 발생하는 경우
import { createDevTools, instrument } from '@redux-devtools/core';
import type { StoreEnhancer } from 'redux';

const enhancer: StoreEnhancer = instrument({
  name: 'Typed DevTools',
  maxAge: 30,
});
```

## 추가 리소스

- [Redux DevTools 공식 문서](https://github.com/reduxjs/redux-devtools)
- [@redux-devtools/core npm 패키지](https://www.npmjs.com/package/@redux-devtools/core)
- [Redux Toolkit 문서](https://redux-toolkit.js.org/)

이 가이드를 통해 `@redux-devtools/core`를 효과적으로 사용하여 Redux 앱을 디버깅하고 개발할 수 있습니다. 
