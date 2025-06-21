// src/App.jsx
import "./App.css"
import { Routes, Route, useNavigate } from 'react-router-dom'; // useNavigate added for potential programmatic nav
// import Navbar from './components/layout/Navbar'; // If you have a global navbar
import WarehouseLanding from './pages/HomePage';
import CreateShopPage from './pages/CreateShopPage'; // Import the new page
import WarehouseDashboardPage from './pages/WarehouseDashboardPage'; // Assuming you have this
import NotFoundPage from './pages/NotFoundPage'; // Assuming you have this

function App() {
  return (
    <>
      {/* <Navbar /> */} {/* Uncomment if you have a global navbar outside of specific pages */}
      {/* Removed the global container div from here, let pages manage their own full layout */}
      <Routes>
        <Route path="/" element={<WarehouseLanding />} />
        <Route path="/create-shop" element={<CreateShopPage />} /> {/* New Route */}
        <Route path="/warehouse/:shopIdentifier" element={<WarehouseDashboardPage />} /> {/* Changed to :shopIdentifier */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;