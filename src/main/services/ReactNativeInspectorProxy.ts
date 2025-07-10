import WebSocket from 'ws';

// React Native Inspector 프록시 관리
export class ReactNativeInspectorProxy {
  private reactNativePort = 8082;
  private proxyPort = 2052;
  private reactNativeConnection: WebSocket | null = null;
  private proxyServer: WebSocket.Server | null = null;
  private devToolsClients = new Set<WebSocket>();
  private requestIdCounter = 1;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isStarting = false;

  async start(): Promise<void> {
    if (this.isStarting) {
      console.log('Already starting React Native Inspector Proxy...');
      return;
    }

    this.isStarting = true;
    console.log('Starting React Native Inspector Proxy in Electron...');

    try {
      // React Native Inspector에 연결
      await this.connectToReactNative();

      // 프록시 WebSocket 서버 시작
      this.startProxyServer();

      // 연결 상태 모니터링 시작
      this.startConnectionMonitoring();
    } catch (error) {
      console.error('Failed to start React Native Inspector Proxy:', error);
    } finally {
      this.isStarting = false;
    }
  }

  private async connectToReactNative(): Promise<void> {
    try {
      console.log(
        `Attempting to connect to React Native Inspector on port ${this.reactNativePort}...`
      );

      // React Native Inspector의 타겟 목록 가져오기
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

      let targets: Array<{
        title?: string;
        type: string;
        vm?: string;
        webSocketDebuggerUrl?: string;
      }>;

      try {
        const response = await fetch(`http://localhost:${this.reactNativePort}/json`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        targets = await response.json();
        console.log('React Native targets found:', targets.length);
        console.log(
          'Available targets:',
          targets.map(
            (t: { title?: string; type: string; vm?: string; webSocketDebuggerUrl?: string }) => ({
              title: t.title,
              type: t.type,
              vm: t.vm,
              webSocketDebuggerUrl: t.webSocketDebuggerUrl,
            })
          )
        );
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Connection timeout - React Native Inspector not responding');
        }
        throw error;
      }

      // Hermes React Native 앱 찾기
      const hermesTarget = targets.find(target => target.vm === 'Hermes' && target.type === 'node');

      const experimentalTarget = targets.find(target =>
        target.title?.toLowerCase().includes('experimental')
      );

      // 일반적인 React Native 타겟도 찾기
      const reactNativeTarget = targets.find(
        target => target.title?.toLowerCase().includes('react native') || target.type === 'node'
      );

      const selectedTarget = experimentalTarget || hermesTarget || reactNativeTarget || targets[0];

      if (selectedTarget) {
        console.log('Selected React Native target:', selectedTarget);
        const webSocketUrl = selectedTarget.webSocketDebuggerUrl;

        if (!webSocketUrl) {
          throw new Error('No WebSocket debugger URL found in target');
        }

        // 실제 WebSocket URL에 연결
        const ws = new WebSocket(webSocketUrl);

        ws.on('open', () => {
          console.log('✅ Successfully connected to React Native Inspector:', webSocketUrl);
          this.reactNativeConnection = ws;

          // 재연결 인터벌 정리
          if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          }
        });

        ws.on('message', data => {
          try {
            const message = JSON.parse(data.toString());
            this.handleReactNativeMessage(message);
          } catch (error) {
            console.error('Error parsing React Native message:', error);
          }
        });

        ws.on('close', (code, reason) => {
          console.log(
            `❌ Disconnected from React Native Inspector (code: ${code}, reason: ${reason})`
          );
          this.reactNativeConnection = null;
          this.scheduleReconnect();
        });

        ws.on('error', error => {
          console.error('❌ React Native Inspector connection error:', error);
          this.reactNativeConnection = null;
          this.scheduleReconnect();
        });

        // 연결 타임아웃 설정
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket connection timeout');
            ws.terminate();
            this.scheduleReconnect();
          }
        }, 10000); // 10초 타임아웃
      } else {
        console.log('❌ No suitable React Native target found');
        this.scheduleReconnect();
      }
    } catch (error) {
      console.error('❌ Failed to connect to React Native Inspector:', error);
      this.scheduleReconnect();
    }
  }

  private startProxyServer(): void {
    try {
      this.proxyServer = new WebSocket.Server({ port: this.proxyPort });

      this.proxyServer.on('connection', ws => {
        console.log('Chrome DevTools connected to proxy');
        this.devToolsClients.add(ws);

        console.log('DevTools connected to proxy');

        ws.on('message', data => {
          try {
            const message = JSON.parse(data.toString());
            this.handleDevToolsMessage(ws, message);
          } catch (error) {
            console.error('Error parsing DevTools message:', error);
          }
        });

        ws.on('close', () => {
          console.log('Chrome DevTools disconnected from proxy');
          this.devToolsClients.delete(ws);
        });

        ws.on('error', error => {
          console.error('DevTools connection error:', error);
          this.devToolsClients.delete(ws);
        });
      });

      this.proxyServer.on('error', error => {
        console.error('Proxy server error:', error);
      });

      console.log(`Proxy server running on port ${this.proxyPort}`);
    } catch (error) {
      console.error('Failed to start proxy server:', error);
    }
  }

  private handleReactNativeMessage(message: Record<string, unknown>): void {
    console.log('React Native Inspector -> DevTools:', message);

    // Runtime.evaluate 응답 처리 (로그 결과)
    if (message.result && (message.result as Record<string, unknown>)?.result) {
      const result = (message.result as Record<string, unknown>).result as Record<string, unknown>;
      if (result.type === 'string' && result.value) {
        console.log('React Native 실행 결과:', result.value);

        // DevTools 콘솔에 로그 표시
        this.broadcastToDevTools({
          method: 'Runtime.consoleAPICalled',
          params: {
            type: 'log',
            args: [
              {
                type: 'string',
                value: `[React Native] ${result.value}`,
              },
            ],
            timestamp: Date.now() / 1000,
            executionContextId: 1,
          },
        });
      }
    }

    // Console API 호출 처리 (console.log 등)
    if (message.method === 'Runtime.consoleAPICalled') {
      console.log('React Native Console API 호출:', message.params);

      // DevTools 콘솔에 전달
      this.broadcastToDevTools(message);
    }

    // 기타 React Native Inspector에서 받은 메시지를 그대로 DevTools로 전달
    this.broadcastToDevTools(message);
  }

  private handleDevToolsMessage(ws: WebSocket, message: Record<string, unknown>): void {
    console.log('DevTools -> React Native Inspector:', message);

    // Network.enable 명령 처리 - DevTools가 네트워크 모니터링을 활성화하려고 할 때
    if (message.method === 'Network.enable') {
      console.log(
        '🔗 [Network.enable] DevTools requested Network.enable - activating network monitoring'
      );
      console.log('🔗 [Network.enable] Message details:', {
        id: message.id,
        method: message.method,
        params: message.params,
      });

      // DevTools에 성공 응답 전송
      this.broadcastToDevTools({
        id: message.id,
        result: {},
      });

      console.log('🔗 [Network.enable] Success response sent to DevTools');
      return;
    }

    // Network.disable 명령 처리
    if (message.method === 'Network.disable') {
      console.log('🔗 [Network.disable] DevTools requested Network.disable');
      console.log('🔗 [Network.disable] Message details:', {
        id: message.id,
        method: message.method,
        params: message.params,
      });

      // DevTools에 성공 응답 전송
      this.broadcastToDevTools({
        id: message.id,
        result: {},
      });

      console.log('🔗 [Network.disable] Success response sent to DevTools');
      return;
    }

    // DevTools에서 보내는 네트워크 이벤트는 React Native Inspector로 전달하지 않음
    // 대신 DevTools로 다시 전달하여 네트워크 탭에 표시되도록 함
    if (message.method?.toString().startsWith('Network.')) {
      console.log(
        '🔗 [Network Event] DevTools network event - forwarding back to DevTools:',
        message.method
      );

      // DevTools로 네트워크 이벤트를 다시 전달
      this.broadcastToDevTools(message);
      return; // React Native Inspector로는 전달하지 않음
    }

    // DevTools에서 보낸 로그 메시지 처리
    if (
      message.method === 'Runtime.evaluate' &&
      (message.params as Record<string, unknown>)?.expression
    ) {
      const expression = (message.params as Record<string, unknown>).expression as string;

      // XMLHttpRequest 로그 관련 명령어 처리
      if (expression.includes('console.log') || expression.includes('XMLHttpRequest')) {
        console.log('DevTools에서 로그 명령어 감지:', expression);

        // React Native Inspector로 로그 명령어 전달
        if (
          this.reactNativeConnection &&
          this.reactNativeConnection.readyState === WebSocket.OPEN
        ) {
          // React Native에서 실행할 수 있는 형태로 변환
          const rnLogMessage = {
            method: 'Runtime.evaluate',
            params: {
              expression: expression,
              returnByValue: true,
              userGesture: true,
            },
            id: message.id,
          };

          this.reactNativeConnection.send(JSON.stringify(rnLogMessage));
          return; // 원본 메시지는 전달하지 않음
        }
      }
    }

    // 기타 DevTools 메시지를 React Native Inspector로 전달
    if (this.reactNativeConnection && this.reactNativeConnection.readyState === WebSocket.OPEN) {
      this.reactNativeConnection.send(JSON.stringify(message));
    }
  }

  private broadcastToDevTools(message: Record<string, unknown>): void {
    for (const client of this.devToolsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }

  // 네트워크 이벤트 시뮬레이션 (테스트용)
  simulateNetworkEvents(): void {
    setInterval(() => {
      const requestId = this.requestIdCounter++;

      // 요청 시작
      this.broadcastToDevTools({
        method: 'Network.requestWillBeSent',
        params: {
          requestId: requestId.toString(),
          loaderId: '1',
          documentURL: 'https://api.example.com/data',
          request: {
            url: 'https://api.example.com/data',
            method: 'GET',
            headers: {
              'User-Agent': 'React Native App',
            },
          },
          timestamp: Date.now() / 1000,
          wallTime: Date.now() / 1000,
          initiator: {
            type: 'script',
          },
        },
      });

      // 응답 수신
      setTimeout(() => {
        this.broadcastToDevTools({
          method: 'Network.responseReceived',
          params: {
            requestId: requestId.toString(),
            loaderId: '1',
            timestamp: Date.now() / 1000,
            type: 'Document',
            response: {
              url: 'https://api.example.com/data',
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json',
              },
              mimeType: 'application/json',
            },
          },
        });
      }, 100);

      // 요청 완료
      setTimeout(() => {
        this.broadcastToDevTools({
          method: 'Network.requestFinished',
          params: {
            requestId: requestId.toString(),
            timestamp: Date.now() / 1000,
            encodedDataLength: 100,
          },
        });
      }, 200);
    }, 5000); // 5초마다 시뮬레이션
  }

  // React Native Inspector 연결 상태 확인
  isConnected(): boolean {
    return this.reactNativeConnection?.readyState === WebSocket.OPEN;
  }

  // 연결 상태 상세 정보
  getConnectionStatus(): {
    reactNative: boolean;
    proxyServer: boolean;
    devToolsClients: number;
    reconnectScheduled: boolean;
  } {
    return {
      reactNative: this.isConnected(),
      proxyServer: this.proxyServer !== null,
      devToolsClients: this.devToolsClients.size,
      reconnectScheduled: this.reconnectInterval !== null,
    };
  }

  // 요청 ID 카운터 접근자
  getRequestIdCounter(): number {
    return this.requestIdCounter;
  }

  // 요청 ID 카운터 증가
  incrementRequestIdCounter(): number {
    return this.requestIdCounter++;
  }

  // React Native 연결 접근자
  getReactNativeConnection(): WebSocket | null {
    return this.reactNativeConnection;
  }

  stop(): void {
    // 재연결 인터벌 정리
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.reactNativeConnection) {
      this.reactNativeConnection.close();
      this.reactNativeConnection = null;
    }

    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = null;
    }

    this.devToolsClients.clear();
    console.log('🛑 React Native Inspector Proxy stopped');
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return; // 이미 재연결이 예약되어 있음
    }

    console.log('🔄 Scheduling reconnection in 5 seconds...');
    this.reconnectInterval = setInterval(async () => {
      console.log('🔄 Attempting to reconnect to React Native Inspector...');
      await this.connectToReactNative();
    }, 5000);
  }

  private startConnectionMonitoring(): void {
    // 연결 상태를 주기적으로 확인
    setInterval(() => {
      const isConnected = this.isConnected();
      const clientCount = this.devToolsClients.size;

      console.log(
        `📊 Connection Status - React Native: ${
          isConnected ? '✅ Connected' : '❌ Disconnected'
        }, DevTools Clients: ${clientCount}`
      );

      if (!isConnected && !this.reconnectInterval) {
        console.log('🔄 React Native connection lost, scheduling reconnection...');
        this.scheduleReconnect();
      }
    }, 10000); // 10초마다 확인
  }
}
