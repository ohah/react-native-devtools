import React, { useEffect, useRef, useState } from 'react'

interface DevToolsProps {
  webSocketUrl?: string
  targetUrl?: string
}

const DevTools: React.FC<DevToolsProps> = ({ webSocketUrl, targetUrl }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected')

  // CDP 연결 함수
  const connectToCDP = async () => {
    if (!webSocketUrl) {
      console.log('No WebSocket URL provided')
      return
    }

    setConnectionStatus('connecting')

    try {
      // 일렉트론에서 CDP 연결
      if (window.electronAPI) {
        const result = await window.electronAPI.connectToCDP(webSocketUrl)
        if (result.success) {
          setConnectionStatus('connected')
          console.log('CDP connected successfully')
        } else {
          setConnectionStatus('disconnected')
          console.error('CDP connection failed:', result.error)
        }
      }
    } catch (err) {
      setConnectionStatus('disconnected')
      console.error('CDP connection error:', err)
    }
  }

  useEffect(() => {
    const loadDevTools = async () => {
      try {
        if (iframeRef.current) {
          const iframe = iframeRef.current

          // 일렉트론에서 파일 URL 사용
          const isElectron = window.electronAPI !== undefined
          let devtoolsUrl: string

          if (isElectron) {
            // 일렉트론 환경에서는 절대 경로 사용
            const devtoolsPath = window.electronAPI.getDevToolsPath()
            devtoolsUrl = `file://${devtoolsPath}`
          } else {
            // 웹 환경에서는 상대 경로 사용
            devtoolsUrl = '/devtools/front_end/inspector.html'
          }

          // Add query parameters if provided
          const params = new URLSearchParams()
          if (webSocketUrl) {
            params.append('ws', webSocketUrl)
          }
          if (targetUrl) {
            params.append('target', targetUrl)
          }

          // DevTools 설정 파라미터들
          params.append('experiments', 'true') // 실험적 기능 활성화
          params.append('can_dock', 'false') // 독립 창 모드
          params.append('isSharedWorker', 'false')
          params.append('v8only', 'false')
          params.append('remoteFrontend', 'true')

          // React Native 특화 파라미터들
          params.append('nodeFrontend', 'false')
          params.append('hasOtherClients', 'false')
          params.append('browserConnection', 'false')

          if (params.toString()) {
            devtoolsUrl += `?${params.toString()}`
          }

          console.log('Loading DevTools from:', devtoolsUrl)

          iframe.onload = () => {
            setIsLoading(false)
            setError(null)
            console.log('DevTools loaded successfully')

            // DevTools 로드 후 CDP 연결 시도
            if (webSocketUrl) {
              connectToCDP()
            }
          }

          iframe.onerror = () => {
            setIsLoading(false)
            setError('DevTools 로드에 실패했습니다.')
            console.error('Failed to load DevTools')
          }

          // iframe에 직접 HTML 내용을 설정
          if (isElectron) {
            try {
              const htmlContent = await window.electronAPI.getDevToolsHTML()
              // DevTools URL에 필요한 파라미터들 추가
              let devtoolsUrl = './devtools/front_end/inspector.html'

              const params = new URLSearchParams()

              // React Native 디버깅을 위한 필수 파라미터들
              if (webSocketUrl) {
                params.append('ws', webSocketUrl)
              }
              if (targetUrl) {
                params.append('target', targetUrl)
              }

              // DevTools 설정 파라미터들
              params.append('experiments', 'true') // 실험적 기능 활성화
              params.append('can_dock', 'false') // 독립 창 모드
              params.append('isSharedWorker', 'false')
              params.append('v8only', 'false')
              params.append('remoteFrontend', 'true')

              // React Native 특화 파라미터들
              params.append('nodeFrontend', 'false')
              params.append('hasOtherClients', 'false')
              params.append('browserConnection', 'false')

              if (params.toString()) {
                devtoolsUrl += `?${params.toString()}`
              }

              iframe.src = devtoolsUrl
            } catch (err) {
              console.error('Failed to load DevTools HTML:', err)
              iframe.src = devtoolsUrl
            }
          } else {
            iframe.src = devtoolsUrl
          }
        }
      } catch (err) {
        setIsLoading(false)
        setError('DevTools 초기화에 실패했습니다.')
        console.error('DevTools initialization error:', err)
      }
    }

    loadDevTools()
  }, [webSocketUrl, targetUrl])

  // WebSocket URL이 변경될 때마다 재연결
  useEffect(() => {
    if (webSocketUrl && connectionStatus === 'disconnected') {
      connectToCDP()
    }
  }, [webSocketUrl])

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#dc3545',
          background: '#f8f9fa',
          borderRadius: '8px',
          margin: '1rem'
        }}
      >
        <h3>DevTools 로드 실패</h3>
        <p>{error}</p>
        <p>시도한 경로: /devtools/front_end/inspector.html</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* 연결 상태 표시 */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
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
          color: 'white'
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
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          DevTools 로딩 중...
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Chrome DevTools"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: isLoading ? 'none' : 'block'
        }}
      />
    </div>
  )
}

export default DevTools
