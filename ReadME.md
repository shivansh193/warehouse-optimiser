# Fulfillment Route Optimizer: Warehouse Simulator

## About The Project

This project has been created for the Software Engineering application for FilFlo. This is a fullfilment route optimizer, [problem statement 2], this basically highlights the circumstances of a warehouse, and has mock products, which can be arranged into a shelf as per the user likings, further the user gets an option to simulate multiple orders and find the most optimized route to fulfil the order in the least distance travelled, this primarily focuses on A* pathfinding algorithm and TSP heuristics. The current path finding is a little preliminary and is not as advanced as the algorithms I have created in the past. This project was created for demonstration purposes and holds no real value.



## My Approach & How It Works

The core idea is to provide a visual and interactive platform to understand warehouse logistics. My approach involved several key stages:

1.  **Warehouse Layout Design (Frontend):**
    *   Users can define the dimensions of their warehouse (width and height in grid units).
    *   A grid-based layout is generated where cells can represent aisles or "shelf blocks."
    *   Shelf blocks are designed to be back-to-back, meaning one grid cell representing a shelf block can house two logical shelves facing opposite directions (e.g., North into one aisle, South into another).
    *   Users can add or remove rows of these shelf blocks.

2.  **Item & Inventory Management (Frontend & Backend):**
    *   A predefined catalog of master items is available.
    *   Users can "stock" items onto specific facings of logical shelves. This involves selecting an item from the catalog and then clicking on a shelf face in the warehouse grid or using a detailed shelf view.
    *   All item placements and inventory levels are persisted in a MongoDB database via a Node.js/Express backend API.

3.  **Order Simulation (Frontend & Backend):**
    *   The system allows users to "open the shop for orders."
    *   Users can trigger the generation of random customer orders. The backend API creates these orders based on the master item catalog, assigning random items and quantities. These orders are stored in the database with a "pending pick" status.
    *   The frontend fetches and displays these pending orders, including a client-side check for item availability based on current inventory.

4.  **Route Optimization (Backend & Frontend):**
    *   Users select one or more pending orders for fulfillment.
    *   The frontend consolidates these orders into a single "picklist," identifying all unique items, their total quantities, and their locations (grid coordinates of the shelf block and the specific facing 'N' or 'S').
    *   This picklist is sent to a backend API endpoint (`/optimize-pick-route`).
    *   **Backend Optimization Logic:**
        *   The backend reconstructs the warehouse grid (aisles as walkable, shelf blocks as obstacles).
        *   It determines the aisle "access points" for each item in the picklist (the walkable grid cell in front of the specified shelf facing).
        *   It uses the **A\* (A-star) search algorithm** to calculate the shortest path cost (distance) between all relevant points (start, end, and all unique item access points), creating a distance matrix.
        *   It then applies a **Traveling Salesperson Problem (TSP) heuristic – currently Nearest Neighbor (NN)** – to determine the optimal *sequence* of visiting these item access points, starting from a designated entry point and finishing at an exit point.
        *   The full optimized path (a sequence of grid cell coordinates) is reconstructed by stitching together the A\* path segments for the determined TSP sequence.
        *   An "unoptimized" path is also calculated by visiting the pick locations in their original consolidated order.
        *   Metrics such as optimized distance, unoptimized distance, distance saved, and an estimated time saved are calculated.
    *   The backend responds with the coordinate arrays for both paths and the calculated metrics.

5.  **Path Visualization & Fulfillment (Frontend):**
    *   The frontend receives the path data.
    *   The `WarehouseFloorGrid` component visually highlights the cells belonging to the optimized path (e.g., in cyan) and the unoptimized path (e.g., in orange).
    *   Sequence numbers and pick location markers are displayed on the optimized path.
    *   A "Path Instructions Panel" provides a step-by-step textual guide for the optimized pick route.
    *   Estimated time and distance saved are displayed.
    *   Users can then conceptually "fulfill" the order, which updates the order status in the database. (Inventory decrement upon fulfillment is a key backend process).

## File Structure (Brief Overview)

The project is divided into two main directories:

*   **`warehouse-simulator-fe/` (Frontend - React with Vite)**
    *   `src/`
        *   `components/`: Reusable UI components (e.g., `ShelfDetailView.tsx`, `WarehouseFloorGrid.tsx`, `PathInstructionsPanel.tsx`).
            *   `fulfillment/`: Components related to order processing.
            *   `warehouse/`: Components for the grid display.
        *   `pages/`: Top-level components for each route (e.g., `RoomLayout.tsx`, `CreateShopPage.tsx`, `WarehouseLanding.tsx`).
        *   `interfaces/`: TypeScript type definitions (`types.ts`).
        *   `App.tsx`: Main application component with routing.
        *   `main.tsx`: Entry point.
*   **`warehouse-simulator-be/` (Backend - Node.js with Express)**
    *   `config/`: Database connection (`db.js`).
    *   `controllers/`: Request handling logic (`shopController.js`).
    *   `models/`: (If using Mongoose, schemas would be here. For native driver, this might be omitted or used for data structure validation helpers).
    *   `routes/`: API route definitions (`shopRoutes.js`).
    *   `utils/`: Utility functions, including pathfinding algorithms (`pathfinding.js` for A\*).
    *   `server.js`: Main Express server setup.
    *   `.env`: Environment variables (DB connection string, port).

## Technologies Used

*   **Frontend:**
    *   React (with TypeScript)
    *   Vite (Build tool & Dev Server)
    *   Tailwind CSS (Styling)
    *   Lucide React (Icons)
*   **Backend:**
    *   Node.js
    *   Express.js (Web framework)
    *   MongoDB (Database - using the native `mongodb` driver)
*   **Deployment (Example):**
    *   Frontend: Vercel
    *   Backend: Render.com (or similar Node.js hosting platform)
    *   Database: MongoDB Atlas (Cloud-hosted)

