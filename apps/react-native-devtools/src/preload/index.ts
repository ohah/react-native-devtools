import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';

// Custom APIs for renderer
const api = {
  getDevToolsPath: (): string => {
    // DevTools 파일의 절대 경로 반환
    return join(__dirname, '../../public/devtools/front_end/devtools_app.html');
  },
  getDevToolsHTML: (): string => {
    // DevTools HTML 파일을 읽어서 반환
    const filePath = join(__dirname, '../../public/devtools/front_end/devtools_app.html');
    return readFileSync(filePath, 'utf8');
  },
  connectToCDP: async (webSocketUrl: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 일렉트론 메인 프로세스에 CDP 연결 요청
      await (window as any).electronAPI?.connectToCDP?.(webSocketUrl);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  // DevTools에서 로그 명령어 실행
  executeLogCommand: async (
    command: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      return await (window as any).electronAPI?.ipcRenderer?.invoke('execute-log-command', command);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

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
