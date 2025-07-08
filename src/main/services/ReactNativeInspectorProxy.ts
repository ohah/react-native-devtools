import WebSocket from 'ws';

// React Native Inspector 프록시 관리
export class ReactNativeInspectorProxy {
  private reactNativePort = 8082;
  private proxyPort = 2052;
  private reactNativeConnection: WebSocket | null = null;
  private proxyServer: WebSocket.Server | null = null;
  private devToolsClients = new Set<WebSocket>();
  private requestIdCounter = 1;

  async start(): Promise<void> {
    console.log('Starting React Native Inspector Proxy in Electron...');

    // React Native Inspector에 연결
    await this.connectToReactNative();

    // 프록시 WebSocket 서버 시작
    this.startProxyServer();
  }

  private async connectToReactNative(): Promise<void> {
    try {
      // React Native Inspector의 타겟 목록 가져오기
      const response = await fetch(`http://localhost:${this.reactNativePort}/json`);
      const targets = await response.json();

      console.log('React Native targets:', targets);

      // Hermes React Native 앱 찾기
      const hermesTarget = targets.find(
        (target: { vm: string; type: string }) => target.vm === 'Hermes' && target.type === 'node'
      );

      const experimentalTarget = targets.find((target: { title?: string }) =>
        target.title?.toLowerCase().includes('experimental')
      );

      const selectedTarget = experimentalTarget || hermesTarget;

      if (selectedTarget) {
        console.log('Found React Native target:', selectedTarget);
        const webSocketUrl = selectedTarget.webSocketDebuggerUrl;

        // 실제 WebSocket URL에 연결
        const ws = new WebSocket(webSocketUrl);

        ws.on('open', () => {
          console.log('Connected to React Native Inspector:', webSocketUrl);
          this.reactNativeConnection = ws;
        });

        ws.on('message', data => {
          try {
            const message = JSON.parse(data.toString());
            this.handleReactNativeMessage(message);
          } catch (error) {
            console.error('Error parsing React Native message:', error);
          }
        });

        ws.on('close', () => {
          console.log('Disconnected from React Native Inspector');
          this.reactNativeConnection = null;
        });

        ws.on('error', error => {
          console.error('React Native Inspector connection error:', error);
          this.reactNativeConnection = null;
        });
      } else {
        console.log('No suitable React Native target found');
      }
    } catch (error) {
      console.error('Failed to connect to React Native Inspector:', error);
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

    // 기타 DevTools 메시지를 React Native Inspector로 그대로 전달
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

  // XMLHttpRequest 로깅 활성화
  enableXHRLogging(): void {
    const xhrLoggingScript = `
      (function() {
        const originalXHR = window.XMLHttpRequest;
        const xhrLogs = [];

        function XHRLogger() {
          const xhr = new originalXHR();
          const startTime = Date.now();

          // 요청 시작 로그
          xhr.addEventListener('readystatechange', function() {
            if (xhr.readyState === 1) {
              const logData = {
                method: xhr._method || 'GET',
                url: xhr._url || 'unknown',
                timestamp: new Date().toISOString()
              };
              console.log('[XHR] Request started:', logData);

              // DevTools로 로그 전송
              if (window.Protocol && window.Protocol.InspectorBackend) {
                window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify({
                  method: 'Runtime.consoleAPICalled',
                  params: {
                    type: 'log',
                    args: [
                      {
                        type: 'string',
                        value: '[XHR] Request started: ' + JSON.stringify(logData)
                      }
                    ],
                    timestamp: Date.now() / 1000,
                    executionContextId: 1
                  }
                }));
              }
            }

            if (xhr.readyState === 4) {
              const duration = Date.now() - startTime;
              const logData = {
                method: xhr._method || 'GET',
                url: xhr._url || 'unknown',
                status: xhr.status,
                statusText: xhr.statusText,
                duration: duration + 'ms',
                responseSize: xhr.responseText?.length || 0,
                timestamp: new Date().toISOString()
              };
              console.log('[XHR] Request completed:', logData);

              // DevTools로 로그 전송
              if (window.Protocol && window.Protocol.InspectorBackend) {
                window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify({
                  method: 'Runtime.consoleAPICalled',
                  params: {
                    type: 'log',
                    args: [
                      {
                        type: 'string',
                        value: '[XHR] Request completed: ' + JSON.stringify(logData)
                      }
                    ],
                    timestamp: Date.now() / 1000,
                    executionContextId: 1
                  }
                }));
              }

              // 응답 데이터 로그 (선택적)
              if (xhr.responseText && xhr.responseText.length < 1000) {
                console.log('[XHR] Response data:', xhr.responseText);

                // DevTools로 응답 데이터 전송
                if (window.Protocol && window.Protocol.InspectorBackend) {
                  window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify({
                    method: 'Runtime.consoleAPICalled',
                    params: {
                      type: 'log',
                      args: [
                        {
                          type: 'string',
                          value: '[XHR] Response data: ' + xhr.responseText
                        }
                      ],
                      timestamp: Date.now() / 1000,
                      executionContextId: 1
                    }
                  }));
                }
              }
            }
          });

          // 에러 로그
          xhr.addEventListener('error', function() {
            const logData = {
              method: xhr._method || 'GET',
              url: xhr._url || 'unknown',
              timestamp: new Date().toISOString()
            };
            console.error('[XHR] Request failed:', logData);

            // DevTools로 에러 로그 전송
            if (window.Protocol && window.Protocol.InspectorBackend) {
              window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify({
                method: 'Runtime.consoleAPICalled',
                params: {
                  type: 'error',
                  args: [
                    {
                      type: 'string',
                      value: '[XHR] Request failed: ' + JSON.stringify(logData)
                    }
                  ],
                  timestamp: Date.now() / 1000,
                  executionContextId: 1
                }
              }));
            }
          });

          // 원본 메서드 오버라이드
          const originalOpen = xhr.open;
          xhr.open = function(method, url) {
            xhr._method = method;
            xhr._url = url;
            return originalOpen.apply(this, arguments);
          };

          return xhr;
        }

        // 전역 XMLHttpRequest 교체
        window.XMLHttpRequest = XHRLogger;

        console.log('[XHR Logger] XMLHttpRequest logging enabled');
        return 'XMLHttpRequest logging enabled';
      })();
    `;

    // React Native Inspector로 로깅 스크립트 전송
    if (this.reactNativeConnection && this.reactNativeConnection.readyState === WebSocket.OPEN) {
      const logMessage = {
        method: 'Runtime.evaluate',
        params: {
          expression: xhrLoggingScript,
          returnByValue: true,
          userGesture: true,
        },
        id: this.requestIdCounter++,
      };

      this.reactNativeConnection.send(JSON.stringify(logMessage));
      console.log('XMLHttpRequest 로깅 스크립트 전송됨');
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
    if (this.reactNativeConnection) {
      this.reactNativeConnection.close();
      this.reactNativeConnection = null;
    }

    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = null;
    }

    this.devToolsClients.clear();
  }
}
