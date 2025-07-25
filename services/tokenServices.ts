// services/tokenService.ts
import type { PoolKey } from "@uniswap/v4-sdk";
import { publicClient } from "../config/chain";
import { UniswapV4ABI, UniswapV4PoolManager } from "../config/univ4";
import { loadData } from "../utils/utils";

export interface TokenMetadata {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  tick: number;
  sqrtPriceX96: string;
  price: string;
  coinType: string;
  appType: string;
}

export class TokenService {
  private readonly START_BLOCK_NUMBER = 32964917n;
  private readonly END_BLOCK_NUMBER = this.START_BLOCK_NUMBER + 1000n;
  private readonly TBA_PAIRINGS = [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0x4200000000000000000000000000000000000006", // WETH
  ];

  async getAllTokens(): Promise<TokenMetadata[]> {
    console.log("Fetching all tokens...");

    const logs = await publicClient.getContractEvents({
      abi: UniswapV4ABI,
      address: UniswapV4PoolManager,
      fromBlock: this.START_BLOCK_NUMBER,
      toBlock: this.END_BLOCK_NUMBER,
      eventName: "Initialize",
    });

    const poolKeys = logs.map((log) => ({
      currency0: log.args.currency0,
      currency1: log.args.currency1,
      fee: log.args.fee,
      tickSpacing: log.args.tickSpacing,
      hooks: log.args.hooks,
    })) as PoolKey[];

    console.log(`Found ${poolKeys.length} pools to process`);

    const tokens: TokenMetadata[] = [];

    for (let i = 0; i < poolKeys.length; i++) {
      const key = poolKeys[i];

      try {
        console.log(`Processing pool ${i + 1}/${poolKeys.length}...`);

        if (!key) {
          console.error(`Skipping undefined pool key at index ${i}`);
          continue;
        }

        const tokenMetadata = await this.processPool(key);
        if (tokenMetadata) {
          tokens.push(tokenMetadata);
        }
      } catch (error) {
        console.error(`Error processing pool ${i + 1}:`, error);
      }
    }

    return tokens;
  }

  async getTokenByAddress(address: string): Promise<TokenMetadata | null> {
    // For a single token, you might want to implement a more efficient lookup
    // This is a simple implementation that gets all tokens and filters
    const tokens = await this.getAllTokens();
    return (
      tokens.find(
        (token) => token.address.toLowerCase() === address.toLowerCase()
      ) || null
    );
  }

  private async processPool(key: PoolKey): Promise<TokenMetadata | null> {
    const pool = await loadData(key);

    const currency0Price = pool.currency0Price.toSignificant(6);
    const currency1Price = pool.currency1Price.toSignificant(6);

    let coinType: string | undefined;
    let appType = "ZORA";

    if (key?.hooks === "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040") {
      coinType = "ZORA_CREATOR_COIN";
    } else if (
      key &&
      key.hooks === "0x9ea932730A7787000042e34390B8E435dD839040"
    ) {
      coinType = "ZORA_V4_COIN";
    }

    // If it's not a zora coin, skip
    if (!coinType) return null;

    if (
      this.TBA_PAIRINGS.includes(pool.currency0.wrapped.address) ||
      this.TBA_PAIRINGS.includes(pool.currency1.wrapped.address)
    ) {
      appType = "TBA";
    }

    // Determine which currency is not in TBA_PAIRINGS
    let tokenCurrency;
    let price;

    if (this.TBA_PAIRINGS.includes(pool.currency0.wrapped.address)) {
      // Currency1 is the token we're interested in
      tokenCurrency = pool.currency1;
      price = currency1Price; // Price of currency1 in terms of currency0
    } else {
      // Currency0 is the token we're interested in
      tokenCurrency = pool.currency0;
      price = currency0Price; // Price of currency0 in terms of currency1
    }

    return {
      id: pool.poolId,
      name: tokenCurrency.name,
      symbol: tokenCurrency.symbol,
      decimals: tokenCurrency.decimals,
      address: tokenCurrency.wrapped.address,
      tick: pool.tickCurrent,
      sqrtPriceX96: pool.sqrtRatioX96.toString(),
      price: price,
      coinType,
      appType,
    };
  }
}