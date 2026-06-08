import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Silence third-party deprecation warnings (e.g., from older R3F matching new ThreeJS)
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === "string") {
    if (
      args[0].includes("THREE.Clock: This module has been deprecated") ||
      args[0].includes("THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated")
    ) {
      return;
    }
  }
  originalWarn(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
