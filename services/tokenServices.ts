// services/tokenService.ts
import type { PoolKey } from "@uniswap/v4-sdk";
import { publicClient } from "../config/chain";
import { UniswapV4ABI, UniswapV4PoolManager } from "../config/univ4";
import { loadData } from "../utils/utils";
const TBA_PAIRINGS = [
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "0x4200000000000000000000000000000000000006", // WETH
];

const START_BLOCK_NUMBER = 32964917n;
const END_BLOCK_NUMBER = START_BLOCK_NUMBER + 1000n;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scanPools(): Promise<any[]> {
  const logs = await publicClient.getContractEvents({
    abi: UniswapV4ABI,
    address: UniswapV4PoolManager,
    fromBlock: START_BLOCK_NUMBER,
    toBlock: END_BLOCK_NUMBER,
    eventName: "Initialize",
  });

  const poolKeys = logs.map((log) => ({
    currency0: log.args.currency0,
    currency1: log.args.currency1,
    fee: log.args.fee,
    tickSpacing: log.args.tickSpacing,
    hooks: log.args.hooks,
  })) as PoolKey[];

  const results = [];

  for (let i = 0; i < poolKeys.length; i++) {
    const key = poolKeys[i];

    try {
      if (!key) continue;
      const pool = await loadData(key);

      const currency0Price = pool.currency0Price.toSignificant(6);
      const currency1Price = pool.currency1Price.toSignificant(6);

      let coinType: string | undefined;
      let appType = "ZORA";
      if (key?.hooks === "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040") {
        coinType = "ZORA_CREATOR_COIN";
      } else if (key.hooks === "0x9ea932730A7787000042e34390B8E435dD839040") {
        coinType = "ZORA_V4_COIN";
      }
      if (!coinType) continue;

      if (
        TBA_PAIRINGS.includes(pool.currency0.wrapped.address) ||
        TBA_PAIRINGS.includes(pool.currency1.wrapped.address)
      ) {
        appType = "TBA";
      }

      let tokenCurrency;
      let price;

      if (TBA_PAIRINGS.includes(pool.currency0.wrapped.address)) {
        tokenCurrency = pool.currency1;
        price = currency1Price;
      } else {
        tokenCurrency = pool.currency0;
        price = currency0Price;
      }

      results.push({
        id: pool.poolId,
        name: tokenCurrency.name,
        symbol: tokenCurrency.symbol,
        decimals: tokenCurrency.decimals,
        address: tokenCurrency.wrapped.address,
        tick: pool.tickCurrent,
        sqrtPriceX96: pool.sqrtRatioX96.toString(),
        price,
        coinType,
        appType,
      });
    } catch (err) {
      console.error(`Error processing pool ${i}:`, err);
      await sleep(15000);
    }
  }

  return results;
}
