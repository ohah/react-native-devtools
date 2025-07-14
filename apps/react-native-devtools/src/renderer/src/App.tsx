import { Root } from '@redux-devtools/app';
import './globlas.css';
import DevTools from './components/DevTools';

function App() {
  return (
    <div className='flex flex-row h-dvh w-dvw'>
      <Root />
      <DevTools />
    </div>
  );
}

export default App;
