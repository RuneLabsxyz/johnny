import { Provider, constants, provider, RpcProvider, GetTransactionReceiptResponse, ReceiptTx } from "starknet";
import type { GetTransactionReceiptResponse } from "starknet";
import { getAllTokensFromAPI } from "./ponziland_api";
import type { TokenPrice } from "./ponziland_api";

// Function to decode token transfer events
export async function decodeTokenTransferEvents(tx: GetTransactionReceiptResponse) {
  try {
    // Get transaction receipt
    const txReceipt: GetTransactionReceiptResponse = tx;

    if (!txReceipt.events) {
      return [];
    }

    const events = txReceipt.events;
    
    // Filter for transfer events (for ERC20 tokens)
    // ERC20 Transfer event has a specific key
    const transferEvents = events.filter((event: any) => {
      // The first element in the keys array is the event name hash
      // For ERC20 Transfer, it's the hash of "Transfer(address,address,uint256)"
      return event.keys[0] == "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
    });

    
    // Track token amounts by token address
    const tokenTotals: {[tokenAddress: string]: bigint} = {};
    
    // Process each transfer event
    for (const event of transferEvents) {
      // Skip transfer of stark for gas
      if (event.data[1] === "0x1176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8") {
        continue;
      }
      if (event.keys[0] !== "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9") {
        continue;
      }
      if (event.keys[2] !== "0xd29355d204c081b3a12c552cae38e0ffffb3e28c9dd956bee6466f545cf38a") {
        continue;
      }
      
      const tokenAddress = event.from_address;
      const amount = BigInt(event.data[0]);
      
      if (!tokenTotals[tokenAddress]) {
        tokenTotals[tokenAddress] = BigInt(0);
      }
      
      tokenTotals[tokenAddress] += amount;
    }
    // Get all token data
    const tokens = await getAllTokensFromAPI();
    
    // Format the results
    const results = Object.entries(tokenTotals).map(([tokenAddress, amount]) => {
      const tokenData = getTokenData(tokenAddress, tokens);
      return {
        token: tokenAddress,
        name: tokenData?.symbol || "Unknown Token",
        amount: formatTokenAmount(amount)
      };
    });

    console.log('tokenTotals', results);
    
    return results;
  } catch (error) {
    console.error("Error decoding events:", error);
    throw error;
  }
}

export const getTokenData = (tokenAddr: string | number, tokens: TokenPrice[]): TokenPrice | null => {
  for (const token of tokens) {
    if (BigInt(token.address) === BigInt(tokenAddr)) {
      return token;
    }
  }
  return null;
};

export const formatTokenAmount = (amount: bigint): string => {
  const divisor = BigInt(10 ** 18);
  
  // Handle negative values
  const isNegative = amount < 0n;
  const absoluteAmount = isNegative ? -amount : amount;
  
  const wholePart = absoluteAmount / divisor;
  const fractionalPart = absoluteAmount % divisor;
  
  // Convert fractional part to 4 decimal places
  const fractionalStr = fractionalPart.toString().padStart(18, '0');
  const decimalPlaces = fractionalStr.slice(0, 4);
  
  const result = `${wholePart}.${decimalPlaces}`;
  return isNegative ? `-${result}` : result;
};

// Grid width constant - adjust this value as needed
const GRID_WIDTH = 64; // You may need to adjust this value

export const indexToPosition = (index: number, gridWidth: number = GRID_WIDTH): [number, number] => {
  if (index < 0 || index >= gridWidth * gridWidth) {
    throw new Error("Index out of bounds");
  }

  const row = Math.floor(index / gridWidth);
  const col = index % gridWidth;

  return [col, row];
};

export const positionToIndex = (x: number, y: number, gridWidth: number = GRID_WIDTH): number => {
  return y * gridWidth + x;
};

export const trimLeadingZeros = (hexString: string): string => {
  // Return original string if not hex or too short
  if (!hexString.startsWith('0x') || hexString.length <= 2) {
    return hexString;
  }

  // Remove 0x, trim zeros, add 0x back
  const trimmed = hexString.slice(2).replace(/^0+/, '');
  
  // Handle case of all zeros
  if (trimmed.length === 0) {
    return '0x0';
  }

  return '0x' + trimmed;
};
