import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ClinicApp from './clinic/ClinicApp.jsx'
import { loadRecipes } from './data/recipes.js'

// The recipe corpus is dynamic-imported so it lands in its own Vite chunk
// rather than bloating the entry bundle. We await it before render so every
// downstream consumer can stay synchronous via getRecipes().
loadRecipes().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ClinicApp />
    </StrictMode>,
  )
})
