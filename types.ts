import { BigNumberish } from "starknet";
export interface PoolKey {
    token0: string;
    token1: string;
    fee: BigNumberish;
    tick_spacing: BigNumberish;
    extension: string;
  }
  

  export interface Token {
    liquidityPoolType: string;
    address: string;
  }