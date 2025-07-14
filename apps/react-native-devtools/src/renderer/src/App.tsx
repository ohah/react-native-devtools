import { Root } from '@redux-devtools/app';
import './globlas.css';
import DevTools from './components/DevTools';

function App() {
  return (
    <div className='App'>
      <div className='devtools-container'>
        <DevTools />
        <Root />
      </div>
    </div>
  );
}

export default App;
