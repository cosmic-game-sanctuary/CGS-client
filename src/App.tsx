import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ScrollManager } from '@/components/ScrollManager'
import { Catalog } from '@/routes/Catalog'
import { GameListing } from '@/routes/GameListing'
import { InviteAccept } from '@/routes/InviteAccept'
import { Library } from '@/routes/Library'
import { NotFound } from '@/routes/NotFound'
import { Player } from '@/routes/Player'
import { Publish } from '@/routes/Publish'
import { Studio } from '@/routes/Studio'
import { StudioSetup } from '@/routes/StudioSetup'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/game/:slug" element={<GameListing />} />
        <Route path="/play/:slug" element={<Player />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/studio/new" element={<StudioSetup />} />
        <Route path="/studio/:id" element={<Studio />} />
        <Route path="/library" element={<Library />} />
        {/* Where an emailed invite lands. Reachable signed out, like everything
            else; signing in is only asked for at the point of claiming. */}
        <Route path="/invite/:id" element={<InviteAccept />} />
        {/* Price triggers live on the game listing, not a page of their own.
            Still unbuilt: swipe discovery. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
