import { injectTags } from "../daydreams/packages/core/src/core/utils";
import { env } from "./env";
import { Chains } from "../daydreams/packages/core/src/";
import { Providers } from "../daydreams/packages/core/src";
import manifest from "./manifest.json";
import { Contract, RpcProvider, type Abi } from "starknet";
import { balance_query, auction_query, land_query } from "./querys";
import { type Balance } from "./types";

let provider = new RpcProvider({ nodeUrl: env.STARKNET_RPC_URL });
let abi = manifest.contracts[0].abi;

const address = env.STARKNET_ADDRESS;

const ponzilandAddress = '0x1f058fe3a5a82cc12c1e38444d3f9f3fd3511ef4c95851a3d4e07ad195e0af6';
const estarkAddress = '0x71de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0';
const ebrotherAddress = '0x7031b4db035ffe8872034a97c60abd4e212528416f97462b1742e1f6cf82afe';
const elordsAddress = '0x4230d6e1203e0d26080eb1cf24d1a3708b8fc085a7e0a4b403f8cc4ec5f7b7b';
const epaperAddress = '0x335e87d03baaea788b8735ea0eac49406684081bb669535bb7074f9d3f66825'

// read abi of Test contract
const { abi: estarkAbi } = await provider.getClassAt(estarkAddress);
const { abi: ebrotherAbi } = await provider.getClassAt(ebrotherAddress);
const { abi: elordsAbi } = await provider.getClassAt(elordsAddress);
const { abi: epaperAbi } = await provider.getClassAt(epaperAddress);

const estarkContract = new Contract(estarkAbi, estarkAddress, provider);
const ebrotherContract = new Contract(ebrotherAbi, ebrotherAddress, provider);
const elordsContract = new Contract(elordsAbi, elordsAddress, provider);
const epaperContract = new Contract(epaperAbi, epaperAddress, provider);

if (estarkAbi === undefined) {
  throw new Error('no abi.');
}

export const getBalances = async () => {
  let estarkBalance: string = (await estarkContract.call("balanceOf", [address])).toString();
  let ebrotherBalance: string = (await ebrotherContract.call("balanceOf", [address])).toString();
  let elordsBalance: string = (await elordsContract.call("balanceOf", [address])).toString();
  let epaperBalance: string = (await epaperContract.call("balanceOf", [address])).toString();
  let estarkApproved: string = (await estarkContract.call("allowance", [address, ponzilandAddress])).toString();
  let ebrotherApproved: string = (await ebrotherContract.call("allowance", [address, ponzilandAddress])).toString();
  let elordsApproved: string = (await elordsContract.call("allowance", [address, ponzilandAddress])).toString();
  let epaperApproved: string = (await epaperContract.call("allowance", [address, ponzilandAddress])).toString();

  return `

  Token Addresses
  estark: ${estarkAddress}
  ebrother: ${ebrotherAddress}
  elords: ${elordsAddress}
  epaper: ${epaperAddress}

  Token Balances
  estark: ${BigInt(estarkBalance)/BigInt(10**18)}
  ebrother: ${BigInt(ebrotherBalance)/BigInt(10**18)}
  elords: ${BigInt(elordsBalance)/BigInt(10**18)}
  epaper: ${BigInt(epaperBalance)/BigInt(10**18)}

  Already Approved For Ponziland
  estarkApproved: ${BigInt(estarkApproved)/BigInt(10**18)}
  ebrotherApproved: ${BigInt(ebrotherApproved)/BigInt(10**18)}
  elordsApproved: ${BigInt(elordsApproved)/BigInt(10**18)}
  epaperApproved: ${BigInt(epaperApproved)/BigInt(10**18)}
  `
}

const starknetChain = new Chains.StarknetChain({
  rpcUrl: env.STARKNET_RPC_URL,
  address: env.STARKNET_ADDRESS,
  privateKey: env.STARKNET_PRIVATE_KEY,
});


let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);


let initial_auctions: any = await Providers.fetchGraphQL(
  env.GRAPHQL_URL + "/graphql",
  auction_query,
  {}
).then((res: any) => res.ponziLandAuctionModels.edges.map((edge: any) => edge.node));

let initial_lands: any = await Providers.fetchGraphQL(
  env.GRAPHQL_URL + "/graphql",
  land_query,
  {}
).then((res: any) => res.ponziLandLandModels.edges.map((edge: any) => edge.node));

let block_time = await starknetChain.getBlockTime();

let balance_str = await getBalances();

let initial_prices = await Promise.all(initial_auctions.map((auction: any) => {
  let current_price = starknetChain.read(
      {
          contractAddress: ponzilandAddress,
          entrypoint: "get_current_auction_price",
          calldata: [auction.land_location]
      }
  ).then((res: any) => BigInt(res[0])/BigInt(10**18));
  return current_price;
}));

let land_info = await Promise.all(initial_lands.map((land: any) => {
  let info = ponziLandContract.call("get_neighbors_yield", [land.location]);
  return info;
}));

initial_lands.forEach((land: any, index: number) => {
  land.remaining_stake_time = BigInt(land_info[index].remaining_stake_time / BigInt(60)).toString();
}); 

/*
let remaining_stake = initial_lands.filter((land: any) => !initial_balances.some((balance: Balance) => {
  let remaining_stake = starknetChain.read(
      {
          contractAddress: '0x1f058fe3a5a82cc12c1e38444d3f9f3fd3511ef4c95851a3d4e07ad195e0af6',
          entrypoint: "get_remaining_stake",
          calldata: [land.location]
      }
  ).then((res: any) => BigInt(res[0])/BigInt(10**18));
  return remaining_stake;
}));


initial_lands.forEach((land: any, index: number) => {
  land.remaining_stake = remaining_stake[index];
});
*/

initial_auctions.forEach((auction: any, index: number) => {
  auction.current_price = initial_prices[index];
});

let auction_str = initial_auctions.map((auction: any) => 
  `location: ${BigInt(auction.land_location).toString()} - Current Price: ${auction.current_price}`).join("\n");

let land_str = initial_lands.map((land: any) => 
  `location: ${BigInt(land.location).toString()} - Remaining Stake Time: ${land.remaining_stake_time} minutes`).join("\n");



let PONZILAND_CONTEXT = `
You are a player of a game called Ponziland, a onchain game where you buy land with various ERC20 tokens on starknet.
The decision making in the game is entirely delegated to you, and you are entirely responsible for determining your own strategy and actions.

You then supply you land with a stake that gradually gets converted into taxes going to neighboring lands, while you collect the taxes from your neighbors.
You can supply the stake with any token, so you will want to choose one that will be the most effective based on what you want to achieve.

The auctions function as a reverse dutch auction where they start at a high price and then decrease until it reaches the floor price.
The bid amount will always be in estark and the amount will be transfered when called, the sale price in the bid call is the price it will be listed at after the auction.
Remember that if staking with eStrk you need to take that into account when bidding, as you will need the price + the stake + extra for gas.
When you call the bid function you will need to approve the token for the ponziland-actions contract for both estark and the token you are using to stake with.
Remember that all token values should be in wei, so x10^18.
If your lands are low on stake you can use the increase stake function to add more stake to the land, making sure to approve the token for the ponziland-actions contract.
The price of your land should be higher than the amount you paid for it, keeping in mind conversion rate between estark and the token it is listed for.

You should regulalaly monitor your lands stake and price relative to its neighbors, and keep an eye out for auctions and cheap lands.
<contract_addresses>
  - your address: 0x07480be1854e8464b85b7310d1f9602d810674e2bc43a3d73a168c816a2bbd8a
  - ponziland-actions: 0x1f058fe3a5a82cc12c1e38444d3f9f3fd3511ef4c95851a3d4e07ad195e0af6
  
</contract_addresses>

<state>

Here is a snapshot of the current state of the game: 
If the information you need is not here then you can query the graphql api for more information.

Here are your token balances. Remember that when spending tokens all values should be in wei, so x10^18: 

{{balances}}

Here are the active auctions (price in estark):

{{auctions}}

Here are the lands you own:

{{lands}}

</state>

<query>
  Only query if the included information is not sufficient.
</query>

<best_practices>
3. Always replace the <entity_id> with the actual entity_id.  
4. Use pagination for large result sets.
5. Include only necessary fields in your queries.
6. Handle null values appropriately.
</best_practices>

<import_query_context>
3. Include proper type casting in variables.
4. Follow the nested structure: Models → edges → node → specific type.
5. Only use the models listed in the AVAILABLE_MODELS section to query.
</import_query_context>

Remember to replace placeholders like <realm_id>, <entity_id>, <x>, <y>, and <model_name> with actual values when constructing queries.

Now, please wait for a user query about the game, and respond according to the steps outlined above.

</query_guide>

<API_GUIDE>

<IMPORTANT_RULES>
1. If you receive an error, you may need to try again, the error message should tell you what went wrong.
2. To verify a successful transaction, read the response you get back. You don't need to query anything.
3. Never include slashes in your calldata.
4. Remember all token values are in wei, so x10^18.
5. Make sure to approve the token for the ponziland-actions contract before bidding for all tokens and for the correct amount.
6. Remember you can call multiple functions in the same transaction, like approve and bid.
7. If there are no viable options, or the query does not require any action, 
</IMPORTANT_RULES>



  <FUNCTIONS>
  <APPROVE>
      <DESCRIPTION>
        Approves a token for the ponziland-actions contract.
      </DESCRIPTION>
      <PARAMETERS>
        - token_address: The address of the token to approve
        - amount: The amount to approve (in wei, so x10^18)
        Amount is u256, which in cairo means it has a high and low value and you must pass in a 0 as the low value.
        Make sure the token address is correct based on the graphql query.
        This should be called for both estark when bidding and any erc20 used for staking
        If staking with estark make sure to include the amount of estark you are using for the stake in the amount.

      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<token_address>",
            "entrypoint": "approve",
            "calldata": [
              <ponziland_actions_address>,
              <amount>,
              0
            ]
          }

      </EXAMPLE>
    </APPROVE>
    <INCREASE_PRICE>
      <DESCRIPTION>
        Increases the price of an auction.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to bid on
        - new_sell_price: The new sell price (in wei, so x10^18)

        Sell Price and Amount to Stake are u256, which in cairo means they have a high and low value and you must pass in a 0 as the low value.
        Make sure the land location is correct based on the graphql query.
        The sell price and the amount to stake should be about 10 to 100, but make sure you can afford the stake.
        Make sure you approve the token for the ponziland-actions contract before bidding.

      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "increase_price",
            "calldata": [
              <land_location>,         
              <new_sell_price>,
              0,
            ]
          }

      </EXAMPLE>
    </INCREASE_PRICE>
    <INCREASE_STAKE>
      <DESCRIPTION>
        Increases the stake on a land.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to bid on
        - new_stake: The new stake amount (in wei, so x10^18)

        New Stake is u256, which in cairo means it has a high and low value and you must pass in a 0 as the low value.
        Make sure the land location is correct based on the graphql query.
        The new stake amount is in the token already staked on the land.
        Must also call the approve function for the token you are using to stake with when calling this function.
      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "increase_stake",
            "calldata": [
              <land_location>,         
              <new_stake>,           
              0
            ]
          }

      </EXAMPLE>
    </INCREASE_STAKE>
    <BID>
      <DESCRIPTION>
        Bids on an auction.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to bid on
        - token_for_sale: Contract address of the token to bid with
        - sell_price: The price the land will be listed for after the auction ends (in wei, so x10^18)
        - amount_to_stake: The amount to be staked to pay the lands taxes (in wei, so x10^18)
        - liquidity_pool: The liquidity pool to be used for the stake

        Sell Price and Amount to Stake are u256, which in cairo means they have a high and low value and you must pass in a 0 as the low value.
        Make sure the land location is correct based on the graphql query.
        The sell price and the amount to stake should be about 10 to 100, but make sure you can afford the stake.
        Make sure you approve the token for the ponziland-actions contract before bidding.

      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "bid",
            "calldata": [
              <land_location>,         
              <sale_token_address>,           
              <sell_price>,
              0,
              <amount_to_stake>,
              0,
              <liquidity_pool>
            ]
          }

      </EXAMPLE>
    </BID>
  </FUNCTIONS>

  </API_GUIDE>

`;

export const CONTEXT = injectTags({
  balances: balance_str,
  auctions: auction_str,
  lands: land_str
}, PONZILAND_CONTEXT);

// API DOCs etc
export const PONZILAND_GUIDE = `

<PROVIDER_GUIDE>

</PROVIDER_GUIDE>
`;
