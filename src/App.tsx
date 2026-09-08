import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ScrollManager } from '@/components/ScrollManager'
import { Catalog } from '@/routes/Catalog'
import { GameListing } from '@/routes/GameListing'
import { InviteAccept } from '@/routes/InviteAccept'
import { Library } from '@/routes/Library'
import { Money } from '@/routes/Money'
import { Profile } from '@/routes/Profile'
import { ManageGame } from '@/routes/ManageGame'
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
        <Route path="/game/:slug/manage" element={<ManageGame />} />
        <Route path="/play/:slug" element={<Player />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/studio/new" element={<StudioSetup />} />
        <Route path="/studio/:id" element={<Studio />} />
        <Route path="/library" element={<Library />} />
        {/* What you earned, and the way out of the wallet. Its own page rather
            than a panel in the profile menu: a form that can send a whole
            balance to a typed address needs more room than a dropdown. */}
        <Route path="/money" element={<Money />} />
        <Route path="/u/:handle" element={<Profile />} />
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
