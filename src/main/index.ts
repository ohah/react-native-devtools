import { electronApp, is } from '@electron-toolkit/utils';
import CDP from 'chrome-remote-interface';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import icon from '../../resources/icon.png?asset';

// Chrome DevTools 연결 관리
let chromeClient: CDP.Client | null = null;

// Chrome DevTools Protocol 웹소켓 서버
let wss: WebSocketServer | null = null;
let httpServer: any = null;

// React Native Inspector 프록시 연결
let reactNativeProxy: any = null;

// Chrome DevTools Protocol 웹소켓 서버 시작
function startChromeDevToolsServer() {
  try {
    const http = require('http');

    // HTTP 서버 생성 (Chrome DevTools Protocol 호환)
    httpServer = http.createServer((req: any, res: any) => {
      if (req.url === '/json') {
        // Chrome DevTools Protocol의 /json 엔드포인트
        getTargets()
          .then(targets => {
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end(JSON.stringify(targets));
          })
          .catch(error => {
            console.error('Error getting targets:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get targets' }));
          });
      } else if (req.url === '/json/version') {
        // 버전 정보
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            Browser: 'React Native DevTools',
            'Protocol-Version': '1.3',
            'User-Agent': 'React Native DevTools',
            'WebKit-Version': '537.36',
          })
        );
      } else if (req.url === '/json/list') {
        // 타겟 목록 (Chrome DevTools Protocol)
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(getTargets()));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // 웹소켓 서버 생성
    wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws, req) => {
      handleChromeDevToolsConnection(ws, req);
    });

    httpServer.listen(9222, () => {
      console.log('Chrome DevTools Server started on port 9222');
      console.log('Chrome DevTools URL: http://localhost:9222/json');
      console.log('WebSocket URL: ws://localhost:9222');
    });
  } catch (error) {
    console.error('Failed to start Chrome DevTools server:', error);
  }
}

// Chrome DevTools Protocol 연결 처리
function handleChromeDevToolsConnection(ws: any, _req: any) {
  const clientId = Date.now().toString();
  console.log(`New Chrome DevTools client connected: ${clientId}`);

  // Chrome DevTools Protocol 메시지 처리
  ws.on('message', (message: any) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('DevTools client message:', JSON.stringify(data, null, 2));

      // React Native Inspector로 메시지 전달
      if (reactNativeProxy && reactNativeProxy.readyState === WebSocket.OPEN) {
        reactNativeProxy.send(message.toString());
      }

      // 내장 CDP 서버에서도 처리 (필요한 경우)
      handleChromeDevToolsMessage(clientId, data, ws);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Chrome DevTools client disconnected: ${clientId}`);
  });

  ws.on('error', (error: any) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });

  // Inspector.enable 호출 시뮬레이션 (ID 없이 이벤트 전송)
  sendChromeDevToolsResponse(ws, {
    method: 'Inspector.enabled',
    params: {},
  });
}

// Chrome DevTools Protocol 메시지 처리 (간소화)
function handleChromeDevToolsMessage(clientId: string, message: any, ws: any) {
  console.log(`Message from ${clientId}:`, JSON.stringify(message, null, 2));

  // React Native Inspector가 연결되어 있으면 내장 처리 건너뛰기
  if (reactNativeProxy && reactNativeProxy.readyState === WebSocket.OPEN) {
    console.log('React Native Inspector connected, skipping built-in CDP handling');
    return;
  }

  // 내장 CDP 서버 처리 (React Native Inspector가 연결되지 않은 경우만)
  if (message.method) {
    switch (message.method) {
      case 'Debugger.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            debuggerId: clientId,
          },
        });
        break;
      case 'Debugger.setBreakpoint':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            breakpointId: `bp_${Date.now()}`,
            locations: [
              {
                scriptId: message.params.location.scriptId,
                lineNumber: message.params.location.lineNumber,
              },
            ],
          },
        });
        break;
      case 'Inspector.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Page.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Network.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'DOM.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'DOM.getDocument':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            root: {
              nodeId: 1,
              backendNodeId: 1,
              nodeType: 9,
              nodeName: '#document',
              localName: '',
              nodeValue: '',
              childNodeCount: 1,
              children: [
                {
                  nodeId: 2,
                  backendNodeId: 2,
                  nodeType: 1,
                  nodeName: 'HTML',
                  localName: 'html',
                  nodeValue: '',
                  childNodeCount: 2,
                },
              ],
            },
          },
        });
        break;
      case 'CSS.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'CSS.getMatchedStylesForNode':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            inlineStyle: null,
            attributesStyle: null,
            matchedCSSRules: [],
            pseudoElements: [],
            inherited: [],
            cssKeyframesRules: [],
          },
        });
        break;
      case 'Overlay.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Emulation.setDeviceMetricsOverride':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Emulation.setTouchEmulationEnabled':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Runtime.getProperties':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            result: [],
          },
        });
        break;
      case 'Runtime.callFunctionOn':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            result: {
              type: 'undefined',
            },
          },
        });
        break;
      case 'Runtime.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Page.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Page.getResourceTree':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            frameTree: {
              frame: {
                id: 'main',
                loaderId: 'loader-1',
                url: 'http://localhost:8082',
                securityOrigin: 'http://localhost:8082',
                mimeType: 'text/html',
              },
              resources: [],
            },
          },
        });
        break;
      case 'Page.getFrameTree':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            frameTree: {
              frame: {
                id: 'main',
                loaderId: 'loader-1',
                url: 'http://localhost:8082',
                securityOrigin: 'http://localhost:8082',
                mimeType: 'text/html',
              },
              childFrames: [],
            },
          },
        });
        break;
      case 'Page.getNavigationHistory':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            currentIndex: 0,
            entries: [
              {
                id: 1,
                url: 'http://localhost:8082',
                title: 'React Native App',
                transitionType: 'typed',
              },
            ],
          },
        });
        break;
      case 'Page.captureScreenshot':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          },
        });
        break;
      case 'Console.enable':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });

        // Console 도메인이 활성화된 후 샘플 메시지 전송
        setTimeout(() => {
          sendChromeDevToolsResponse(ws, {
            method: 'Console.messageAdded',
            params: {
              message: {
                source: 'console-api',
                level: 'log',
                text: 'Console domain enabled - Ready for JavaScript execution',
                timestamp: Date.now() / 1000,
                url: 'http://localhost:8081',
                lineNumber: 1,
                columnNumber: 1,
              },
            },
          });
        }, 500);
        break;
      case 'Console.clearMessages':
        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {},
        });
        break;
      case 'Runtime.evaluate':
        // JavaScript 실행 시뮬레이션
        const expression = message.params.expression || '';
        console.log(`[DevTools] Evaluating: ${expression}`);

        // 실제 JavaScript 실행 시뮬레이션
        let result = 'undefined';
        let resultType = 'undefined';

        try {
          if (expression.includes('console.log')) {
            // console.log 명령어 처리
            const logMatch = expression.match(/console\.log\(['"`]([^'"`]+)['"`]\)/);
            if (logMatch) {
              result = logMatch[1];
              resultType = 'string';
              console.log(`[DevTools Console] ${result}`);
            }
          } else if (expression.includes('1+1')) {
            result = '2';
            resultType = 'number';
          } else if (expression.includes('"hello"')) {
            result = 'hello';
            resultType = 'string';
          } else {
            result = `Evaluated: ${expression}`;
            resultType = 'string';
          }
        } catch (error: any) {
          result = `Error: ${error.message}`;
          resultType = 'string';
        }

        sendChromeDevToolsResponse(ws, {
          id: message.id,
          result: {
            result: {
              type: resultType,
              value: result,
              description: result,
            },
          },
        });

        // 콘솔 메시지 이벤트 전송
        sendChromeDevToolsResponse(ws, {
          method: 'Console.messageAdded',
          params: {
            message: {
              source: 'console-api',
              level: 'log',
              text: result,
              timestamp: Date.now() / 1000,
              url: 'http://localhost:8082',
              lineNumber: 1,
              columnNumber: 1,
            },
          },
        });
        break;
      default:
        // 기본 응답 - ID가 있는 경우에만 응답
        if (message.id !== undefined) {
          sendChromeDevToolsResponse(ws, {
            id: message.id,
            result: { success: true },
          });
        }
    }
  } else if (message.id !== undefined) {
    // ID만 있는 메시지에 대한 응답
    sendChromeDevToolsResponse(ws, {
      id: message.id,
      result: { success: true },
    });
  }
}

// Chrome DevTools Protocol 응답 전송
function sendChromeDevToolsResponse(ws: any, response: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

// React Native Inspector 프록시 연결
async function connectToReactNativeInspector() {
  try {
    const WebSocket = require('ws');
    // const http = require('http');

    // 먼저 React Native 타겟 목록을 가져옴
    const targets = await getReactNativeTargets();
    console.log('Available React Native targets:', targets);

    // Hermes React Native 앱 찾기
    const hermesTarget = targets.find(
      (target: any) => target.vm === 'Hermes' && target.type === 'node'
    );

    if (!hermesTarget) {
      console.error('Hermes React Native target not found');
      return;
    }

    console.log('Connecting to Hermes React Native:', hermesTarget.title);

    // Hermes React Native Inspector에 연결 (포트 8082로 변경)
    const webSocketUrl = hermesTarget.webSocketDebuggerUrl.replace(':8081', ':8082');
    reactNativeProxy = new WebSocket(webSocketUrl);

    reactNativeProxy.on('open', () => {
      console.log('Connected to Hermes React Native Inspector');
    });

    reactNativeProxy.on('message', (data: any) => {
      const message = data.toString();
      console.log('React Native Inspector message:', message);

      // 여기서 메시지를 DevTools 클라이언트들에게 전달
      if (wss) {
        wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    });

    reactNativeProxy.on('error', (error: any) => {
      console.error('React Native Inspector connection error:', error);
    });

    reactNativeProxy.on('close', () => {
      console.log('React Native Inspector connection closed');
    });
  } catch (error) {
    console.error('Failed to connect to React Native Inspector:', error);
  }
}

// React Native 타겟 목록 가져오기
function getReactNativeTargets(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const http = require('http');

    const options = {
      hostname: 'localhost',
      port: 8082,
      path: '/json',
      method: 'GET',
    };

    const req = http.request(options, (res: any) => {
      let data = '';

      res.on('data', (chunk: any) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          resolve(targets);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error: any) => {
      reject(error);
    });

    req.end();
  });
}

// Chrome DevTools Protocol 타겟 목록
async function getTargets() {
  try {
    // 실제 React Native 타겟 목록을 가져옴
    const targets = await getReactNativeTargets();

    // Hermes React Native 앱 찾기
    const hermesTarget = targets.find(
      (target: any) => target.vm === 'Hermes' && target.type === 'node'
    );

    if (hermesTarget) {
      return [
        {
          description: hermesTarget.description,
          devtoolsFrontendUrl: `http://localhost:3000/devtools/front_end/devtools_app.html?ws=localhost:9222`,
          id: hermesTarget.id,
          title: hermesTarget.title,
          type: hermesTarget.type,
          url: 'http://localhost:8081',
          webSocketDebuggerUrl: `ws://localhost:9222`,
          vm: hermesTarget.vm,
          deviceName: hermesTarget.deviceName,
        },
      ];
    }
  } catch (error) {
    console.error('Failed to get React Native targets:', error);
  }

  // 기본 타겟 (연결 실패 시)
  return [
    {
      description: 'React Native App',
      devtoolsFrontendUrl: `http://localhost:3000/devtools/front_end/devtools_app.html?ws=localhost:9222`,
      id: 'react-native-app',
      title: 'React Native App',
      type: 'page',
      url: 'http://localhost:8081',
      webSocketDebuggerUrl: `ws://localhost:9222`,
    },
  ];
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
      experimentalFeatures: true,
      backgroundThrottling: false,
      offscreen: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    // 개발 모드에서 개발자 도구 자동 열기
    if (is.dev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.reactnative.devtools');

  // Default open or close DevTools.
  // Uncomment the following line to open DevTools in development.
  if (is.dev) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.openDevTools();
    }
  }

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  // DevTools IPC
  ipcMain.on('open-devtools', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.openDevTools();
    }
  });

  // Toggle DevTools with shortcuts
  ipcMain.on('toggle-devtools', (_event, _name) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const window = windows[0];
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools();
      } else {
        window.webContents.openDevTools();
      }
    }
  });

  // Check port availability
  ipcMain.on('check-port-available', (event, _port) => {
    // 간단한 포트 체크 (실제로는 더 복잡한 로직 필요)
    event.reply('check-port-available-reply', true);
  });

  // Chrome DevTools 연결 상태 확인
  ipcMain.on('check-chrome-connection', async event => {
    try {
      const client = await CDP({ port: 9222 });
      await client.close();
      event.reply('chrome-connection-status', { connected: true });
    } catch (error: any) {
      event.reply('chrome-connection-status', {
        connected: false,
        error: error.message,
      });
    }
  });

  // CDP 연결 핸들러
  ipcMain.handle('connect-to-cdp', async (_event, webSocketUrl: string) => {
    try {
      console.log('Connecting to CDP:', webSocketUrl);

      // WebSocket URL에서 포트 추출
      const url = new URL(webSocketUrl);
      const port = url.port || '9222';

      // CDP 클라이언트 연결
      chromeClient = await CDP({ port: parseInt(port) });

      console.log('CDP connected successfully');
      return { success: true };
    } catch (error: any) {
      console.error('CDP connection failed:', error);
      return { success: false, error: error.message };
    }
  });

  startChromeDevToolsServer(); // React Native Inspector 프록시용으로 다시 활성화

  // React Native Inspector에 연결
  setTimeout(() => {
    connectToReactNativeInspector();
  }, 1000);

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Chrome DevTools 클라이언트 정리
  if (chromeClient) {
    chromeClient.close();
    chromeClient = null;
  }

  // 웹소켓 서버 정리
  if (wss) {
    wss.close();
    wss = null;
    console.log('WebSocket server closed');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
