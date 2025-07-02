import { electronApp, is } from '@electron-toolkit/utils'
import CDP from 'chrome-remote-interface'
import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron'
import * as path from 'path'
import { join } from 'path'
import { WebSocketServer } from 'ws'
import icon from '../../resources/icon.png?asset'

// Chrome DevTools 연결 관리
let chromeClient: CDP.Client | null = null
let debuggerPort = 19000 // React Native 기본 포트

// 웹소켓 서버
let wss: WebSocketServer | null = null

// 웹소켓 서버 시작
function startWebSocketServer() {
  try {
    wss = new WebSocketServer({ port: 8081 })

    wss.on('connection', (ws, req) => {
      console.log('New client connected:', req.url)

      // 클라이언트에게 환영 메시지 전송
      ws.send(
        JSON.stringify({
          type: 'welcome',
          message: 'Connected to React Native DevTools WebSocket Server',
          timestamp: new Date().toISOString()
        })
      )

      // 메시지 수신 처리
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log('Received message:', data)

          // 에코 응답
          ws.send(
            JSON.stringify({
              type: 'echo',
              original: data,
              timestamp: new Date().toISOString()
            })
          )
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      })

      // 연결 해제 처리
      ws.on('close', () => {
        console.log('Client disconnected')
      })

      // 에러 처리
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    })

    wss.on('error', (error) => {
      console.error('WebSocket server error:', error)
    })

    console.log('WebSocket server started on port 8081')
  } catch (error) {
    console.error('Failed to start WebSocket server:', error)
  }
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
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Enable remote debugging and file protocol
  if (is.dev) {
    // 원격 디버깅 활성화
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({})
    })

    // CSP 완전 비활성화 및 모든 리소스 허용
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [''],
          'X-Content-Type-Options': [''],
          'X-Frame-Options': [''],
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
          'Access-Control-Allow-Headers': ['*']
        }
      })
    })
  }

  // 포트 설정 IPC
  ipcMain.on('set-debugger-port', (event, port) => {
    debuggerPort = port
    console.log(`Debugger port set to: ${port}`)
  })

  // 원격 DevTools 열기
  ipcMain.on('open-remote-devtools', () => {
    const devtoolsUrl = `http://localhost:${debuggerPort}`
    shell.openExternal(devtoolsUrl)
  })

  // Chrome DevTools 열기
  ipcMain.on('open-chrome-devtools', () => {
    shell.openExternal('chrome://inspect')
  })

  // Chrome DevTools를 일렉트론 내에서 열기 (chrome-devtools-frontend 사용)
  ipcMain.on('open-chrome-devtools-in-electron', async () => {
    try {
      // chrome-devtools-frontend 패키지 경로
      const devtoolsFrontendPath = path.join(__dirname, '../../public/devtools/front_end')

      // DevTools 창 생성
      const devtoolsWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Chrome DevTools',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          allowRunningInsecureContent: true
        }
      })

      // DevTools inspector.html 로드
      const devtoolsUrl = `file://${devtoolsFrontendPath}/inspector.html`
      devtoolsWindow.loadURL(devtoolsUrl)

      console.log('Chrome DevTools opened in Electron window')
      console.log('DevTools path:', devtoolsFrontendPath)
    } catch (error) {
      console.error('Failed to open Chrome DevTools:', error)
      // 에러 발생 시 chrome://inspect로 대체
      shell.openExternal('chrome://inspect')
    }
  })

  // React Native DevTools 열기
  ipcMain.on('open-react-native-devtools', async () => {
    try {
      // React Native DevTools 창 생성
      const rnDevtoolsWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'React Native DevTools',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false
        }
      })

      // React Native DevTools URL (Metro 서버)
      const rnDevtoolsUrl = `chrome://inspect`
      rnDevtoolsWindow.loadURL(rnDevtoolsUrl)

      console.log(`React Native DevTools opened at ${rnDevtoolsUrl}`)
    } catch (error) {
      console.error('Failed to open React Native DevTools:', error)
    }
  })

  // Add DevTools menu
  const { Menu } = require('electron')
  const template = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools()
            } else {
              mainWindow.webContents.openDevTools()
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Open Chrome DevTools (External)',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Alt+I',
          click: () => {
            mainWindow.webContents.send('open-chrome-devtools')
          }
        },
        {
          label: 'Open Chrome DevTools (Internal)',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+Shift+I' : 'Ctrl+Alt+Shift+I',
          click: () => {
            mainWindow.webContents.send('open-chrome-devtools-in-electron')
          }
        },
        {
          label: 'Open React Native DevTools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+R' : 'Ctrl+Alt+R',
          click: () => {
            mainWindow.webContents.send('open-react-native-devtools')
          }
        }
      ]
    },
    {
      label: 'Debug',
      submenu: [
        {
          label: 'Set Debugger Port',
          click: () => {
            mainWindow.webContents.send('show-port-input')
          }
        },
        {
          label: 'Connect to Chrome',
          click: () => {
            mainWindow.webContents.send('connect-to-chrome')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.reactnative.devtools')

  // Register file protocol for DevTools
  protocol.registerFileProtocol('file', (request, callback) => {
    const url = request.url.replace('file:///', '')
    callback({ path: url })
  })

  // Default open or close DevTools.
  // Uncomment the following line to open DevTools in development.
  // if (is.dev) mainWindow.webContents.openDevTools()

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // DevTools IPC
  ipcMain.on('open-devtools', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].webContents.openDevTools()
    }
  })

  // Toggle DevTools with shortcuts
  ipcMain.on('toggle-devtools', (event, name) => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const window = windows[0]
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools()
      } else {
        window.webContents.openDevTools()
      }
    }
  })

  // Check port availability
  ipcMain.on('check-port-available', (event, port) => {
    // 간단한 포트 체크 (실제로는 더 복잡한 로직 필요)
    event.reply('check-port-available-reply', true)
  })

  // Chrome DevTools 연결 상태 확인
  ipcMain.on('check-chrome-connection', async (event) => {
    try {
      const client = await CDP({ port: 9222 })
      await client.close()
      event.reply('chrome-connection-status', { connected: true })
    } catch (error) {
      event.reply('chrome-connection-status', { connected: false, error: error.message })
    }
  })

  // CDP 연결 핸들러
  ipcMain.handle('connect-to-cdp', async (event, webSocketUrl: string) => {
    try {
      console.log('Connecting to CDP:', webSocketUrl)

      // WebSocket URL에서 포트 추출
      const url = new URL(webSocketUrl)
      const port = url.port || '9222'

      // CDP 클라이언트 연결
      chromeClient = await CDP({ port: parseInt(port) })

      console.log('CDP connected successfully')
      return { success: true }
    } catch (error) {
      console.error('CDP connection failed:', error)
      return { success: false, error: error.message }
    }
  })

  startWebSocketServer()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Chrome DevTools 클라이언트 정리
  if (chromeClient) {
    chromeClient.close()
    chromeClient = null
  }

  // 웹소켓 서버 정리
  if (wss) {
    wss.close()
    wss = null
    console.log('WebSocket server closed')
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
