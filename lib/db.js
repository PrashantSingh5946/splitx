const mongoose = require("mongoose");
const { attachDatabasePool } = require("@vercel/functions");

// Cache the connection across serverless invocations so warm instances
// reuse the existing pool instead of opening a new one every request.
let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false, // fail fast if not connected — no silent queuing
      maxPoolSize: 10,       // cap connections per function instance
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next invocation retries the connection.
    cached.promise = null;
    throw err;
  }

  // Register with Vercel's pool manager so connections are properly
  // drained when a function suspends or is recycled.
  attachDatabasePool({
    close: () => mongoose.connection.close(),
  });

  console.log("MongoDB connected successfully");
  return cached.conn;
}

module.exports = connectDB;
