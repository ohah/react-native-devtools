import React, { useEffect, useRef, useState } from 'react';

interface DevToolsProps {
  webSocketUrl?: string;
  targetUrl?: string;
}

const DevTools: React.FC<DevToolsProps> = ({ webSocketUrl, targetUrl }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  // CDP 연결 함수
  const connectToCDP = async () => {
    if (!webSocketUrl) {
      console.log('No WebSocket URL provided');
      return;
    }

    setConnectionStatus('connecting');

    try {
      // 일렉트론에서 CDP 연결
      if (window.electronAPI) {
        const result = await window.electronAPI.connectToCDP(webSocketUrl);
        if (result.success) {
          setConnectionStatus('connected');
          console.log('CDP connected successfully');
        } else {
          setConnectionStatus('disconnected');
          console.error('CDP connection failed:', result.error);
        }
      }
    } catch (err) {
      setConnectionStatus('disconnected');
      console.error('CDP connection error:', err);
    }
  };

  useEffect(() => {
    const loadDevTools = async () => {
      try {
        if (iframeRef.current) {
          const iframe = iframeRef.current;

          // 일렉트론에서 파일 URL 사용
          const isElectron = window.electronAPI !== undefined;
          let devtoolsUrl: string;

          devtoolsUrl = '/devtools/front_end/devtools_app.html';

          // Add query parameters if provided
          const params = new URLSearchParams();

          // 웹소켓 연결 파라미터 (가장 중요)
          if (webSocketUrl) {
            // WebSocket URL에서 호스트와 포트 추출
            try {
              const wsUrl = new URL(webSocketUrl);
              // React Native의 경우 전체 WebSocket URL을 사용
              if (webSocketUrl.includes('inspector/debug')) {
                // React Native Inspector URL
                const wsParam = `${wsUrl.hostname}:${wsUrl.port || '8081'}`;
                params.append('ws', wsParam);
                console.log('React Native WebSocket parameter set:', wsParam);
              } else {
                // 일반적인 WebSocket URL
                const wsParam = `${wsUrl.hostname}:${wsUrl.port || '9222'}`;
                params.append('ws', wsParam);
                console.log('WebSocket parameter set:', wsParam);
              }
            } catch (error) {
              console.error('Invalid WebSocket URL:', error);
            }
          }

          if (targetUrl) {
            params.append('target', targetUrl);
          }

          // DevTools 설정 파라미터들
          params.append('experiments', 'true'); // 실험적 기능 활성화
          params.append('can_dock', 'false'); // 독립 창 모드
          params.append('isSharedWorker', 'false');
          params.append('v8only', 'false');
          params.append('remoteFrontend', 'true');

          // React Native 특화 파라미터들
          params.append('nodeFrontend', 'true');
          params.append('hasOtherClients', 'false');
          params.append('browserConnection', 'false');

          // 추가 연결 파라미터들
          params.append('panel', 'sources'); // 소스 패널 기본 선택
          params.append('debugFrontend', 'true'); // 디버그 프론트엔드 활성화

          // Elements Inspector 비활성화
          params.append('disableElements', 'true');
          params.append('hideElements', 'true');
          params.append('showElements', 'false');
          params.append('elementsPanel', 'false');
          params.append('disableDOM', 'true');
          params.append('hideDOM', 'true');

          // Device Mode/브라우저 미리보기 비활성화
          params.append('disableDeviceMode', 'true');
          params.append('hideDeviceMode', 'true');
          params.append('showDeviceMode', 'false');
          params.append('deviceMode', 'false');
          params.append('disableResponsive', 'true');
          params.append('hideResponsive', 'true');
          params.append('showResponsive', 'false');
          params.append('responsive', 'false');
          params.append('disableEmulation', 'true');
          params.append('hideEmulation', 'true');
          params.append('showEmulation', 'false');
          params.append('emulation', 'false');

          if (params.toString()) {
            devtoolsUrl += `?${params.toString()}`;
          }

          console.log('Loading DevTools from:', devtoolsUrl);

          iframe.onload = () => {
            setIsLoading(false);
            setError(null);
            console.log('DevTools loaded successfully');

            // DevTools 로드 후 Elements 패널 숨기기
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                // Elements 패널 숨기기
                const elementsPanel = iframeDoc.querySelector('[data-panel-name="elements"]');
                if (elementsPanel) {
                  (elementsPanel as HTMLElement).style.display = 'none';
                }

                // Elements 탭 숨기기
                const elementsTab = iframeDoc.querySelector('[data-tab-id="elements"]');
                if (elementsTab) {
                  (elementsTab as HTMLElement).style.display = 'none';
                }

                // Elements 관련 UI 요소들 숨기기
                const elementsElements = iframeDoc.querySelectorAll(
                  '[data-panel-name*="elements"], [data-tab-id*="elements"]'
                );
                for (const el of elementsElements) {
                  (el as HTMLElement).style.display = 'none';
                }

                // Device Mode 툴바 숨기기
                const deviceModeElements = iframeDoc.querySelectorAll(
                  '[data-panel-name*="device"], [data-tab-id*="device"], [data-panel-name*="emulation"], [data-tab-id*="emulation"], [data-panel-name*="responsive"], [data-tab-id*="responsive"]'
                );
                for (const el of deviceModeElements) {
                  (el as HTMLElement).style.display = 'none';
                }

                // Device Mode 툴바 버튼들 숨기기
                const deviceModeButtons = iframeDoc.querySelectorAll(
                  '[title*="Toggle device"], [title*="device mode"], [title*="responsive"], [title*="emulation"]'
                );
                for (const el of deviceModeButtons) {
                  (el as HTMLElement).style.display = 'none';
                }
              }
            } catch (error) {
              console.log('Elements panel hiding failed (expected in some cases):', error);
            }

            // DevTools 로드 후 CDP 연결 시도
            if (webSocketUrl) {
              connectToCDP();
            }
          };

          iframe.onerror = () => {
            setIsLoading(false);
            setError('DevTools 로드에 실패했습니다.');
            console.error('Failed to load DevTools');
          };

          // iframe에 직접 HTML 내용을 설정
          if (isElectron) {
            try {
              let devtoolsUrl = './devtools/front_end/devtools_app.html';
              console.log('devtoolsUrl', devtoolsUrl);
              const params = new URLSearchParams();

              // React Native 디버깅을 위한 필수 파라미터들
              if (webSocketUrl) {
                // WebSocket URL에서 호스트와 포트 추출
                try {
                  const wsUrl = new URL(webSocketUrl);
                  // React Native의 경우 전체 WebSocket URL을 사용
                  if (webSocketUrl.includes('inspector/debug')) {
                    // React Native Inspector URL
                    const wsParam = `${wsUrl.hostname}:${wsUrl.port || '8081'}`;
                    params.append('ws', wsParam);
                    console.log('React Native WebSocket parameter set:', wsParam);
                  } else {
                    // 일반적인 WebSocket URL
                    const wsParam = `${wsUrl.hostname}:${wsUrl.port || '9222'}`;
                    params.append('ws', wsParam);
                    console.log('WebSocket parameter set:', wsParam);
                  }
                } catch (error) {
                  console.error('Invalid WebSocket URL:', error);
                }
              }
              if (targetUrl) {
                params.append('target', targetUrl);
              }

              // DevTools 설정 파라미터들
              params.append('experiments', 'true'); // 실험적 기능 활성화
              params.append('can_dock', 'false'); // 독립 창 모드
              params.append('isSharedWorker', 'false');
              params.append('v8only', 'false');
              params.append('remoteFrontend', 'true');

              // 브라우저 관련 기능 비활성화
              params.append('disableBrowserFeatures', 'true');
              params.append('disableExtensions', 'true');
              params.append('disableWebSecurity', 'true');
              params.append('disableSiteIsolationTrials', 'true');
              params.append('disableBackgroundNetworking', 'true');
              params.append('disableBackgroundTimerThrottling', 'true');
              params.append('disableClientSidePhishingDetection', 'true');
              params.append('disableComponentUpdate', 'true');
              params.append('disableDefaultApps', 'true');
              params.append('disableDomainReliability', 'true');
              params.append('disableFieldTrialConfig', 'true');
              params.append('disableHangMonitor', 'true');
              params.append('disableIpcFloodingProtection', 'true');
              params.append('disablePromptOnRepost', 'true');
              params.append('disableRendererBackgrounding', 'true');
              params.append('disableSyncPreference', 'true');
              params.append('disableTranslate', 'true');
              params.append('noFirstRun', 'true');
              params.append('noDefaultBrowserCheck', 'true');
              params.append('noSandbox', 'true');

              // React Native 특화 파라미터들
              params.append('nodeFrontend', 'true');
              params.append('hasOtherClients', 'false');
              params.append('browserConnection', 'false');

              // 추가 연결 파라미터들
              params.append('panel', 'sources'); // 소스 패널 기본 선택
              params.append('debugFrontend', 'true'); // 디버그 프론트엔드 활성화

              // Elements Inspector 비활성화
              params.append('disableElements', 'true');
              params.append('hideElements', 'true');
              params.append('showElements', 'false');
              params.append('elementsPanel', 'false');
              params.append('disableDOM', 'true');
              params.append('hideDOM', 'true');

              // Device Mode/브라우저 미리보기 비활성화
              params.append('disableDeviceMode', 'true');
              params.append('hideDeviceMode', 'true');
              params.append('showDeviceMode', 'false');
              params.append('deviceMode', 'false');
              params.append('disableResponsive', 'true');
              params.append('hideResponsive', 'true');
              params.append('showResponsive', 'false');
              params.append('responsive', 'false');
              params.append('disableEmulation', 'true');
              params.append('hideEmulation', 'true');
              params.append('showEmulation', 'false');
              params.append('emulation', 'false');

              if (params.toString()) {
                devtoolsUrl += `?${params.toString()}`;
              }

              console.log('devtoolsUrl', devtoolsUrl);

              iframe.src = devtoolsUrl;
            } catch (err) {
              console.error('Failed to load DevTools HTML:', err);
              iframe.src = devtoolsUrl;
            }
          } else {
            iframe.src = devtoolsUrl;
          }
        }
      } catch (err) {
        setIsLoading(false);
        setError('DevTools 초기화에 실패했습니다.');
        console.error('DevTools initialization error:', err);
      }
    };

    loadDevTools();
  }, [webSocketUrl, targetUrl]);

  // WebSocket URL이 변경될 때마다 재연결
  useEffect(() => {
    if (webSocketUrl && connectionStatus === 'disconnected') {
      connectToCDP();
    }
  }, [webSocketUrl]);

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
      {/* 연결 상태 표시 */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          background:
            connectionStatus === 'connected'
              ? '#28a745'
              : connectionStatus === 'connecting'
              ? '#ffc107'
              : '#dc3545',
          color: 'white',
        }}
      >
        {connectionStatus === 'connected'
          ? '연결됨'
          : connectionStatus === 'connecting'
          ? '연결 중...'
          : '연결 안됨'}
      </div>

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          DevTools 로딩 중...
        </div>
      )}
      <iframe
        ref={iframeRef}
        title='Chrome DevTools'
        style={{
          border: 'none',
          width: '100vw',
          height: '100vh',
          display: isLoading ? 'none' : 'block',
        }}
      />
    </div>
  );
};

export default DevTools;
