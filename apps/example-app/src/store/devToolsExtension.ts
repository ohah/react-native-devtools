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

// WebSocket을 통한 DevTools 연결
class WebSocketDevToolsConnection implements DevToolsConnection {
  private ws: WebSocket | null = null;
  private listeners: Array<(message: DevToolsMessage) => void> = [];
  private currentState: unknown = null;
  private messageId = 0;

  constructor(private url = 'ws://localhost:8000') {
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Redux DevTools WebSocket 연결됨');
        // 초기 연결 메시지 전송
        this.sendMessage({
          type: 'INIT',
          payload: this.currentState,
        });
      };

      this.ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as DevToolsMessage;
          for (const listener of this.listeners) {
            listener(message);
          }
        } catch (error) {
          console.error('DevTools 메시지 파싱 오류:', error);
        }
      };

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

// 메모리 기반 DevTools 연결 (WebSocket이 없을 때)
class MemoryDevToolsConnection implements DevToolsConnection {
  private listeners: Array<(message: DevToolsMessage) => void> = [];
  private currentState: unknown = null;
  private actionHistory: DevToolsMessage[] = [];

  subscribe(listener: (message: DevToolsMessage) => void) {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  dispatch(action: { type: string; [key: string]: unknown }) {
    const message: DevToolsMessage = {
      type: 'DISPATCH',
      payload: {
        type: action.type,
        action,
        state: this.currentState,
        timestamp: Date.now(),
      },
    };

    this.actionHistory.push(message);
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  getState() {
    return this.currentState;
  }

  init(state: unknown) {
    this.currentState = state;
    const message: DevToolsMessage = {
      type: 'INIT',
      payload: state,
    };
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  // 액션 히스토리 조회
  getActionHistory() {
    return this.actionHistory;
  }
}

// DevTools Extension 생성
export function createDevToolsExtension(): DevToolsExtension {
  let connection: DevToolsConnection | null = null;

  return {
    connect: (options: { url?: string; useWebSocket?: boolean } = {}) => {
      const { url, useWebSocket = true } = options;

      if (useWebSocket && typeof WebSocket !== 'undefined') {
        connection = new WebSocketDevToolsConnection(url);
      } else {
        connection = new MemoryDevToolsConnection();
      }

      return connection;
    },

    disconnect: () => {
      if (connection?.disconnect) {
        connection.disconnect();
      }
      connection = null;
    },
  };
}

// 전역 객체에 DevTools Extension 주입
export function injectDevToolsExtension(): void {
  if (typeof global !== 'undefined') {
    (global as { __REDUX_DEVTOOLS_EXTENSION__?: DevToolsExtension }).__REDUX_DEVTOOLS_EXTENSION__ =
      createDevToolsExtension();
  }
}

// React Native 환경에서 자동으로 주입
if (typeof global !== 'undefined') {
  injectDevToolsExtension();
}
