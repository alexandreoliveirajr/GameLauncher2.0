import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Library from './pages/Library'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App