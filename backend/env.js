// Loading dotenv here, in its own file, guarantees it runs before any other
// module's top-level code - as long as this is the FIRST import in
// server.js. In ES modules, every import statement is fully evaluated (in
// order, top to bottom) before the importing file's own code continues, so
// if this file is imported first, .env is loaded before config/cloudinary.js
// (or anything else) reads process.env at import time.
import dotenv from "dotenv";
dotenv.config();