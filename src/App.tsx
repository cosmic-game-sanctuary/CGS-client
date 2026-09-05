import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ScrollManager } from '@/components/ScrollManager'
import { Catalog } from '@/routes/Catalog'
import { GameListing } from '@/routes/GameListing'
import { Player } from '@/routes/Player'
import { Publish } from '@/routes/Publish'
import { Studio } from '@/routes/Studio'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/game/:slug" element={<GameListing />} />
        <Route path="/play/:slug" element={<Player />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/studio/:id" element={<Studio />} />
        {/* Not built yet — agent setup, library, swipe discovery. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
