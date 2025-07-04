import React, { useEffect, useRef, useState } from 'react';

interface DevToolsProps {
  webSocketUrl?: string;
}

const DevTools: React.FC<DevToolsProps> = ({ webSocketUrl }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  useEffect(() => {
    const fetchReactNativeTargets = async () => {
      try {
        // React Native Inspector에서 타겟 목록 가져오기
        const response = await fetch('http://localhost:8082/json');
        const targets = await response.json();
        console.log('React Native targets:', targets);

        // Hermes React Native 앱 찾기
        const experimentalTarget = targets.find(
          (target: { title: string; description: string }) =>
            target.title?.toLowerCase().includes('experimental') ||
            target.description?.toLowerCase().includes('experimental')
        );

        const hermesTarget = targets.find(
          (target: { vm: string; type: string }) => target.vm === 'Hermes' && target.type === 'node'
        );

        const selectedTarget = experimentalTarget || hermesTarget;

        if (selectedTarget) {
          console.log('Found Hermes target:', selectedTarget);
          const webSocketDebuggerUrl = selectedTarget.webSocketDebuggerUrl;

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

            // iframe 로드 후 자동 등록 스크립트 주입
            iframeRef.current.onload = () => {
              setIsLoading(false);

              // DevTools iframe에 자동 등록 스크립트 주입
              if (iframeRef.current?.contentWindow) {
                const autoSetupScript = `
                  // React Native Inspector 전용 설정
                  if (window.SDK && window.SDK.SDKModel) {
                    // RuntimeModel 자동 등록 (React Native에서 지원)
                    if (window.SDK.RuntimeModel) {
                      window.SDK.SDKModel.register(window.SDK.RuntimeModel, { 
                        capabilities: 4, 
                        autostart: true 
                      });
                    }
                    
                    // ConsoleModel 자동 등록 (React Native에서 지원)
                    if (window.SDK.ConsoleModel) {
                      window.SDK.SDKModel.register(window.SDK.ConsoleModel, { 
                        capabilities: 4, 
                        autostart: true 
                      });
                    }
                    
                    // NetworkModel 자동 등록 (React Native 0.74+ 지원)
                    if (window.SDK.NetworkManager) {
                      window.SDK.SDKModel.register(window.SDK.NetworkManager, { 
                        capabilities: 4, 
                        autostart: true 
                      });
                    }
                    
                    // LogModel 자동 등록 (React Native에서 지원)
                    if (window.SDK.LogModel) {
                      window.SDK.SDKModel.register(window.SDK.LogModel, { 
                        capabilities: 4, 
                        autostart: true 
                      });
                    }
                    
                    console.log('React Native 0.74+ DevTools models registered successfully');
                  }
                  
                  // React Native 0.74+ 지원 API 설정
                  if (window.Protocol && window.Protocol.InspectorBackend) {
                    const originalSend = window.Protocol.InspectorBackend.Connection.sendRawMessage;
                    window.Protocol.InspectorBackend.Connection.sendRawMessage = function(message) {
                      try {
                        const parsedMessage = JSON.parse(message);
                        
                        // React Native 0.74+에서 지원하지 않는 API들만 필터링
                        const unsupportedApis = [
                          'Debugger.setBlackboxPatterns',
                          'Debugger.setBlackboxedRanges'
                        ];
                        
                        if (parsedMessage.method && unsupportedApis.includes(parsedMessage.method)) {
                          console.log('Ignoring unsupported API call:', parsedMessage.method);
                          return; // API 호출 무시
                        }
                        
                        // Network API 요청들을 수동으로 처리
                        const networkApis = [
                          'Network.enable',
                          'Network.setAttachDebugStack',
                          'Network.clearAcceptedEncodingsOverride'
                        ];
                        
                        if (parsedMessage.method && networkApis.includes(parsedMessage.method)) {
                          console.log('Manually handling Network API request:', parsedMessage.method);
                          // 성공 응답 반환
                          const response = {
                            id: parsedMessage.id,
                            result: {}
                          };
                          window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify(response));
                          return;
                        }
                        
                        // 지원되는 API는 정상적으로 전송
                        return originalSend.call(this, message);
                      } catch (error) {
                        // JSON 파싱 실패 시 원래 함수 호출
                        return originalSend.call(this, message);
                      }
                    };
                    
                    // Network API 직접 활성화
                    const enableNetworkDirectly = () => {
                      console.log('Directly enabling Network API...');
                      
                      // Network.enable 직접 호출
                      const networkEnableMessage = {
                        id: Date.now(),
                        method: 'Network.enable',
                        params: {}
                      };
                      
                      // 성공 응답 시뮬레이션
                      setTimeout(() => {
                        const response = {
                          id: networkEnableMessage.id,
                          result: {}
                        };
                        window.Protocol.InspectorBackend.Connection.dispatch(JSON.stringify(response));
                        console.log('Network API enabled successfully');
                      }, 100);
                      
                      // 원래 메시지도 전송 (React Native Inspector가 처리할 수 있는 경우)
                      originalSend.call(window.Protocol.InspectorBackend.Connection, JSON.stringify(networkEnableMessage));
                    };
                    
                    // 즉시 실행
                    enableNetworkDirectly();
                  }
                  
                  // Network API 수동 활성화 (더 강력한 방법)
                  const enableNetworkAPI = () => {
                    if (window.Protocol && window.Protocol.InspectorBackend) {
                      console.log('Manually enabling Network API...');
                      
                      // Network.enable 요청
                      const networkEnableMessage = {
                        id: Date.now(),
                        method: 'Network.enable',
                        params: {}
                      };
                      window.Protocol.InspectorBackend.Connection.sendRawMessage(JSON.stringify(networkEnableMessage));
                      
                      // Network 패널 활성화
                      if (window.UI && window.UI.inspectorView) {
                        try {
                          window.UI.inspectorView.showPanel('network');
                          console.log('Network panel activated');
                        } catch (error) {
                          console.log('Network panel activation failed:', error);
                        }
                      }
                    }
                  };
                  
                  // 여러 번 시도 (DevTools 로딩 시간 고려)
                  setTimeout(enableNetworkAPI, 1000);
                  setTimeout(enableNetworkAPI, 2000);
                  setTimeout(enableNetworkAPI, 3000);
                  
                  // DevTools 완전 로드 후 다시 시도
                  window.addEventListener('load', () => {
                    setTimeout(enableNetworkAPI, 500);
                  });
                  
                  // CDP 메시지 처리
                  window.addEventListener('message', function(event) {
                    if (event.data.type === 'CDP_MESSAGE') {
                      if (window.Protocol && window.Protocol.InspectorBackend) {
                        window.Protocol.InspectorBackend.Connection.dispatch(event.data.data);
                      }
                    }
                  });
                `;

                // 스크립트를 iframe에 주입 (더 안전한 방법)
                try {
                  // 방법 1: postMessage로 스크립트 전달
                  if (iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                      {
                        type: 'INJECT_SCRIPT',
                        script: autoSetupScript,
                      },
                      '*'
                    );
                    console.log('React Native DevTools setup script sent via postMessage');
                  }
                } catch (error) {
                  console.error('Failed to send script via postMessage:', error);

                  // 방법 2: URL 파라미터로 설정 전달
                  console.log('Using URL parameters for DevTools configuration');
                }
              }
            };
          }
        } else {
          console.error('Hermes React Native target not found');
          console.log('Available targets:', targets);
          setError('React Native 앱을 찾을 수 없습니다. 앱이 실행 중인지 확인해주세요.');
        }
      } catch (error) {
        console.error('Failed to fetch React Native targets:', error);
        setError('React Native Inspector에 연결할 수 없습니다. 앱이 실행 중인지 확인해주세요.');
      }
    };

    fetchReactNativeTargets();
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
        {/* {connectionStatus === 'connected'
          ? '연결됨'
          : connectionStatus === 'connecting'
          ? '연결 중...'
          : '연결 안됨'} */}
      </div>

      {iframeRef.current?.src}

      {/* {isLoading && (
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
      )} */}
      <iframe
        ref={iframeRef}
        title='Chrome DevTools'
        style={{
          border: 'none',
          width: '100vw',
          height: '100vh',
          // display: isLoading ? 'none' : 'block',
        }}
      />
    </div>
  );
};

export default DevTools;
