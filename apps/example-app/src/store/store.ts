import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';
import todoReducer from './todoSlice';
import './devToolsExtension'; // DevTools Extension 주입

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    todos: todoReducer,
  },
  devTools: {
    // React Native 환경에서 DevTools 설정
    name: 'React Native App',
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
