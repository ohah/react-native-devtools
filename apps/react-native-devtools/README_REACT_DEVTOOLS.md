# React DevTools Core 프론트엔드 사용하기

이 가이드는 React Native DevTools 앱에서 `react-devtools-core`의 프론트엔드 API를 사용하여 React 컴포넌트를 디버깅하는 방법을 설명합니다.

## 개요

React Native DevTools 앱은 프론트엔드 역할을 하며, React Native 앱에서 `react-devtools-core` 백엔드를 설정하면 WebSocket을 통해 컴포넌트 정보를 받아서 표시합니다.

## 아키텍처

```
React Native 앱 (백엔드)
    ↓ WebSocket (포트 8097)
React Native DevTools 앱 (프론트엔드)
```

## React Native 앱 설정

### 1. react-devtools-core 설치

```bash
cd your-react-native-app
npm install react-devtools-core
```

### 2. 백엔드 초기화

React Native 앱의 진입점에서 다음 코드를 추가하세요:

```typescript
// index.js 또는 App.tsx
import { initialize, connectToDevTools } from 'react-devtools-core';

// React 패키지 import 전에 초기화
if (__DEV__) {
  initialize({
    appendComponentStack: true,
    breakOnConsoleErrors: false,
    showInlineWarningsAndErrors: true,
    hideConsoleLogsInStrictMode: false,
  });

  connectToDevTools({
    host: 'localhost',
    port: 8097,
    retryConnectionDelay: 200,
    useHttps: false,
  });
}
```

### 3. React Native 스타일 해석 (선택사항)

React Native의 스타일 객체를 올바르게 표시하려면:

```typescript
import { StyleSheet } from 'react-native';

connectToDevTools({
  host: 'localhost',
  port: 8097,
  resolveRNStyle: (key: number) => {
    // React Native 스타일 키를 실제 스타일 객체로 변환
    return StyleSheet.flatten(StyleSheetRegistry.getStyleByID(key));
  },
});
```

## React Native DevTools 앱 사용

### 1. 앱 실행

```bash
cd apps/react-native-devtools
npm run dev
```

### 2. React DevTools 패널 확인

앱이 실행되면 React DevTools 패널이 자동으로 표시됩니다. 이 패널은:

- **컴포넌트 트리**: React 컴포넌트 계층 구조
- **컴포넌트 상세**: 선택된 컴포넌트의 props와 state
- **연결 상태**: React Native 앱과의 연결 상태

### 3. 컴포넌트 검사

1. React Native 앱에서 `react-devtools-core` 백엔드가 실행 중인지 확인
2. DevTools 앱에서 "새로고침" 버튼 클릭
3. 컴포넌트 트리에서 원하는 컴포넌트 클릭
4. 오른쪽 패널에서 props와 state 확인

## 주요 기능

### 1. 컴포넌트 트리 시각화

- React 컴포넌트 계층 구조를 트리 형태로 표시
- 각 컴포넌트의 자식 개수 표시
- 컴포넌트 선택 및 하이라이트

### 2. Props & State 검사

- 선택된 컴포넌트의 props 실시간 확인
- 컴포넌트의 state 값 표시
- JSON 형태로 깔끔하게 포맷팅

### 3. 실시간 연결

- WebSocket을 통한 실시간 통신
- 연결 상태 실시간 표시
- 자동 재연결 기능

## 메시지 프로토콜

DevTools 앱과 React Native 앱 간의 통신은 다음과 같은 메시지 형식을 사용합니다:

### 1. 컴포넌트 트리 요청

```javascript
// DevTools 앱 → React Native 앱
{
  event: 'getComponentTree'
}

// React Native 앱 → DevTools 앱
{
  event: 'componentTree',
  payload: {
    id: 'root',
    name: 'App',
    children: [
      {
        id: 'counter',
        name: 'Counter',
        children: []
      }
    ]
  }
}
```

### 2. 컴포넌트 상세 정보 요청

```javascript
// DevTools 앱 → React Native 앱
{
  event: 'getComponentProps',
  payload: { id: 'counter' }
}

// React Native 앱 → DevTools 앱
{
  event: 'componentProps',
  payload: {
    id: 'counter',
    props: { value: 0, onIncrement: 'function' }
  }
}
```

## 문제 해결

### 1. 연결되지 않는 경우

**React Native 앱에서 확인할 사항:**
```typescript
// 백엔드가 제대로 초기화되었는지 확인
console.log('React DevTools 백엔드 초기화됨');

// WebSocket 연결 상태 확인
// 브라우저 개발자 도구에서 Network 탭 확인
```

**DevTools 앱에서 확인할 사항:**
- 포트 8097이 사용 가능한지 확인
- 방화벽 설정 확인
- React Native 앱이 실행 중인지 확인

### 2. 컴포넌트 정보가 표시되지 않는 경우

```typescript
// React Native 앱에서 React Fiber 트리 접근 확인
if (typeof global !== 'undefined' && global.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools Hook이 활성화됨');
} else {
  console.log('React DevTools Hook이 비활성화됨');
}
```

### 3. 성능 이슈

```typescript
// 대용량 컴포넌트 트리 처리
const MAX_COMPONENTS = 1000;

// 컴포넌트 개수 제한
if (componentCount > MAX_COMPONENTS) {
  console.warn('컴포넌트가 너무 많습니다. 성능에 영향을 줄 수 있습니다.');
}
```

## 고급 설정

### 1. 커스텀 메시징 프로토콜

WebSocket 대신 커스텀 메시징을 사용할 수 있습니다:

```typescript
import { connectWithCustomMessagingProtocol } from 'react-devtools-core';

const unsubscribe = connectWithCustomMessagingProtocol({
  onSubscribe: (listener) => {
    // 메시지 구독 설정
  },
  onUnsubscribe: (listener) => {
    // 메시지 구독 해제
  },
  onMessage: (event, payload) => {
    // 메시지 전송
  },
  onSettingsUpdated: (settings) => {
    // 설정 업데이트 처리
  },
});
```

### 2. HTTPS 연결

보안이 필요한 환경에서는 HTTPS를 사용할 수 있습니다:

```typescript
connectToDevTools({
  host: 'localhost',
  port: 8097,
  useHttps: true,
});
```

### 3. 앱 활성 상태 확인

앱이 활성 상태일 때만 DevTools와 연결하도록 설정:

```typescript
connectToDevTools({
  host: 'localhost',
  port: 8097,
  isAppActive: () => {
    // 앱이 활성 상태인지 확인하는 로직
    return true;
  },
});
```

## 예시 프로젝트

### React Native 앱 예시

```typescript
// App.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { initialize, connectToDevTools } from 'react-devtools-core';

// DevTools 초기화
if (__DEV__) {
  initialize();
  connectToDevTools({
    host: 'localhost',
    port: 8097,
  });
}

const App = () => {
  const [count, setCount] = React.useState(0);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Count: {count}</Text>
      <Button title="Increment" onPress={() => setCount(count + 1)} />
    </View>
  );
};

export default App;
```

### DevTools 앱에서 확인할 수 있는 정보

- **컴포넌트 트리**: App → View → Text, Button
- **Props**: 각 컴포넌트의 props 정보
- **State**: App 컴포넌트의 count state
- **실시간 업데이트**: 버튼 클릭 시 state 변화

## 참고 자료

- [react-devtools-core npm 패키지](https://www.npmjs.com/package/react-devtools-core)
- [React DevTools 공식 문서](https://react.dev/learn/react-developer-tools)
- [React Native 디버깅 가이드](https://reactnative.dev/docs/debugging)

이렇게 설정하면 React Native 환경에서도 브라우저의 React DevTools와 동일한 수준의 컴포넌트 디버깅 기능을 사용할 수 있습니다. 
