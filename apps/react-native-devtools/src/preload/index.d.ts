import type { electronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: typeof electronAPI;
    electronAPI: {
      getDevToolsPath: () => string;
      getDevToolsHTML: () => string;
      connectToCDP: (webSocketUrl: string) => Promise<{ success: boolean; error?: string }>;
      enableXHRLogging: () => Promise<{ success: boolean; message?: string; error?: string }>;
      executeLogCommand: (
        command: string
      ) => Promise<{ success: boolean; message?: string; error?: string }>;
    };
    api: unknown;
  }
}
