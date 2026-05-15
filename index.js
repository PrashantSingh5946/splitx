const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");
const connectDB = require("./lib/db");

//Route imports
const authRoute = require("./routes/AuthRoute");
const expenseRoute = require("./routes/ExpenseRoute");
const groupRoute = require("./routes/GroupRoute");
const userRoute = require("./routes/UserRoute");

const { PORT } = process.env;

// Fix #20: allowlist-based CORS instead of origin: true (which echoes any origin).
// Set ALLOWED_ORIGINS in your .env as a comma-separated list of trusted frontend URLs.
// e.g. ALLOWED_ORIGINS=https://app.example.com,exp://192.168.1.1:8081
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [
      "http://localhost:8081",   // Expo Metro bundler (web)
      "http://localhost:19006",  // Expo web (older)
      "http://localhost:3000",   // Next.js / CRA dev
    ];

//Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (no Origin header) and whitelisted origins.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Connect to MongoDB before handling any request.
// In serverless environments this is a no-op on warm instances (cached).
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(503).json({ message: "Database unavailable" });
  }
});

//Route handlers
app.use("/", authRoute);
app.use("/expenses", expenseRoute);
app.use("/groups", groupRoute);
app.use("/users", userRoute);

// In local / Docker dev, start the HTTP server.
// On Vercel the module.exports below is used instead.
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

module.exports = app;
