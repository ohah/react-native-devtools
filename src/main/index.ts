import { electronApp, is } from '@electron-toolkit/utils';
import CDP from 'chrome-remote-interface';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import icon from '../../resources/icon.png?asset';
import WebSocket from 'ws';

// Chrome DevTools 연결 관리
let chromeClient: CDP.Client | null = null;

// React Native Inspector 프록시 관리
class ReactNativeInspectorProxy {
  private reactNativePort = 8082;
  private proxyPort = 2052;
  private reactNativeConnection: WebSocket | null = null;
  private proxyServer: WebSocket.Server | null = null;
  private devToolsClients = new Set<WebSocket>();
  private requestIdCounter = 1;

  async start() {
    console.log('Starting React Native Inspector Proxy in Electron...');

    // React Native Inspector에 연결
    await this.connectToReactNative();

    // 프록시 WebSocket 서버 시작
    this.startProxyServer();
  }

  private async connectToReactNative() {
    try {
      // React Native Inspector의 타겟 목록 가져오기
      const response = await fetch(`http://localhost:${this.reactNativePort}/json`);
      const targets = await response.json();

      console.log('React Native targets:', targets);

      // Hermes React Native 앱 찾기
      const hermesTarget = targets.find(
        (target: any) => target.vm === 'Hermes' && target.type === 'node'
      );

      const experimentalTarget = targets.find((target: any) =>
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

  private startProxyServer() {
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

  private handleReactNativeMessage(message: any) {
    console.log('React Native Inspector -> DevTools:', message);

    // React Native Inspector에서 받은 메시지를 그대로 DevTools로 전달
    this.broadcastToDevTools(message);
  }

  private handleDevToolsMessage(ws: WebSocket, message: any) {
    console.log('DevTools -> React Native Inspector:', message);

    // DevTools에서 받은 메시지를 React Native Inspector로 그대로 전달
    if (this.reactNativeConnection && this.reactNativeConnection.readyState === WebSocket.OPEN) {
      this.reactNativeConnection.send(JSON.stringify(message));
    }
  }

  private broadcastToDevTools(message: any) {
    this.devToolsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // 네트워크 이벤트 시뮬레이션 (테스트용)
  simulateNetworkEvents() {
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

  stop() {
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

// React Native Inspector 프록시 인스턴스
const rnInspectorProxy = new ReactNativeInspectorProxy();

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
      chromeClient = await CDP({ port: Number.parseInt(port) });

      console.log('CDP connected successfully');
      return { success: true };
    } catch (error: any) {
      console.error('CDP connection failed:', error);
      return { success: false, error: error.message };
    }
  });

  // React Native Inspector 프록시 시작
  rnInspectorProxy.start().then(() => {
    // React Native Inspector가 없을 때 테스트용 네트워크 이벤트 시뮬레이션 활성화
    setTimeout(() => {
      if (!rnInspectorProxy['reactNativeConnection']) {
        console.log('Starting network event simulation for testing...');
        rnInspectorProxy.simulateNetworkEvents();
      }
    }, 3000);
  });

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

  // React Native Inspector 프록시 정리
  rnInspectorProxy.stop();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
