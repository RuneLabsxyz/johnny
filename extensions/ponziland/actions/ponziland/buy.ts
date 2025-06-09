import { action } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, CallData, Contract, cairo } from "starknet";
import { Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents, getTokenData } from "../../utils/utils";
import { env, getTokenAddress } from "../../../../env";
import { indexToPosition } from "../../utils/utils";
import view_manifest from "../../../../contracts/view_manifest_mainnet.json";

export const buy = (chain: StarknetChain) => action({
    name: "buy",
    description: "Buy a land or Bid on an auction",
    schema: z.object({
        land_location: z.string().describe("Location of the land to buy"),
        token_for_sale: z.string().describe("Contract address of the token to be used for the purchase. This should be a token in your wallet that you have enough of."),
        sell_price: z.string().describe("The price the land will be listed for after the auction ends (in wei, so x10^18)"),
        amount_to_stake: z.string().describe("The amount to be staked to pay the lands taxes (in wei, so x10^18)"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];

        let manifest = env.MANIFEST;

        let estark_address = env.ESTARK_ADDRESS;
        let ponziland_address = manifest.contracts[0].address;

        console.log(chain.provider)

        let ponziLandContract = (new Contract(manifest.contracts[0].abi, ponziland_address, chain.provider)).typedv2(manifest.contracts[0].abi as Abi);

        let viewContract = new Contract(view_manifest.contracts[0].abi, view_manifest.contracts[0].address, chain.provider);

        let land_or_auction = await viewContract.get_land_or_auction(data.land_location);


        console.log('land_or_auction', land_or_auction);
        console.log('land_or_auction', land_or_auction.activeVariant());
        console.log('land_or_auction', land_or_auction.unwrap());

        let land;
        let auction;
        let price;

        let agent_token = getTokenAddress();

        if (agent_token) {
            data.token_for_sale = agent_token;
        }

        let land_type = land_or_auction.activeVariant();

        if (land_type == "Land") {
            land = land_or_auction.unwrap();

            price = land.sell_price;
            if (land.token_used != data.token_for_sale) {
                let sale_approve_call = { contractAddress: land.token_used, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor(Number(price))) }) };
                let stake_approve_call = { contractAddress: data.token_for_sale, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor(Number(data.amount_to_stake))) }) };
                let buy_call = { contractAddress: ponziland_address, entrypoint: "buy", calldata: CallData.compile({ land_location: data.land_location, token_for_sale: data.token_for_sale, sell_price: cairo.uint256(price), amount_to_stake: cairo.uint256(data.amount_to_stake) }) };
                calls.push(sale_approve_call);
                calls.push(stake_approve_call);
                calls.push(buy_call);
            }
            if (land.token_used == data.token_for_sale) {
                let approve_call = { contractAddress: data.token_for_sale, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor(Number(price) + Number(data.amount_to_stake))) }) };
                let buy_call = { contractAddress: ponziland_address, entrypoint: "buy", calldata: CallData.compile({ land_location: data.land_location, token_for_sale: data.token_for_sale, sell_price: cairo.uint256(price), amount_to_stake: cairo.uint256(data.amount_to_stake) }) };
                calls.push(approve_call);
                calls.push(buy_call);
            }
        }
        else {
            auction = land_or_auction.unwrap();

            price = await ponziLandContract.get_current_auction_price(data.land_location);
            
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

            let bid_call = { contractAddress: ponziland_address, entrypoint: "bid", calldata: CallData.compile({ land_location: data.land_location, token_for_sale: data.token_for_sale, sell_price: cairo.uint256(price), amount_to_stake: cairo.uint256(data.amount_to_stake) }) };
            calls.push(bid_call);

        }

        let res = await chain.write(calls);

        return {res, str: "Bought land " + Number(data.land_location) + " at (" + indexToPosition(Number(data.land_location))[0] + "," + indexToPosition(Number(data.land_location))[1] + ")"};
    }
})