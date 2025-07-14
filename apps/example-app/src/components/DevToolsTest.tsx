import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { increment, decrement, incrementByAmount } from '../store/counterSlice';
import { getDevToolsServer } from '../store/devToolsServer';

const DevToolsTest: React.FC = () => {
  const dispatch = useDispatch();
  const counter = useSelector((state: RootState) => state.counter.value);
  const [serverStatus, setServerStatus] = useState<string>('확인 중...');

  useEffect(() => {
    // DevTools 서버 상태 확인
    const checkServerStatus = () => {
      try {
        const server = getDevToolsServer();
        const status = server.getStatus();
        setServerStatus(`서버 실행 중: ${status.connections}개 연결`);
      } catch (error) {
        setServerStatus('서버 오류');
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleIncrement = () => {
    dispatch(increment());
    console.log('DevTools 테스트: increment 액션 디스패치됨');
  };

  const handleDecrement = () => {
    dispatch(decrement());
    console.log('DevTools 테스트: decrement 액션 디스패치됨');
  };

  const handleIncrementByAmount = () => {
    dispatch(incrementByAmount(5));
    console.log('DevTools 테스트: incrementByAmount 액션 디스패치됨');
  };

  const testDevToolsConnection = () => {
    try {
      // 전역 객체에서 DevTools Extension 확인
      const extension = (global as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
        .__REDUX_DEVTOOLS_EXTENSION__;
      if (extension) {
        console.log('✅ DevTools Extension이 성공적으로 주입되었습니다!');

        // 연결 테스트
        const connection = (extension as { connect: () => unknown }).connect();
        if (connection) {
          console.log('✅ DevTools 연결이 성공했습니다!');
          (connection as { init: (state: unknown) => void }).init({ test: 'DevTools 연결 테스트' });
        } else {
          console.log('❌ DevTools 연결에 실패했습니다.');
        }
      } else {
        console.log('❌ DevTools Extension이 주입되지 않았습니다.');
      }
    } catch (error) {
      console.error('DevTools 테스트 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Redux DevTools 테스트</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>DevTools 서버: {serverStatus}</Text>
      </View>

      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>카운터: {counter}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button title='+1' onPress={handleIncrement} />
        <Button title='-1' onPress={handleDecrement} />
        <Button title='+5' onPress={handleIncrementByAmount} />
      </View>

      <View style={styles.testContainer}>
        <Button title='DevTools 연결 테스트' onPress={testDevToolsConnection} color='#007AFF' />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>DevTools Extension이 제대로 작동하는지 확인하려면:</Text>
        <Text style={styles.infoText}>1. 브라우저에서 Redux DevTools Extension 설치</Text>
        <Text style={styles.infoText}>2. WebSocket 서버 실행 (포트 8000)</Text>
        <Text style={styles.infoText}>3. 위 버튼들을 눌러 액션 디스패치</Text>
        <Text style={styles.infoText}>4. DevTools에서 상태 변화 확인</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#2d5a2d',
    textAlign: 'center',
  },
  counterContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  testContainer: {
    marginBottom: 20,
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    lineHeight: 18,
  },
});

export default DevToolsTest;
