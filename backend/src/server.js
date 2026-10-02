import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 8000;

app.listen(PORT, () => {
  console.log(`Friend Shield API running on http://localhost:${PORT}`);
});