import type { PoolKey } from '../../../types';
import { env } from '../../../env';

export interface TokenPrice {
  symbol: string;
  address: string;
  ratio: number | null;
  best_pool: {
    token0: string;
    token1: string;
    fee: string;
    tick_spacing: number;
    extension: string;
  } | null;
}

export interface UserLookupResponse {
  ok: boolean;
  address?: string;
  error?: string;
}

export async function getAllTokensFromAPI(): Promise<TokenPrice[]> {
  const response = await fetch('https://api-sepolia.ponzi.land/price');
  return response.json();
}

export async function getLiquidityPoolFromAPI(tokenAddress: string): Promise<PoolKey | null> {
  try {
    const response = await fetch('https://api-sepolia.ponzi.land/price');
    const tokens: TokenPrice[] = await response.json();
    
    const token = tokens.find(t => {

      console.log('t.address', t.address.toString());
      console.log('tokenAddress', tokenAddress);
      console.log(BigInt(t.address.toString()) == BigInt(tokenAddress));

      return BigInt(t.address.toString()) == BigInt(tokenAddress);
    });

    console.log('token', token);

  


    if (!token || !token.best_pool) {
      return {
        token0: tokenAddress,
        token1: tokenAddress,
        fee: BigInt("0x20c49ba5e353f80000000000000000"),
        tick_spacing: "0x3e8",
        extension: "0"
      };
    }

    return {
      token0: token.best_pool.token0,
      token1: token.best_pool.token1,
      fee: BigInt(token.best_pool.fee),
      tick_spacing: token.best_pool.tick_spacing.toString(),
      extension: token.best_pool.extension
    };
  } catch (error) {
    console.error('Error fetching liquidity pool:', error);
    return null;
  }
} 

export async function lookupUserByProvider(
  provider: string, 
  username: string,
  baseUrl: string = 'https://socialink.ponzi.land'
): Promise<UserLookupResponse> {
  try {
    const url = new URL('/api/user/provider-lookup', baseUrl);
    url.searchParams.set('provider', provider);
    url.searchParams.set('username', username);

    const apiKey = env.SOCIALINK_API_KEY;
    
    if (!apiKey) {
      return {
        ok: false,
        error: 'API key not found in environment variables'
      };
    }

    // Use Bearer format like in the test
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    console.log('Request URL:', url.toString());
    console.log('Using API key:', apiKey.substring(0, 10) + '...');
    console.log('Authorization header:', headers.get('Authorization')?.substring(0, 20) + '...');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers
    });

    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return {
        ok: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data: UserLookupResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error looking up user:', error);
    return {
      ok: false,
      error: 'Network error or invalid response'
    };
  }
}

export async function getPoolByTokens(token0: string, token1: string): Promise<PoolKey | null> {
  try {
    const response = await fetch('https://api-sepolia.ponzi.land/price');
    const tokens: TokenPrice[] = await response.json();
    const token = tokens.find(t => t.address == token0 || t.address == token1);
    return token?.best_pool || null;
  } catch (error) {
    console.error('Error fetching pool:', error);
    return null;
  }
}