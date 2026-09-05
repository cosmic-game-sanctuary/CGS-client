import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ScrollManager } from '@/components/ScrollManager'
import { Catalog } from '@/routes/Catalog'
import { GameListing } from '@/routes/GameListing'
import { Player } from '@/routes/Player'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/game/:slug" element={<GameListing />} />
        <Route path="/play/:slug" element={<Player />} />
        {/* Not built yet — publish, studio, agent. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
