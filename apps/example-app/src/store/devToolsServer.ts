// Redux DevTools WebSocket 서버 구현
// React Native 환경에서 DevTools와 통신하기 위한 서버

interface DevToolsServerOptions {
  port?: number;
  host?: string;
}

export class DevToolsServer {
  private port: number;
  private host: string;
  private connections: Set<WebSocket> = new Set();
  private isRunning = false;

  constructor(options: DevToolsServerOptions = {}) {
    this.port = options.port || 8000;
    this.host = options.host || 'localhost';
  }

  start(): void {
    if (this.isRunning) {
      console.log('DevTools 서버가 이미 실행 중입니다.');
      return;
    }

    try {
      // React Native 환경에서는 WebSocket 서버를 직접 구현할 수 없으므로
      // 대신 외부 서버와의 연결을 관리하는 역할을 합니다.
      console.log(`DevTools 서버 시작: ${this.host}:${this.port}`);
      this.isRunning = true;

      // 연결 상태 모니터링
      this.monitorConnections();
    } catch (error) {
      console.error('DevTools 서버 시작 실패:', error);
    }
  }

  stop(): void {
    console.log('DevTools 서버 중지');
    this.isRunning = false;

    // 모든 연결 종료
    for (const connection of this.connections) {
      connection.close();
    }
    this.connections.clear();
  }

  private monitorConnections(): void {
    // 주기적으로 연결 상태 확인
    setInterval(() => {
      if (this.isRunning) {
        console.log(`DevTools 서버 상태: ${this.connections.size}개 연결`);
      }
    }, 30000); // 30초마다
  }

  // 외부에서 메시지를 받아 연결된 클라이언트들에게 브로드캐스트
  broadcast(message: unknown): void {
    const messageStr = JSON.stringify(message);

    for (const connection of this.connections) {
      if (connection.readyState === WebSocket.OPEN) {
        try {
          connection.send(messageStr);
        } catch (error) {
          console.error('메시지 전송 실패:', error);
          this.connections.delete(connection);
        }
      } else {
        // 연결이 닫힌 경우 제거
        this.connections.delete(connection);
      }
    }
  }

  // 연결 추가 (외부에서 호출)
  addConnection(ws: WebSocket): void {
    this.connections.add(ws);

    ws.onclose = () => {
      this.connections.delete(ws);
    };

    ws.onerror = error => {
      console.error('DevTools 연결 오류:', error);
      this.connections.delete(ws);
    };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      connections: this.connections.size,
      port: this.port,
      host: this.host,
    };
  }
}

// 전역 DevTools 서버 인스턴스
let devToolsServer: DevToolsServer | null = null;

export function getDevToolsServer(): DevToolsServer {
  if (!devToolsServer) {
    devToolsServer = new DevToolsServer();
  }
  return devToolsServer;
}

export function startDevToolsServer(options?: DevToolsServerOptions): DevToolsServer {
  const server = getDevToolsServer();
  server.start();
  return server;
}

export function stopDevToolsServer(): void {
  if (devToolsServer) {
    devToolsServer.stop();
  }
}
