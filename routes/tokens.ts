import { Router } from "express";
import { scanPools } from "../services/tokenServices";

const router = Router();

// GET /api/v1/token - Get all tokens
router.get("/", async (req, res) => {
  try {
    const tokens = await scanPools();
    console.log("Tokens fetched successfully:", tokens);
    res.json(tokens);
  } catch (err) {
    console.error("Token scan failed", err);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});
// // GET /api/v1/token/:address - Get token by address
// router.get("/token/:address", async (req, res) => {
//   try {
//     const { address } = req.params;
//     const token = await tokenService.getTokenByAddress(address);

//     if (!token) {
//       return res.status(404).json({
//         success: false,
//         error: "Token not found",
//       });
//     }

//     res.json({
//       success: true,
//       data: token,
//     });
//   } catch (error) {
//     console.error("Error fetching token:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch token",
//     });
//   }
// });

export { router as tokenRouter };
