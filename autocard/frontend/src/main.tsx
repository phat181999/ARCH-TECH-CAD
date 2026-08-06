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

// StrictMode double-invokes effects (mount→unmount→remount) to catch missing
// cleanup — useful in CI/production-readiness checks, but in local dev it
// spams the console with harmless noise (WS "closed before established",
// duplicate /analysis 404s, a caught-and-recovered WebGL "Context Lost" on
// the 3D <Canvas>) that looks like real bugs and slows down manual testing.
// Skip it while running the dev server; keep it for production builds.
const app = <App />;
createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? app : <StrictMode>{app}</StrictMode>,
)
