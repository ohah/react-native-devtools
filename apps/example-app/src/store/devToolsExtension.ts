// React Native용 Redux DevTools Extension 구현

interface DevToolsMessage {
  type: string;
  payload?: unknown;
  id?: number;
  timestamp?: number;
}

interface DevToolsConnection {
  subscribe: (listener: (message: DevToolsMessage) => void) => () => void;
  dispatch: (action: { type: string; [key: string]: unknown }) => void;
  getState: () => unknown;
  init: (state: unknown) => void;
  disconnect?: () => void;
}

interface DevToolsExtension {
  connect: (options?: { url?: string; useWebSocket?: boolean }) => DevToolsConnection;
  disconnect: () => void;
}

// DevTools Extension Compose 타입 정의
type ComposeFunction = (...funcs: any[]) => any;

interface DevToolsExtensionCompose {
  (config?: {
    name?: string;
    actionsBlacklist?: string[];
    actionsWhitelist?: string[];
    predicate?: (state: any, action: any) => boolean;
    stateTransformer?: (state: any) => any;
    actionTransformer?: (action: any) => any;
    serialize?:
      | boolean
      | {
          options?: {
            undefined?: boolean;
            function?: boolean;
            symbol?: boolean;
            error?: boolean;
            maxDepth?: number;
            replacer?: (key: string, value: any) => any;
          };
        };
  }): ComposeFunction;
}

// WebSocket을 통한 DevTools 연결
class WebSocketDevToolsConnection implements DevToolsConnection {
  private ws: WebSocket | null = null;
  private listeners: Array<(message: DevToolsMessage) => void> = [];
  private currentState: unknown = null;
  private messageId = 0;

  constructor(private url = 'ws://localhost:2052') {
    console.log('WebSocketDevToolsConnection 생성됨:', url);
    this.connect();
  }

  private connect(): void {
    try {
      console.log('WebSocket 연결 시도:', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Redux DevTools WebSocket 연결됨');
        // 초기 연결 메시지 전송
        this.sendMessage({
          type: 'INIT',
          payload: this.currentState,
        });
      };

      // this.ws.onmessage = event => {
      //   try {
      //     const message = JSON.parse(event.data) as DevToolsMessage;
      //     console.log('DevTools 메시지 수신:', message);
      //     for (const listener of this.listeners) {
      //       listener(message);
      //     }
      //   } catch (error) {
      //     console.error('DevTools 메시지 파싱 오류:', error);
      //   }
      // };

      this.ws.onerror = error => {
        console.error('DevTools WebSocket 오류:', error);
      };

      this.ws.onclose = () => {
        console.log('DevTools WebSocket 연결 종료');
        // 재연결 시도
        setTimeout(() => this.connect(), 5000);
      };
    } catch (error) {
      console.error('DevTools WebSocket 연결 실패:', error);
    }
  }

  private sendMessage(message: DevToolsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          ...message,
          id: ++this.messageId,
          timestamp: Date.now(),
        })
      );
    }
  }

  subscribe(listener: (message: DevToolsMessage) => void) {
    console.log('subscribe', listener);
    this.listeners.push(listener);

    // 구독 해제 함수 반환
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  dispatch(action: { type: string; [key: string]: unknown }) {
    console.log('dispatch', action);
    this.sendMessage({
      type: 'DISPATCH',
      payload: {
        type: action.type,
        action,
        state: this.currentState,
        timestamp: Date.now(),
      },
    });
  }

  getState() {
    return this.currentState;
  }

  init(state: unknown) {
    this.currentState = state;
    console.log('init', state);
    this.sendMessage({
      type: 'INIT',
      payload: state,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// DevTools Extension 생성
export function createDevToolsExtension(): DevToolsExtension {
  let connection: DevToolsConnection | null = null;

  console.log('createDevToolsExtension 호출됨');

  return {
    connect: (options: { url?: string; useWebSocket?: boolean } = {}) => {
      const { url, useWebSocket = true } = options;

      console.log('DevTools connect 호출됨:', { url, useWebSocket });

      console.log('WebSocket DevTools 연결 시도');
      connection = new WebSocketDevToolsConnection(url);

      return connection;
    },

    disconnect: () => {
      console.log('DevTools disconnect 호출됨');
      if (connection?.disconnect) {
        connection.disconnect();
      }
      connection = null;
    },
  };
}

// Redux Toolkit과 호환되는 DevTools Extension Compose
function createDevToolsExtensionCompose(): DevToolsExtensionCompose {
  return (config = {}) => {
    console.log('DevTools Extension Compose 호출됨:', config);

    return (...funcs: any[]) => {
      // Redux의 compose 함수 사용
      const { compose } = require('redux');

      // DevTools enhancer 생성
      const devToolsEnhancer = (createStore: any) => (reducer: any, initialState?: any) => {
        console.log('DevTools enhancer 실행됨');

        const store = createStore(reducer, initialState);

        // DevTools 연결
        const extension = (global as any).__REDUX_DEVTOOLS_EXTENSION__;
        if (extension) {
          console.log('DevTools Extension 발견, 연결 시도');
          const connection = extension.connect({
            url: 'ws://localhost:2052',
            useWebSocket: true,
            ...config,
          });

          // 초기 상태 전송
          connection.init(store.getState());

          // 상태 변화 구독
          store.subscribe(() => {
            connection.init(store.getState());
          });

          console.log('DevTools 연결 완료');
        } else {
          console.log('DevTools Extension을 찾을 수 없음');
        }

        return store;
      };

      // DevTools enhancer를 포함하여 compose
      return compose(...funcs, devToolsEnhancer);
    };
  };
}

// 전역 객체에 DevTools Extension 주입
export function injectDevToolsExtension(): void {
  if (typeof global !== 'undefined') {
    console.log('DevTools Extension 주입 시작');

    // Redux Toolkit이 찾는 정확한 형태로 주입
    const devToolsExtension = createDevToolsExtension();

    // global 객체에 주입
    (global as any).__REDUX_DEVTOOLS_EXTENSION__ = devToolsExtension;

    // window 객체도 함께 주입 (Redux Toolkit이 찾는 곳)
    if (typeof window !== 'undefined') {
      (window as any).__REDUX_DEVTOOLS_EXTENSION__ = devToolsExtension;
    }

    console.log('DevTools Extension 주입 완료');

    // Compose 함수도 함께 주입
    injectDevToolsExtensionCompose();
  }
}

// 전역 객체에 DevTools Extension Compose 주입
export function injectDevToolsExtensionCompose(): void {
  if (typeof global !== 'undefined') {
    console.log('DevTools Extension Compose 주입 시작');

    const composeFunction = createDevToolsExtensionCompose();

    // global 객체에 주입
    (
      global as { __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: DevToolsExtensionCompose }
    ).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeFunction;

    // window 객체도 함께 주입
    if (typeof window !== 'undefined') {
      (
        window as { __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: DevToolsExtensionCompose }
      ).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeFunction;
    }

    console.log('DevTools Extension Compose 주입 완료');
  }
}

// React Native 환경에서 자동으로 주입
// console.log('DevTools Extension 자동 주입 시작');
// injectDevToolsExtension();
// console.log('DevTools Extension 자동 주입 완료');

// // 바로 connect 실행
// console.log('바로 connect 실행 시작');
// const extension = (global as any).__REDUX_DEVTOOLS_EXTENSION__;
// if (extension) {
//   console.log('Extension 발견, 바로 connect 호출');
//   const connection = extension.connect({
//     url: 'ws://localhost:2052',
//     useWebSocket: true,
//   });
//   console.log('바로 연결 성공:', connection);

//   // 테스트용 초기 상태 전송
//   connection.init({ test: 'initial state' });
//   console.log('테스트 초기 상태 전송 완료');
// } else {
//   console.log('Extension을 찾을 수 없음');
// }
