import React, { useEffect, useRef, useState } from 'react';

const ReactDevTools: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('Starting the server…');
  const [isConnected, setIsConnected] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeReactDevTools();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const initializeReactDevTools = () => {
    try {
      // window.api는 preload.js에서 정의됨
      const { electron, readEnv, ip, getDevTools } = (window as any).api;
      const { options, useHttps, host, protocol, port } = readEnv();

      const localIp = ip.address();
      const defaultPort = (port === 443 && useHttps) || (port === 80 && !useHttps);
      const server = defaultPort ? `${protocol}://${host}` : `${protocol}://${host}:${port}`;
      const serverIp = defaultPort
        ? `${protocol}://${localIp}`
        : `${protocol}://${localIp}:${port}`;

      // DevTools 인스턴스 가져오기
      const devtools = getDevTools();
      if (!devtools) {
        setLoadingStatus('Failed to load React DevTools');
        return;
      }

      // DevTools 서버 시작
      const devToolsInstance = devtools
        .setContentDOMNode(containerRef.current)
        .setDisconnectedCallback(() => {
          setIsConnected(false);
          setLoadingStatus('Disconnected');
        })
        .setStatusListener((status: string) => {
          setLoadingStatus(status);
          if (status.includes('connected')) {
            setIsConnected(true);
          }
        })
        .startServer(port, host, options);

      // 전역에 저장 (Profiler 탭에서 사용)
      (window as any).devtools = devToolsInstance;
      (window as any).server = devToolsInstance;

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

        setShowConfirmation(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setShowConfirmation(false);
        }, 1000);
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
      setLoadingStatus('Failed to initialize React DevTools');
    }
  };

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
    <div className='react-devtools-container'>
      <div
        className='container'
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          WebkitUserSelect: 'none',
          WebkitAppRegion: 'drag',
        }}
      >
        <div className='waiting-header'>Waiting for React to connect…</div>

        <div
          className='boxes'
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'center',
            padding: '1rem',
            WebkitAppRegion: 'none',
          }}
        >
          <div className='box'>
            <div className='box-header'>React Native</div>
            <div className='box-content'>
              Open the{' '}
              <a
                className='link'
                href='#'
                onClick={e => {
                  e.preventDefault();
                  handleExternalLink(
                    'https://reactnative.dev/docs/debugging#accessing-the-in-app-developer-menu'
                  );
                }}
              >
                in-app developer menu
              </a>{' '}
              to connect.
            </div>
          </div>

          <div className='box'>
            <div className='box-header'>React DOM</div>
            <div className='box-content'>
              <div className={`prompt ${showConfirmation ? 'hidden' : ''}`}>
                Add one of the following (click to copy):
              </div>
              <div className={`confirmation ${showConfirmation ? '' : 'hidden'}`}>
                Copied to clipboard.
              </div>
              <span
                className='input'
                onClick={() =>
                  handleCopyClick(`<script src="${(window as any).serverUrl}"></script>`)
                }
                style={{ cursor: 'pointer' }}
              >
                {`<script src="${(window as any).serverUrl || 'http://localhost:8097'}"></script>`}
              </span>
              <span
                className='input'
                onClick={() =>
                  handleCopyClick(`<script src="${(window as any).serverUrlIp}"></script>`)
                }
                style={{ cursor: 'pointer' }}
              >
                {`<script src="${(window as any).serverUrlIp || 'http://localhost:8097'}"></script>`}
              </span>
              to the top of the page you want to debug,
              <br />
              <strong>before</strong> importing React DOM.
            </div>
          </div>

          <div className='box'>
            <div className='box-header'>Profiler</div>
            <div className='box-content'>
              Open the{' '}
              <a
                className='link'
                href='#'
                onClick={e => {
                  e.preventDefault();
                  handleProfilerClick();
                }}
              >
                Profiler tab
              </a>{' '}
              to inspect saved profiles.
            </div>
          </div>

          <div id='loading-status'>{loadingStatus}</div>
        </div>
      </div>

      <style jsx>{`
        .react-devtools-container {
          height: 100%;
          font-family: sans-serif;
          background-color: #fff;
          color: #777d88;
        }

        .waiting-header {
          padding: 0.5rem;
          display: inline-block;
          position: absolute;
          right: 0.5rem;
          top: 0.5rem;
          border-radius: 0.25rem;
          background-color: rgba(0, 1, 2, 0.6);
          color: white;
          border: none;
          font-weight: 100;
          font-style: italic;
        }

        .box {
          text-align: center;
          border-radius: 0.5rem;
          background-color: #f7f7f7;
          border: 1px solid #eee;
          color: #777d88;
          padding: 1rem;
          margin-top: 1rem;
        }

        .box:first-of-type {
          margin-top: 0;
        }

        .box-header {
          text-align: center;
          color: #5f6673;
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .box-content {
          line-height: 1.5rem;
        }

        .input {
          display: block;
          font-weight: 100;
          padding: 0 0.25rem;
          border: 1px solid #aaa;
          background-color: #fff;
          color: #666;
          margin: 0.5rem 0;
          user-select: all;
        }

        .link {
          color: #1478fa;
          text-decoration: none;
        }

        .link:hover {
          text-decoration: underline;
        }

        .prompt,
        .confirmation {
          margin-bottom: 0.25rem;
        }

        .confirmation {
          font-style: italic;
        }

        .hidden {
          display: none;
        }

        #loading-status {
          text-align: center;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
};

export default ReactDevTools;
