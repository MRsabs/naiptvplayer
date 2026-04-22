import { BrowserRouter, Route, Routes } from "react-router-dom";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import LiveTVView from "./views/LiveTVView";
import MoviesView from "./views/MoviesView";
import TVShowsView from "./views/TVShowsView";
import { UpdateNotification } from "./components/UpdateNotification";

export default function App() {
  return (
    <BrowserRouter>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<AccountsView />} />
        <Route path="/account/:id" element={<DashboardView />} />
        <Route path="/account/:id/livetv" element={<LiveTVView />} />
        <Route path="/account/:id/movies" element={<MoviesView />} />
        <Route path="/account/:id/tvshows" element={<TVShowsView />} />
      </Routes>
    </BrowserRouter>
  );
}
