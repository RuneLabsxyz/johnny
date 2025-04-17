import { action } from "../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../fork/daydreams/packages/core/src"
import { Agent } from "../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { getBalances } from "../contexts/ponziland-context"
import { CallData } from "starknet";
import { getLiquidityPoolFromToken } from "../utils/liquidity_pools"
export const execute_transaction = (chain: StarknetChain) => action({
    name: "execute_transaction",
    description: "Execute a transaction on starknet",
    schema: z.object({
        calls: z.array(
            z.object({
                contractAddress: z
                    .string()
                    .describe(
                        "The address of the contract to execute the transaction on"
                    ),
                entrypoint: z
                    .string()
                    .describe("The entrypoint to call on the contract"),
                calldata: z
                    .array(z.union([z.number(), z.string()]))
                    .describe("The calldata to pass to the entrypoint. Remember for token values use wei values, so x10^18"),
        })
        .describe(
            "The payload to execute the call, never include slashes or comments"
        ),
    ).describe("Array of all calls to execute in transaction. Include all transactions here, instead of using this multiple times"),
    }),
    async handler(data, ctx, agent) {
        console.log('data', data);

        let res = [];
        for (let call of data.calls) {
            console.log('call', call);

            if (call.entrypoint == "bid" || call.entrypoint == "buy") {
                let pool = getLiquidityPoolFromToken(call.calldata[1] as string, call.calldata[6] as string);
                let key = call.calldata.pop();
                console.log('key', key);
                console.log('pool', pool);
                call.calldata.push(pool.token0);
                call.calldata.push(pool.token1);
                call.calldata.push(pool.fee as string);
                call.calldata.push(pool.tick_spacing as string);
                call.calldata.push(pool.extension);
            }
            let r = await chain.write(call);
            console.log('r', r);
            res.push(r);
        }

        return res;
    }
})