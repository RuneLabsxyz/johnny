import type { PoolKey, Token } from '../types.ts';
import data from '../data.json';
import { toBigInt } from './bigint.ts';

const mainCurrency = data.availableTokens.find(
    (token) => token.symbol == data.mainCurrency,
  )!;
  
  export function getLiquidityPoolFromToken(address: string, liquidity_type: string): PoolKey {
    // Sort them from smallest to largest
    const tokens = [mainCurrency?.address, address].sort((a, b) =>
      Number(toBigInt(a)! - toBigInt(b)!),
    );

    console.log('tokens', tokens);
  
    const liquidityPoolType =
      liquidity_type as keyof typeof data.ekuboPositionType;
  console.log('liquidity_type', liquidity_type);
    const ekuboParameters = data.ekuboPositionType[liquidityPoolType]!;
    console.log('ekuboParameters', ekuboParameters);
    const result = {
      token0: tokens[0],
      token1: tokens[1],
      fee: ekuboParameters.fee,
      tick_spacing: ekuboParameters.tickSpacing,
      // We are not using the extension.
      extension: '0x0',
    };
    console.log('Data: ', result);
  
    return result;
  }