# React Native에서 Redux DevTools Extension 사용하기

이 가이드는 React Native 환경에서 `__REDUX_DEVTOOLS_EXTENSION__`을 정의하고 사용하는 방법을 설명합니다.

## 개요

React Native는 브라우저 환경이 아니기 때문에 `window.__REDUX_DEVTOOLS_EXTENSION__`이 자동으로 주입되지 않습니다. 하지만 수동으로 구현하여 Redux DevTools와 통신할 수 있습니다.

## 구현된 파일들

### 1. `devToolsExtension.ts`
- React Native용 Redux DevTools Extension 구현
- WebSocket과 메모리 기반 연결 지원
- 전역 객체에 자동 주입

### 2. `devToolsServer.ts`
- DevTools와 통신할 수 있는 서버 구현
- WebSocket 연결 관리
- 메시지 브로드캐스팅

### 3. `DevToolsTest.tsx`
- DevTools Extension 테스트 컴포넌트
- 연결 상태 확인
- 액션 디스패치 테스트

## 사용 방법

### 1. 기본 설정

```typescript
// store.ts
import './devToolsExtension'; // DevTools Extension 주입

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    todos: todoReducer,
  },
  devTools: {
    name: 'React Native App',
  },
});
```

### 2. WebSocket 연결 사용

```typescript
// DevTools Extension을 WebSocket으로 연결
const extension = (global as any).__REDUX_DEVTOOLS_EXTENSION__;
const connection = extension.connect({
  url: 'ws://localhost:8000',
  useWebSocket: true
});
```

### 3. 메모리 기반 연결 사용

```typescript
// 메모리 기반 연결 (WebSocket 없이)
const connection = extension.connect({
  useWebSocket: false
});
```

## DevTools 서버 실행

### 옵션 1: 외부 WebSocket 서버 사용

```bash
# Node.js WebSocket 서버 예시
npm install ws
```

```javascript
// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8000 });

wss.on('connection', (ws) => {
  console.log('DevTools 클라이언트 연결됨');
  
  ws.on('message', (message) => {
    console.log('받은 메시지:', message.toString());
    // 다른 클라이언트들에게 브로드캐스트
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
});
```

### 옵션 2: Redux DevTools Extension 사용

1. 브라우저에서 Redux DevTools Extension 설치
2. Extension 설정에서 "Use custom (local) server" 활성화
3. WebSocket URL: `ws://localhost:8000`

## 테스트 방법

### 1. 앱에서 테스트 컴포넌트 사용

```typescript
import DevToolsTest from './components/DevToolsTest';

// App.tsx에서 사용
<DevToolsTest />
```

### 2. 콘솔에서 확인

```javascript
// DevTools Extension 주입 확인
console.log(global.__REDUX_DEVTOOLS_EXTENSION__);

// 연결 테스트
const extension = global.__REDUX_DEVTOOLS_EXTENSION__;
const connection = extension.connect();
connection.init({ test: 'Hello DevTools!' });
```

## 메시지 형식

DevTools로 전송되는 메시지는 다음과 같은 형식을 따릅니다:

```javascript
{
  type: 'DISPATCH',
  payload: {
    type: 'ACTION_TYPE',
    action: { type: 'counter/increment' },
    state: { counter: { value: 1 } },
    timestamp: 1234567890
  },
  id: 1,
  timestamp: 1234567890
}
```

## 주의사항

### 1. React Native 환경 제약
- React Native는 브라우저가 아니므로 `window` 객체가 없음
- `global` 객체를 사용하여 전역 변수 정의
- WebSocket 서버는 별도로 실행해야 함

### 2. 성능 고려사항
- 메모리 기반 연결은 액션 히스토리를 메모리에 저장
- 대용량 앱에서는 메모리 사용량 모니터링 필요
- WebSocket 연결은 네트워크 상태에 따라 불안정할 수 있음

### 3. 보안 고려사항
- 개발 환경에서만 사용 권장
- 프로덕션 빌드에서는 DevTools 비활성화
- WebSocket 연결 시 적절한 인증 메커니즘 구현

## 문제 해결

### DevTools Extension이 주입되지 않는 경우

```typescript
// 수동으로 주입
import { injectDevToolsExtension } from './devToolsExtension';
injectDevToolsExtension();
```

### WebSocket 연결 실패

```typescript
// 연결 상태 확인
const connection = extension.connect();
if (!connection) {
  console.log('WebSocket 연결 실패, 메모리 모드로 전환');
  const memoryConnection = extension.connect({ useWebSocket: false });
}
```

### 메시지가 전송되지 않는 경우

```typescript
// 연결 상태 확인
if (connection && typeof connection.dispatch === 'function') {
  connection.dispatch({ type: 'TEST_ACTION' });
} else {
  console.error('DevTools 연결이 올바르지 않습니다.');
}
```

## 추가 기능

### 커스텀 미들웨어와 통합

```typescript
import { createMiddleware } from 'redux';

const devToolsMiddleware = createMiddleware((store) => (next) => (action) => {
  const result = next(action);
  
  // DevTools로 상태 전송
  const extension = (global as any).__REDUX_DEVTOOLS_EXTENSION__;
  if (extension) {
    const connection = extension.connect();
    if (connection) {
      connection.dispatch(action);
    }
  }
  
  return result;
});
```

### 로깅과 함께 사용

```typescript
// 액션 로깅과 DevTools 통합
const loggerMiddleware = (store) => (next) => (action) => {
  console.log('Dispatching:', action);
  const result = next(action);
  console.log('Next State:', store.getState());
  
  // DevTools로 전송
  const extension = (global as any).__REDUX_DEVTOOLS_EXTENSION__;
  if (extension) {
    const connection = extension.connect();
    if (connection) {
      connection.dispatch(action);
    }
  }
  
  return result;
};
```

이렇게 구현하면 React Native 환경에서도 Redux DevTools를 사용하여 상태 변화를 추적하고 디버깅할 수 있습니다. 
