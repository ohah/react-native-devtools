import { electronApp, is } from '@electron-toolkit/utils';
import CDP from 'chrome-remote-interface';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import WebSocket from 'ws';
import icon from '../../resources/icon.png?asset';
import { ReactNativeInspectorProxy } from './services';

// Chrome DevTools 연결 관리
let chromeClient: CDP.Client | null = null;

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
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      event.reply('chrome-connection-status', {
        connected: false,
        error: errorMessage,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CDP connection failed:', error);
      return { success: false, error: errorMessage };
    }
  });

  // React Native Inspector 프록시 시작
  rnInspectorProxy.start().then(() => {
    // React Native Inspector가 없을 때 테스트용 네트워크 이벤트 시뮬레이션 활성화
    setTimeout(() => {
      console.log('rnInspectorProxy', rnInspectorProxy);
      if (!rnInspectorProxy.isConnected()) {
        console.log('Starting network event simulation for testing...');
        rnInspectorProxy.simulateNetworkEvents();
      } else {
        // React Native Inspector가 연결되면 XMLHttpRequest 로깅 활성화
        // TODO: 언젠가 작업해두고 지울 코드
        console.log('Enabling XMLHttpRequest logging...');
        rnInspectorProxy.enableXHRLogging();
      }
    }, 3000);
  });

  // XMLHttpRequest 로깅 활성화 IPC 핸들러
  ipcMain.handle('enable-xhr-logging', async () => {
    try {
      rnInspectorProxy.enableXHRLogging();
      return { success: true, message: 'XMLHttpRequest 로깅이 활성화되었습니다.' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // DevTools에서 직접 로그 명령어 실행 IPC 핸들러
  ipcMain.handle('execute-log-command', async (_event, command: string) => {
    try {
      if (rnInspectorProxy.isConnected()) {
        const logMessage = {
          method: 'Runtime.evaluate',
          params: {
            expression: command,
            returnByValue: true,
            userGesture: true,
          },
          id: rnInspectorProxy.incrementRequestIdCounter(),
        };

        const connection = rnInspectorProxy.getReactNativeConnection();
        if (connection) {
          connection.send(JSON.stringify(logMessage));
        }
        return { success: true, message: '로그 명령어가 실행되었습니다.' };
      }
      return { success: false, error: 'React Native Inspector에 연결되지 않았습니다.' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // React Native Inspector 프록시 연결 상태 확인 IPC 핸들러
  ipcMain.handle('get-rn-proxy-status', async () => {
    try {
      const status = rnInspectorProxy.getConnectionStatus();
      return { success: true, status };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // React Native Inspector 프록시 재시작 IPC 핸들러
  ipcMain.handle('restart-rn-proxy', async () => {
    try {
      rnInspectorProxy.stop();
      await rnInspectorProxy.start();
      return { success: true, message: 'React Native Inspector 프록시가 재시작되었습니다.' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  createWindow();

  app.on('activate', () => {
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
