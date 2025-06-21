// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db'); // Import connectDB
const shopRoutes = require('./routes/shopRoutes');

// Connect to Database
connectDB(); // Call the async function to establish connection

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Node.js backend! API is live. Using native MongoDB driver.' });
});

app.use('/api/shops', shopRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke on the server!');
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});