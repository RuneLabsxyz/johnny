import { action, type ActionSchema } from "../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../fork/daydreams/packages/defai/src"
import type { Agent } from "../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { get_balances_str } from "../utils/querys"
import {
    executeSwap as executeAvnuSwap,
    fetchQuotes
} from "@avnu/avnu-sdk";

import { env } from "../../../env"
import { getAllTokensFromAPI } from "../utils/ponziland_api"
import { trimLeadingZeros } from "../utils/utils"

export const swap = (chain: StarknetChain) => action({
    name: "swap",
    description: "Swap tokens using AVNU SDK. Always make sure to check your balances first and use the correct token addresses. Remeber you don't need to already own any of the token you are buying, just the token you are selling.",
    schema: z.object({
        selling_address: z.string().describe("Token address you are selling"),
        buying_address: z.string().describe("Token address you are buying"),
        amount: z.string().describe("Amount of token to sell. Remeber 1 token = 10^18. Always use the scaled up value. This amount should NEVER be <10^18, unles you are swapping less than a single token."),
    }),
    async handler(data: { selling_address: string; buying_address: string; amount: string }, ctx: any, agent: Agent) {

        let tokens = await getAllTokensFromAPI();

        if (data.selling_address == data.buying_address) {
            throw new Error("You cannot swap the same token");
        }

        let token_selling = tokens.find(t => BigInt(trimLeadingZeros(t.address)) == BigInt(trimLeadingZeros(data.selling_address)));
        let token_buying = tokens.find(t => BigInt(trimLeadingZeros(t.address)) == BigInt(trimLeadingZeros(data.buying_address)));

        console.log('token_in', token_selling);
        console.log('token_out', token_buying);

        if (!token_selling || !token_buying) {
            throw new Error("Token not found");
        }

        try {
            // Convert amount to proper format (assuming 18 decimals for most tokens)
            const sellAmount = BigInt(data.amount);
            let pool = token_buying.best_pool;

            if (!pool) {
                pool = {
                    token0: token_selling.address,
                    token1: token_buying.address,
                }
            }

            const quoteParams = {
                sellTokenAddress: pool.token0,
                buyTokenAddress: pool.token1,
                sellAmount: sellAmount,
            };

            console.log('Fetching quotes with params:', quoteParams);

            let baseUrl = env.AVNU_BASE_URL;
            // Fetch quotes from AVNU
            const quotes = await fetchQuotes(quoteParams);

            const bestQuote = quotes[0];

            console.log('Executing swap with AVNU SDK...');

            console.log('bestQuote', bestQuote);

            // Execute the swap using AVNU SDK with the chain's account
            const swapResult = await executeAvnuSwap(chain.account, bestQuote, {});

            console.log('Swap executed successfully:', swapResult);

            const result = {
                success: true,
                transaction_hash: swapResult.transaction_hash,
                sell_token: token_selling.symbol,
                buy_token: token_buying.symbol,
                sell_amount: data.amount,
                buy_amount: bestQuote.buyAmount,
                quote_id: bestQuote.quoteId,
                message: `Successfully swapped ${data.amount} ${token_selling.symbol} for ${bestQuote.buyAmount} ${token_buying.symbol}`
            };

            return result;

        } catch (error) {
            console.error('Swap failed:', error);
            throw new Error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
})
