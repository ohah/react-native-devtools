// React Native Inspector 관련 타입 정의

export interface ReactNativeTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
  vm?: string;
  description?: string;
}

export interface DevToolsMessage {
  method: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  id?: number;
}

export interface RuntimeEvaluateParams {
  expression: string;
  returnByValue?: boolean;
  userGesture?: boolean;
}

export interface ConsoleAPICalledParams {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  args: Array<{
    type: string;
    value?: string;
    description?: string;
  }>;
  timestamp: number;
  executionContextId: number;
}

export interface NetworkRequestParams {
  requestId: string;
  loaderId: string;
  documentURL: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  timestamp: number;
  wallTime: number;
  initiator: {
    type: string;
  };
}

export interface NetworkResponseParams {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
  };
}

export interface XHRLogData {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  duration?: string;
  responseSize?: number;
  timestamp: string;
}
