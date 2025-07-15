import React, { useEffect, useRef, useState, useCallback } from 'react';

// 전역 서버 인스턴스 관리
let globalDevToolsInstance: any = null;
let isServerStarting = false;

const ReactDevTools: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('Starting the server…');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  const initializeReactDevTools = useCallback(() => {
    // 이미 초기화되었으면 스킵
    if (initializedRef.current) {
      console.log('React DevTools가 이미 초기화되었습니다.');
      return;
    }

    try {
      // 이미 서버가 시작 중이면 대기
      if (isServerStarting) {
        console.log('서버가 이미 시작 중입니다. 대기 중...');
        setLoadingStatus('Server is starting...');
        return;
      }

      // 이미 서버가 실행 중이면 기존 인스턴스 사용
      if (globalDevToolsInstance) {
        console.log('기존 서버 인스턴스를 사용합니다.');
        setLoadingStatus('Using existing server instance');
        initializedRef.current = true;
        return;
      }

      // API 접근 확인
      if (!(window as any).api) {
        console.error('API가 노출되지 않았습니다');
        setLoadingStatus('API not available');
        return;
      }

      const { electron, readEnv, ip, getDevTools } = (window as any).api;

      // 각 API 함수 확인
      if (!readEnv || !ip || !getDevTools) {
        console.error('필요한 API 함수가 누락되었습니다:', {
          readEnv: !!readEnv,
          ip: !!ip,
          getDevTools: !!getDevTools,
        });
        setLoadingStatus('Required APIs not available');
        return;
      }

      const { options, useHttps, host, protocol, port } = readEnv();

      const localIp = ip.address;
      const defaultPort = (port === 443 && useHttps) || (port === 80 && !useHttps);
      const server = defaultPort ? `${protocol}://${host}` : `${protocol}://${host}:${port}`;
      const serverIp = defaultPort
        ? `${protocol}://${localIp}`
        : `${protocol}://${localIp}:${port}`;

      // DevTools 인스턴스 가져오기
      const devtools = getDevTools();
      if (!devtools) {
        console.error('React DevTools를 로드할 수 없습니다');
        setLoadingStatus('Failed to load React DevTools');
        return;
      }

      console.log('React DevTools 초기화 시작...', { port, host, options });

      // 서버 시작 플래그 설정
      isServerStarting = true;

      // DevTools 서버 시작
      globalDevToolsInstance = devtools
        .setContentDOMNode(containerRef.current)
        .setDisconnectedCallback(() => {
          console.log('React DevTools 연결 해제됨');
          setLoadingStatus('Disconnected');
          // 연결 해제 시 전역 인스턴스 정리
          globalDevToolsInstance = null;
          initializedRef.current = false;
        })
        .setStatusListener((status: string) => {
          console.log('React DevTools 상태:', status);
          setLoadingStatus(status);
          if (status.includes('connected') || status.includes('listening')) {
            isServerStarting = false;
            initializedRef.current = true;
          }
          if (status.includes('Failed to start')) {
            isServerStarting = false;
            globalDevToolsInstance = null;
            initializedRef.current = false;
          }
        })
        .startServer(port, host, options);

      // 전역에 저장 (Profiler 탭에서 사용)
      (window as any).devtools = globalDevToolsInstance;
      (window as any).server = globalDevToolsInstance;

      console.log('React DevTools 서버 시작됨');

      // 클립보드 복사 함수
      const selectAllAndCopy = (text: string) => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
        } else {
          // 폴백: 임시 textarea 사용
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      };

      // 외부 링크 열기
      const openExternalLink = (url: string) => {
        electron.shell.openExternal(url);
      };

      // Profiler 탭 열기
      const openProfiler = () => {
        if ((window as any).devtools) {
          (window as any).devtools.openProfiler();
        }
      };

      // 전역 함수로 노출
      (window as any).selectAllAndCopy = selectAllAndCopy;
      (window as any).openExternalLink = openExternalLink;
      (window as any).openProfiler = openProfiler;
      (window as any).serverUrl = server;
      (window as any).serverUrlIp = serverIp;
    } catch (error) {
      console.error('React DevTools 초기화 실패:', error);
      setLoadingStatus(`Failed to initialize React DevTools: ${(error as Error).message}`);
      isServerStarting = false;
      globalDevToolsInstance = null;
      initializedRef.current = false;
    }
  }, []);

  useEffect(() => {
    // DOM 노드가 준비된 후에 초기화
    if (containerRef.current && !initializedRef.current) {
      initializeReactDevTools();
    }

    // 컴포넌트 언마운트 시 정리 (실제 언마운트가 아닌 경우에는 정리하지 않음)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [initializeReactDevTools]);

  const handleCopyClick = (text: string) => {
    (window as any).selectAllAndCopy?.(text);
  };

  const handleExternalLink = (url: string) => {
    (window as any).openExternalLink?.(url);
  };

  const handleProfilerClick = () => {
    (window as any).openProfiler?.();
  };

  return (
    <div className='h-full relative font-sans bg-white text-gray-600'>
      {/* DevTools UI가 렌더링될 컨테이너 */}
      <div ref={containerRef} className='h-full w-full z-50 absolute' />

      {/* 기존 UI는 항상 표시하되 DevTools가 렌더링되면 가려짐 */}
      <div className='absolute inset-0 flex flex-col items-center justify-center overflow-auto select-none bg-white z-10'>
        <div className='absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-light italic'>
          Waiting for React to connect…
        </div>

        <div className='flex flex-col items-stretch justify-center p-4'>
          <div className='text-center rounded-lg bg-gray-50 border border-gray-200 text-gray-600 p-4 mt-4'>
            <div className='text-center text-gray-700 text-xl mb-2'>React Native</div>
            <div className='leading-6'>
              Open the{' '}
              <button
                type='button'
                onClick={() =>
                  handleExternalLink(
                    'https://reactnative.dev/docs/debugging#accessing-the-in-app-developer-menu'
                  )
                }
                className='text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 font-inherit'
              >
                in-app developer menu
              </button>{' '}
              to connect.
            </div>
          </div>

          <div className='text-center rounded-lg bg-gray-50 border border-gray-200 text-gray-600 p-4 mt-4'>
            <div className='text-center text-gray-700 text-xl mb-2'>React DOM</div>
            <div className='leading-6'>
              <div className='mb-1'>Add one of the following (click to copy):</div>
              <button
                type='button'
                onClick={() =>
                  handleCopyClick(`<script src="${(window as any).serverUrl}"></script>`)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCopyClick(`<script src="${(window as any).serverUrl}"></script>`);
                  }
                }}
                className='block font-light px-1 border border-gray-400 bg-white text-gray-600 my-2 select-all cursor-pointer w-full text-left font-inherit'
              >
                {`<script src="${(window as any).serverUrl || 'http://localhost:8098'}"></script>`}
              </button>
              <button
                type='button'
                onClick={() =>
                  handleCopyClick(`<script src="${(window as any).serverUrlIp}"></script>`)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCopyClick(`<script src="${(window as any).serverUrlIp}"></script>`);
                  }
                }}
                className='block font-light px-1 border border-gray-400 bg-white text-gray-600 my-2 select-all cursor-pointer w-full text-left font-inherit'
              >
                {`<script src="${(window as any).serverUrlIp || 'http://localhost:8098'}"></script>`}
              </button>
              to the top of the page you want to debug,
              <br />
              <strong>before</strong> importing React DOM.
            </div>
          </div>

          <div className='text-center rounded-lg bg-gray-50 border border-gray-200 text-gray-600 p-4 mt-4'>
            <div className='text-center text-gray-700 text-xl mb-2'>Profiler</div>
            <div className='leading-6'>
              Open the{' '}
              <button
                type='button'
                onClick={handleProfilerClick}
                className='text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 font-inherit'
              >
                Profiler tab
              </button>{' '}
              to inspect saved profiles.
            </div>
          </div>

          <div className='text-center mt-4'>{loadingStatus}</div>
        </div>
      </div>
    </div>
  );
};

export default ReactDevTools;
