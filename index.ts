import type { PoolKey } from "@uniswap/v4-sdk";
import { publicClient } from "./chain";
import { UniswapV4ABI, UniswapV4PoolManager } from "./univ4";
import { loadData } from "./utils";
import { SqrtPriceMath, TickMath } from "@uniswap/v3-sdk";
import { formatUnits } from "viem";

const START_BLOCK_NUMBER = 32964917n;
const END_BLOCK_NUMBER = START_BLOCK_NUMBER + 400n;

const TBA_PAIRINGS = [
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "0x4200000000000000000000000000000000000006", // WETH
];

async function main() {
  const latestBlock = await publicClient.getBlockNumber();

  // Use latest block as starting point, or adjust as needed
  const startBlock = latestBlock - 1000n;
  const endBlock = latestBlock;

  const logs = await publicClient.getContractEvents({
    abi: UniswapV4ABI,
    address: UniswapV4PoolManager,
    fromBlock: START_BLOCK_NUMBER,
    toBlock: END_BLOCK_NUMBER,
    eventName: "Initialize",
  });

  const poolKeys = logs.map((log) => {
    return {
      currency0: log.args.currency0,
      currency1: log.args.currency1,
      fee: log.args.fee,
      tickSpacing: log.args.tickSpacing,
      hooks: log.args.hooks,
      blockNumber: log.blockNumber, // Add block number from the log
    };
  }) as (PoolKey & { blockNumber: bigint })[];

  // Create a cache for block timestamps to avoid duplicate requests
  const blockTimestampCache = new Map<bigint, bigint>();

  for (const key of poolKeys) {
    const pool = await loadData(key);

    const currency0Price = pool.currency0Price.toSignificant(6);
    const currency1Price = pool.currency1Price.toSignificant(6);

    let coinType: string | undefined;
    let appType = "ZORA";
    if (key.hooks === "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040") {
      coinType = "ZORA_CREATOR_COIN";
    } else if (key.hooks === "0x9ea932730A7787000042e34390B8E435dD839040") {
      coinType = "ZORA_V4_COIN";
    }
    // if it's not a zora coin, skip
    if (!coinType) continue;

    if (
      TBA_PAIRINGS.includes(pool.currency0.wrapped.address) ||
      TBA_PAIRINGS.includes(pool.currency1.wrapped.address)
    ) {
      appType = "TBA";
    }

    // Determine which currency is not in TBA_PAIRINGS
    let tokenCurrency;
    let price;

    if (TBA_PAIRINGS.includes(pool.currency0.wrapped.address)) {
      // Currency1 is the token we're interested in
      tokenCurrency = pool.currency1;
      price = currency1Price; // Price of currency1 in terms of currency0
    } else {
      // Currency0 is the token we're interested in
      tokenCurrency = pool.currency0;
      price = currency0Price; // Price of currency0 in terms of currency1
    }

    // Get block timestamp (with caching to avoid duplicate requests)
    let blockTimestamp: bigint;
    if (blockTimestampCache.has(key.blockNumber)) {
      blockTimestamp = blockTimestampCache.get(key.blockNumber)!;
    } else {
      const block = await publicClient.getBlock({
        blockNumber: key.blockNumber,
      });
      blockTimestamp = block.timestamp;
      blockTimestampCache.set(key.blockNumber, blockTimestamp);
    }

    const metadata = {
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
      blockNumber: key.blockNumber.toString(),
      timestamp: Number(blockTimestamp), // Unix timestamp in seconds
      timestampISO: new Date(Number(blockTimestamp) * 1000).toISOString(), // Human-readable ISO string
    };

    console.log(metadata);
  }
}

main();
