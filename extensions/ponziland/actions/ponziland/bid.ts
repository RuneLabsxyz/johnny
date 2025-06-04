import { action, type ActionSchema } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { z } from "zod"
import { type Abi, CallData, Contract, cairo } from "starknet";
import { type Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents } from "../../utils/utils";
import { env } from "../../../../env";
import { indexToPosition } from "../../utils/utils";


export const bid = (chain: StarknetChain) => action({
    name: "bid",
    description: "Bid on an auction",
    schema: z.object({
        land_location: z.string().describe("Location of the land to bid on"),
        token_for_sale: z.string().describe("The *Contract address* of the token to be used for the stake and new listing. This should usually be your team's token."),
        sell_price: z.string().describe("The price the land will be listed for after the auction ends (in wei, so x10^18)"),
        amount_to_stake: z.string().describe("The amount to be staked to pay the lands taxes (in wei, so x10^18)"),
    }) as ActionSchema,
    async handler(data, ctx, agent) {

        let calls = [];

        let manifest = env.MANIFEST;
        let estark_address = env.ESTARK_ADDRESS;
        let ponziland_address = env.MANIFEST.contracts[0].address;

        let token_balance = await chain.provider.callContract({
            contractAddress: data.token_for_sale,
            entrypoint: "balanceOf",
            calldata: [env.STARKNET_ADDRESS!]
        });
        let estark_balance = await chain.provider.callContract({
            contractAddress: estark_address,
            entrypoint: "balanceOf",
            calldata: [env.STARKNET_ADDRESS!]
        });

        let ponziLandContract = (new Contract(manifest.contracts[0].abi, ponziland_address, chain.provider)).typedv2(manifest.contracts[0].abi as Abi);

        let price = await ponziLandContract.get_current_auction_price(data.land_location);

        if (data.token_for_sale == estark_address) {
            let estark_call: Call = { contractAddress: estark_address, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(data.amount_to_stake + price) }) };
            calls.push(estark_call);
        }
        else {
            let estark_call: Call = { contractAddress: estark_address, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(price) }) };
            let stake_approve_call: Call = { contractAddress: data.token_for_sale, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(data.amount_to_stake) }) };
            calls.push(estark_call);
            calls.push(stake_approve_call);
        }


        let bid_call: Call = { contractAddress: ponziland_address, entrypoint: "bid", calldata: CallData.compile({ land_location: data.land_location, token_for_sale: data.token_for_sale, sell_price: cairo.uint256(data.sell_price), amount_to_stake: cairo.uint256(data.amount_to_stake) }) };

        calls.push(bid_call);


        let res = await chain.write(calls);

        return {res, str: "Bid on land " + Number(data.land_location) + " at " + indexToPosition(Number(data.land_location))[0] + "," + indexToPosition(Number(data.land_location))[1] };
    }
})