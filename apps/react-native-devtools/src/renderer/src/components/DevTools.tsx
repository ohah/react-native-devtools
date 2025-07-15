import React, { useEffect, useRef } from 'react';

const DevTools: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // 이미 초기화되었으면 스킵
    if (initializedRef.current) {
      console.log('DevTools가 이미 초기화되었습니다.');
      return;
    }

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
          initializedRef.current = true;
        } else {
          console.error('Hermes React Native target not found');
        }
      } catch (error) {
        console.error('Failed to fetch React Native targets:', error);
      }
    };

    fetchReactNativeTargets();
  }, []);

  return (
    <div className='relative h-full'>
      <iframe ref={iframeRef} className='border-none w-full h-full' title='Chrome DevTools' />
    </div>
  );
};

export default DevTools;
