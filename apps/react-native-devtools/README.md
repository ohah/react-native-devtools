# React Native DevTools

React Native 앱을 위한 일렉트론 기반 디버깅 도구입니다. Chrome DevTools를 통합하여 React Native 앱의 디버깅, 프로파일링, 네트워크 모니터링 등을 지원합니다.

## 주요 기능

- 🚀 **Chrome DevTools 통합**: Chrome DevTools UI를 일렉트론 내에서 iframe으로 표시
- 🔌 **Chrome DevTools Protocol (CDP) 지원**: React Native 앱과의 실시간 통신
- 🌐 **웹소켓 서버**: React Native Metro와의 연결 지원
- 🎯 **React Inspector**: React 컴포넌트 트리 검사
- 📊 **Redux DevTools**: Redux 상태 관리 디버깅
- 🔍 **네트워크 모니터링**: API 요청/응답 추적
- 📱 **디바이스 에뮬레이션**: 다양한 디바이스 환경 시뮬레이션

## 기술 스택

- **Electron**: 크로스 플랫폼 데스크톱 앱 프레임워크
- **Vite**: 빠른 빌드 도구
- **React**: UI 라이브러리
- **TypeScript**: 타입 안전성
- **Chrome DevTools Frontend**: 디버깅 UI
- **Chrome Remote Interface**: CDP 통신
- **WebSocket**: 실시간 통신

## 설치 및 실행

### 필수 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/ohah/react-native-devtools.git
cd react-native-devtools

# 의존성 설치
npm install
```

### 개발 모드 실행

```bash
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
```

## 사용법

1. **앱 시작**: `npm run dev`로 일렉트론 앱을 시작합니다.
2. **React Native 앱 연결**: React Native 앱에서 `ws://localhost:8081`로 웹소켓 연결을 설정합니다.
3. **디버깅 시작**: Chrome DevTools UI를 통해 앱을 디버깅합니다.

## 프로젝트 구조

```
react-native-devtools/
├── src/
│   ├── main/           # 일렉트론 메인 프로세스
│   ├── preload/        # 일렉트론 프리로드 스크립트
│   └── renderer/       # 렌더러 프로세스 (React 앱)
├── public/
│   └── devtools/       # Chrome DevTools 정적 파일
├── scripts/            # 유틸리티 스크립트
└── resources/          # 앱 리소스
```

## 설정

### 포트 설정

- **웹소켓 서버**: 8081 (React Native Metro 연결용)
- **Chrome DevTools**: 19000 (React Native 기본 디버거 포트)

### 환경 변수

```bash
# 개발 모드
NODE_ENV=development

# 프로덕션 모드
NODE_ENV=production
```

## 개발 가이드

### 새로운 기능 추가

1. `src/renderer/src/components/`에 새로운 컴포넌트 추가
2. `src/main/index.ts`에서 필요한 IPC 핸들러 추가
3. `src/preload/index.ts`에서 렌더러와 메인 프로세스 간 통신 설정

### Chrome DevTools 확장

1. `public/devtools/front_end/`에 새로운 DevTools 모듈 추가
2. CDP 프로토콜을 통해 새로운 디버깅 기능 구현

## 문제 해결

### 웹소켓 연결 실패

- React Native 앱이 올바른 포트(8081)로 연결하는지 확인
- 방화벽 설정 확인

### Chrome DevTools 로드 실패

- `public/devtools/front_end/` 경로가 올바른지 확인
- CSP 설정 확인

### CDP 연결 실패

- React Native 앱의 디버거 포트 확인
- 네트워크 연결 상태 확인

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 연락처

- 이슈 리포트: [GitHub Issues](https://github.com/your-username/react-native-devtools/issues)
- 이메일: bookyoon173@gamil.com
