import React, { useEffect, useRef, useState } from 'react';

interface DevToolsProps {
  webSocketUrl?: string;
}

const DevTools: React.FC<DevToolsProps> = ({ webSocketUrl }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReactNativeTargets = async () => {
      try {
        if (iframeRef.current) {
          const url = new URL('/devtools/front_end/devtools_app.html', window.location.origin);
          const params = url.searchParams;

          // React Native Inspector 전용 파라미터 설정
          params.append('experiments', 'true');
          params.append('v8only', 'true');
          params.append('improvedChromeReloads', 'true');
          params.append('experimental', 'true');
          params.append('reactNative', 'true');
          params.append('enableNetwork', 'true');
          params.append('enableProfiler', 'true');
          params.append('enableDebugger', 'true');

          // 프록시 서버 WebSocket URL 사용
          const proxyUrl = 'localhost:2052';
          console.log('Using proxy server URL:', proxyUrl);
          params.append('ws', proxyUrl);

          // 콘솔과 네트워크 탭 활성화
          params.append('panel', 'console');
          params.append('enableConsole', 'true');
          params.append('showConsole', 'true');
          params.append('consolePanel', 'true');
          params.append('enableRuntime', 'true');
          params.append('enableLogging', 'true');
          params.append('enableNetwork', 'true');
          params.append('networkPanel', 'true');
          params.append('showNetwork', 'true');
          params.append('nodeFrontend', 'true');
          params.append('hasOtherClients', 'false');
          params.append('browserConnection', 'false');

          // 엘리먼트 탭 비활성화
          params.append('disableElements', 'true');
          params.append('hideElements', 'true');
          params.append('elementsPanel', 'false');
          params.append('disableDOM', 'true');

          // 자동 모델 등록을 위한 파라미터들
          params.append('autoRegisterModels', 'true');
          params.append('autostart', 'true');
          params.append('enableAutoSetup', 'true');
          params.append('enableNetworkAPI', 'true');
          params.append('reactNativeMode', 'true');

          iframeRef.current.src = url.toString();
        } else {
          console.error('Hermes React Native target not found');
          setError('React Native 앱을 찾을 수 없습니다. 앱이 실행 중인지 확인해주세요.');
        }
      } catch (error) {
        console.error('Failed to fetch React Native targets:', error);
        setError('React Native Inspector에 연결할 수 없습니다. 앱이 실행 중인지 확인해주세요.');
      }
    };

    fetchReactNativeTargets();
  }, []);

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#dc3545',
          background: '#f8f9fa',
          borderRadius: '8px',
          margin: '1rem',
        }}
      >
        <h3>DevTools 로드 실패</h3>
        <p>{error}</p>
        <p>시도한 경로: /devtools/front_end/devtools_app.html</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <iframe
        ref={iframeRef}
        title='Chrome DevTools'
        style={{
          border: 'none',
          width: '100vw',
          height: '100vh',
        }}
      />
    </div>
  );
};

export default DevTools;
