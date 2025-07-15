import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, clipboard, shell } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { internalIpV4Sync } from 'internal-ip';

// React DevTools 관련 API
const getDevTools = () => {
  let devtools;
  try {
    devtools = require('react-devtools-core/standalone').default;
  } catch (err) {
    console.error('react-devtools-core 패키지를 찾을 수 없습니다:', err);
    console.warn('yarn add react-devtools-core를 실행하거나 패키지를 빌드해주세요.');
    return null;
  }
  return devtools;
};

// 환경 설정 읽기
const readEnv = () => {
  let options;
  let useHttps = false;
  try {
    if (process.env.KEY && process.env.CERT) {
      options = {
        key: readFileSync(process.env.KEY),
        cert: readFileSync(process.env.CERT),
      };
      useHttps = true;
    }
  } catch (err) {
    console.error('Failed to process SSL options - ', err);
    options = undefined;
  }
  const host = process.env.HOST || 'localhost';
  const protocol = useHttps ? 'https' : 'http';
  const port = +process.env.REACT_DEVTOOLS_PORT || +process.env.PORT || 8097;
  return { options, useHttps, host, protocol, port };
};

// Custom APIs for renderer
const api = {
  // 기존 API들
  getDevToolsPath: (): string => {
    return join(__dirname, '../../public/devtools/front_end/devtools_app.html');
  },

  getDevToolsHTML: (): string => {
    const filePath = join(__dirname, '../../public/devtools/front_end/devtools_app.html');
    return readFileSync(filePath, 'utf8');
  },

  connectToCDP: async (webSocketUrl: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await (window as any).electronAPI?.connectToCDP?.(webSocketUrl);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  executeLogCommand: async (
    command: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      return await (window as any).electronAPI?.ipcRenderer?.invoke('execute-log-command', command);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // React DevTools 공식 API들
  electron: { clipboard, shell },

  ip: {
    address: internalIpV4Sync(),
  },

  getDevTools: getDevTools,

  readEnv: readEnv,
};

// Expose protected methods so that render process does not need unsafe node integration
contextBridge.exposeInMainWorld('api', {
  electron: { clipboard, shell },
  ip: { address: internalIpV4Sync() },
  getDevTools: getDevTools,
  readEnv: readEnv,
});

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('electronAPI', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.electronAPI = api;
}
