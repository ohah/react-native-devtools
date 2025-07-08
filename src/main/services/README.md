# Services 폴더

이 폴더는 Electron 메인 프로세스에서 사용하는 서비스들을 포함합니다.

## 파일 구조

```
services/
├── index.ts                    # 서비스 모듈 exports
├── ReactNativeInspectorProxy.ts # React Native Inspector 프록시 서비스
├── types.ts                    # 타입 정의
└── README.md                   # 이 파일
```

## ReactNativeInspectorProxy

React Native Inspector와 Chrome DevTools 간의 통신을 중계하는 프록시 서비스입니다.

### 주요 기능

- **React Native Inspector 연결**: React Native 앱의 Inspector에 자동 연결
- **WebSocket 프록시**: DevTools와 React Native Inspector 간 메시지 중계
- **XMLHttpRequest 로깅**: 네트워크 요청 모니터링
- **네트워크 이벤트 시뮬레이션**: 테스트용 네트워크 이벤트 생성

### 사용법

```typescript
import { ReactNativeInspectorProxy } from './services';

const proxy = new ReactNativeInspectorProxy();
await proxy.start();

// 연결 상태 확인
if (proxy.isConnected()) {
  proxy.enableXHRLogging();
}
```

### 주요 메서드

- `start()`: 프록시 서비스 시작
- `stop()`: 프록시 서비스 중지
- `isConnected()`: React Native Inspector 연결 상태 확인
- `enableXHRLogging()`: XMLHttpRequest 로깅 활성화
- `simulateNetworkEvents()`: 네트워크 이벤트 시뮬레이션

## Types

타입 정의 파일로 다음 인터페이스들을 포함합니다:

- `ReactNativeTarget`: React Native Inspector 타겟 정보
- `DevToolsMessage`: DevTools 메시지 구조
- `RuntimeEvaluateParams`: Runtime.evaluate 파라미터
- `ConsoleAPICalledParams`: Console API 호출 파라미터
- `NetworkRequestParams`: 네트워크 요청 파라미터
- `NetworkResponseParams`: 네트워크 응답 파라미터
- `XHRLogData`: XMLHttpRequest 로그 데이터

## 포트 설정

- **React Native Inspector 포트**: 8082 (기본값)
- **프록시 서버 포트**: 2052 (기본값)

이 포트들은 `ReactNativeInspectorProxy` 클래스의 생성자에서 변경할 수 있습니다. 
