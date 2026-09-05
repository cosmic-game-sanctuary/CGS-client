import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ScrollManager } from '@/components/ScrollManager'
import { Catalog } from '@/routes/Catalog'
import { GameListing } from '@/routes/GameListing'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/game/:slug" element={<GameListing />} />
        {/* Not built yet — publish, player, studio, agent. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
