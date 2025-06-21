import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Send, AlertTriangle, Loader2 } from 'lucide-react'; // Added Loader2 for loading state

// Define an API service function (or import it if you have a dedicated api.js)
// For now, defined inline for simplicity
async function createShopAPI(shopName: string, initialShelvesCount?: number, shelvesPerRow?: number) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'; // Ensure this is in your .env
  const response = await fetch(`${apiUrl}/api/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ shopName, initialShelvesCount, shelvesPerRow }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to create shop. Please try again.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json(); // Returns the created shop data (e.g., { _id, shopName, shelves, ... })
}


export default function CreateShopPage() {
  const [shopName, setShopName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('Shop name cannot be empty.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // You can pass default shelf counts or let the backend handle defaults
      const createdShop = await createShopAPI(shopName.trim(), 21, 3); // Example: 21 shelves, 3 per row
      
      console.log('Shop created:', createdShop);
      // Navigate to the warehouse dashboard for the newly created shop
      // The backend should return the shop's ID (e.g., createdShop._id)
      if (createdShop && createdShop._id) {
        navigate(`/warehouse/${createdShop._id}`);
      } else if (createdShop && createdShop.shopName) {
        // If backend returns shopName and your GET /api/shops/:identifier can find by name
        navigate(`/warehouse/${encodeURIComponent(createdShop.shopName)}`);
      }
      else {
        // Fallback or error if ID is not returned
        console.error("Shop created but ID missing in response", createdShop);
        setError("Shop created, but couldn't navigate. Please check your shops list.");
        // Potentially navigate to a generic dashboard or shop list page
      }

    } catch (err: any) {
      console.error('Failed to create shop:', err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 3}s` }}/>
        ))}
      </div>

      <div className="relative w-full max-w-md bg-slate-800/70 backdrop-blur-md rounded-xl shadow-2xl p-8 border border-slate-700">
        <div className="text-center mb-8">
          <Building className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-100">Name Your Warehouse</h1>
          <p className="text-slate-400 mt-2">Let's get started by giving your new optimization space a name.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="shopName" className="block text-sm font-medium text-slate-300 mb-1">
              Warehouse Name
            </label>
            <input
              type="text"
              id="shopName"
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                if (error) setError(null); // Clear error on typing
              }}
              placeholder="e.g., 'Main Distribution Hub' or 'My Awesome Store'"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || !shopName.trim()}
              className="w-full group px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg font-semibold text-lg transition-all duration-300 shadow-lg shadow-cyan-500/30 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Warehouse
                  <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
        <div className="mt-6 text-center">
            <button 
                onClick={() => navigate(-1)} // Go back to previous page
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                disabled={isLoading}
            >
                ← Or go back
            </button>
        </div>
      </div>
       <footer className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Warehouse Optimizer Pro.</p>
      </footer>
    </div>
  );
}