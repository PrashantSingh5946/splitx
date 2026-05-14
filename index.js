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

//Middlewares
app.use(
  cors({
    origin: true, // allow all origins in development
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
