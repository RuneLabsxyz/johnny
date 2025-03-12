import { action } from "../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../fork/daydreams/packages/core/src"
import { ActionCall } from "../../fork/daydreams/packages/core/src"
import { Agent } from "../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { getBalances } from "../contexts/ponziland-context"


export const get_balances = (chain: StarknetChain) => action({
    name: "get-balances",
    description: "Get all of your starknet token balances",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo

       let balances = await getBalances();

        return balances

    }

})