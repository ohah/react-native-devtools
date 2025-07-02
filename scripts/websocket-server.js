const WebSocket = require('ws')

// 웹소켓 서버 생성 (포트 8081)
const wss = new WebSocket.Server({ port: 8081 })

console.log('WebSocket server started on port 8081')

// 연결된 클라이언트들
const clients = new Set()

wss.on('connection', (ws, req) => {
  console.log('New client connected:', req.url)
  clients.add(ws)

  // 클라이언트에게 환영 메시지 전송
  ws.send(
    JSON.stringify({
      type: 'welcome',
      message: 'Connected to React Native DevTools WebSocket Server',
      timestamp: new Date().toISOString()
    })
  )

  // 메시지 수신 처리
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      console.log('Received message:', data)

      // 에코 응답
      ws.send(
        JSON.stringify({
          type: 'echo',
          original: data,
          timestamp: new Date().toISOString()
        })
      )
    } catch (error) {
      console.error('Error parsing message:', error)
    }
  })

  // 연결 해제 처리
  ws.on('close', () => {
    console.log('Client disconnected')
    clients.delete(ws)
  })

  // 에러 처리
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    clients.delete(ws)
  })
})

// 서버 에러 처리
wss.on('error', (error) => {
  console.error('WebSocket server error:', error)
})

console.log('WebSocket server is ready for connections')
console.log('Connect to: ws://localhost:8081')
