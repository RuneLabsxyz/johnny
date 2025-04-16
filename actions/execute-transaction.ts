import { action } from "../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../fork/daydreams/packages/core/src"
import { Agent } from "../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { getBalances } from "../contexts/ponziland-context"
import { CallData } from "starknet";
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
    handler(data, ctx, agent) {
        console.log('call', data);

        let i = 0;
        let calldata = CallData.compile(data.calls);

        for (let call of data.calls) {
            chain.write(call);
        }

        return data.calls;
    }
})