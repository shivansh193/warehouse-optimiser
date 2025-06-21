
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://shivanshkalra796:kq1UNYNnAwtZjxYm@wms.4btredb.mongodb.net/?retryWrites=true&w=majority&appName=WMS";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

const connectDB = async () => {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 }); // Pinging admin db is common
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Set the db instance. Extract database name from URI or use a default.
    // Example: mongodb://localhost:27017/warehouseOptimizerDB -> warehouseOptimizerDB
    const dbName = uri.split('/').pop().split('?')[0] || 'warehouseOptimizerDB';
    db = client.db(dbName);
    console.log(`Connected to database: ${dbName}`);

  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized! Call connectDB first.');
  }
  return db;
};

module.exports = { connectDB, getDB };