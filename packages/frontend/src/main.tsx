import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App'
import { init } from '@getalby/bitcoin-connect-react'

init({ appName: 'Stacktris' })

window.addEventListener('gamepadconnected', (e) => console.log('[gamepad] connected:', e.gamepad));
window.addEventListener('gamepaddisconnected', (e) => console.log('[gamepad] disconnected:', e.gamepad));
console.log('[gamepad] on load:', navigator.getGamepads());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
