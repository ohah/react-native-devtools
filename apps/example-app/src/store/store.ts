import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';
import todoReducer from './todoSlice';
import '@ohah/react-native-devtools';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    todos: todoReducer,
  },
  devTools: {
    name: 'React Native App',
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
