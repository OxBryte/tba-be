import { Router } from "express";
import { TokenService } from "../services/tokenServices";

const router = Router();
const tokenService = new TokenService();

// GET /api/v1/token - Get all tokens
router.get("/token", async (req, res) => {
  try {
    const tokens = await tokenService.getAllTokens();
    res.json({
      success: true,
      data: tokens,
      count: tokens.length,
    });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tokens",
    });
  }
});
// GET /api/v1/token/:address - Get token by address
router.get("/token/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const token = await tokenService.getTokenByAddress(address);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }

    res.json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch token",
    });
  }
});

export { router as tokenRouter };
