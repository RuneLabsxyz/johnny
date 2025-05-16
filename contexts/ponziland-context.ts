import { render } from "../../fork/daydreams/packages/core/src";
import { env } from "../env";
import { fetchGraphQL } from "../../fork/daydreams/packages/core/src";
import manifest from "../manifest.json";
import { BigNumberish, CairoCustomEnum, Contract, RpcProvider, type Abi } from "starknet";
import { balance_query, auction_query, land_query } from "../querys";
import { nuke_query } from "../querys";
import { getAllTokensFromAPI } from "../utils/ponziland_api";
import view_manifest from "../contracts/manifest_sepolia.json";

interface TokenPrice {
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

let provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
let abi = manifest.contracts[0].abi;

const address = process.env.STARKNET_ADDRESS!;

let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);
let viewContract = (new Contract(view_manifest.contracts[0].abi, view_manifest.contracts[0].address, provider)).typedv2(view_manifest.contracts[0].abi as Abi);
let ponzilandAddress = manifest.contracts[0].address;
let block_time = (await provider.getBlock()).timestamp;

const getTokenData = (tokenAddr: string | number, tokens: TokenPrice[]): TokenPrice => {
  for (const token of tokens) {
    if (BigInt(token.address) === BigInt(tokenAddr)) {
      return token;
    }
  }
  return null;
};

const calculateLandYield = async (land: any, tokens: TokenPrice[]) => {
  let token = getTokenData(land.token_used, tokens);
  let taxes = await ponziLandContract.getTaxRatePerNeighbor(land.location);
  console.log('taxes', taxes)
  let yield_per_second = taxes / (land.stake_duration * 60);
  return yield_per_second;
}

const formatTokenAmount = (amount: bigint): string => {
  const divisor = BigInt(10 ** 18);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  // Convert fractional part to 4 decimal places
  const fractionalStr = fractionalPart.toString().padStart(18, '0');
  const decimalPlaces = fractionalStr.slice(0, 4);
  
  return `${wholePart}.${decimalPlaces}`;
};

export const getBalances = async () => {
  // Retrieve balance and allowance info for each token via the contracts array.

  let tokens = await getAllTokensFromAPI();
  console.log('tokens', tokens)
  const balancesData = await Promise.all(
    tokens.map(async (token) => {
      let abi = await provider.getClassAt(token.address);
      let contract = new Contract(abi.abi, token.address, provider);
      const balance = await contract.call("balanceOf", [address]);
      const approved = await contract.call("allowance", [address, ponzilandAddress]);
      return {
        name: token.symbol,
        balance: BigInt(balance.toString()) / BigInt(10 ** 18),
        approved: BigInt(approved.toString()) / BigInt(10 ** 18),
        address: token.address,
      };
    })
  );

  // Build the display parts using token names.
  const tokenBalances = balancesData.map((t) => `<${t.name}> \n Balance: ${t.balance} \n Address: ${t.address} </${t.name}>`).join("\n\n\n");

  let res = `

  Token Balances:
  ${tokenBalances}

  `;
  console.log('res', res)
  return res;
};

export const get_nukeable_lands_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    nuke_query,
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  if (!lands) {
    return "there are no nukeable lands"
  }

  console.log('lands', lands)
  return lands;
}

export const get_lands_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query,
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  console.log('lands', lands)
  if (!lands) {
    return "You do not own any lands"
  }

  let nuke_time = await Promise.all(lands.map((land: any) => {
    let info = ponziLandContract.call("get_time_to_nuke", [land.location]);
    return info;
  }));

  let tokens = await getAllTokensFromAPI();
  

  let land_str = lands.map((land: any, index: number) => 
    `location: ${BigInt(land.location).toString()} - 
    Token: ${getTokenData(land.token_used, tokens).symbol}
    Remaining Stake Time: ${nuke_time[index]/BigInt(60)} minutes
  
    Listed Price: ${BigInt(land.sell_price).toString()}
  `).join("\n");

  console.log('land_str', land_str)
  return land_str;
}

export const get_claims_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query,
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  if (!lands) {
    return "You do not own any lands, so you have no claims"
  }

  let land_claims = await Promise.all(lands.map((land: any) => {
    return ponziLandContract.call("get_next_claim_info", [land.location]);
  }));

  console.log('land_claims', land_claims)

  let tokens = await getAllTokensFromAPI();

  // Flatten the claims data and format it
  let claims = lands.map((land: any, index: number) => {
    let landClaims = land_claims[index]
      .map((claim: any) => {
        // Find matching contract for the token
        for (let contract of tokens) {
          if (BigInt(claim.token_address) === BigInt(contract.address)) {
            return `    ${contract.symbol}: ${BigInt(claim.amount)}`;
          }
        }
        return '';
      })
      .filter((claim: any) => claim !== '')
      .join('\n');

    return `Land ${BigInt(land.location).toString()}:\n${landClaims}`;
  }).join('\n\n');


  console.log('claims_str', claims)

  return claims;
}

export const get_auctions_str = async () => {
  let auctions = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    auction_query,
    {}
  ).then((res: any) => res?.ponziLandAuctionModels?.edges?.map((edge: any) => edge?.node));

  if (!auctions) {
    return "There are no auctions"
  }

  let initial_prices = await Promise.all(auctions.map((auction: any) => {
    let current_price = provider.callContract(
        {
            contractAddress: ponzilandAddress,
            entrypoint: "get_current_auction_price",
            calldata: [auction.land_location]
        }
    ).then((res: any) => BigInt(res[0])/BigInt(10**18));
    return current_price;
  }));

  auctions.forEach((auction: any, index: number) => {
    auction.current_price = initial_prices[index];
  });
  
  let auction_str = auctions.map((auction: any) => 
    `location: ${BigInt(auction.land_location).toString()} - Current Price: ${auction.current_price}`).join("\n");

  return auction_str;
}

export const get_neighbors_str = async (location: number) => {

  let neighbors: Array<CairoCustomEnum> = await viewContract.get_neighbors(location);

  let tokens = await getAllTokensFromAPI();

  let res = neighbors.map((temp: CairoCustomEnum) => {
    if (temp.activeVariant() == "Land"){
      let neighbor = temp.unwrap();
      return `Location: ${BigInt(neighbor.location).toString()} - Sell Price: ${BigInt(neighbor.sell_price).toString()} - Token: ${getTokenData(neighbor.token_used, tokens).symbol}`;
    } else if (temp.activeVariant() == "Auction") {
      let neighbor = temp.unwrap();
      return `Location: ${BigInt(neighbor.land_location).toString()} - Auction`;
    }
    else {
      return ``
    }
  }).join("\n");

  console.log('get_all_lands_str', await get_all_lands_str());

  return res;
}

export const get_all_lands_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    "query { ponziLandLandModels(first: 50) { edges { node { location token_used sell_price owner } } } }",
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  let tokens = await getAllTokensFromAPI();

  lands = lands.filter((land: any) => land.owner != address);
  console.log('lands', lands)

  let land_str = lands.map((land: any) => ` Owner: ${land.owner} Location: ${BigInt(land.location).toString()} Token: ${getTokenData(land.token_used, tokens).symbol} sell price: ${formatTokenAmount(BigInt(land.sell_price))}`).join("\n");
  return land_str;
}

let balance_str = await getBalances();

let auction_str = await get_auctions_str();

let land_str = await get_lands_str();
let claims_str = await get_claims_str();
let nukeable_lands_str = await get_nukeable_lands_str();

/*
s contract before you can use them.

Remember that you want to build a bitcoin empire, so you should be staking lands with bitcoin and targeting
any neighboring lands to bitcoin lands so you can collect the taxes. You should only ever stake lands
with <10 BTC, and you should keep the sell price at 1 BTC.

*/
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
Remember that all lands can be bought for their listed sell price in their staked token

DO NOT continue to retry transactions that fail due to gas errors, just send an update with the error in discord.
DO NOT EVER TWEET ABOUT FAILED TRANSACTIONS OR HAVING GAS PROBLEMS.

NEVER TWEET ABOUT TRANSACTIONS APPROVING TOKENS, ONLY TWEET ABOUT BIDDING AND BUYING LANDS.

IF YOUR TRANSACTION FAILS, TRY TO APPROVE A LARGER AMOUNT OF THE TOKEN. ALSO MAKE SURE THE CORRECT TOKENS ARE BEING APPROVED FOR THE CORRECT AMOUNTS.

If a transaction fails and you are sending an update in the discord, be explicit about what the error is.
Never send a update about a failed transaction without any information about the error message

Don't tweet about increasing stake. Only tweet about leveling up with somthing like "my empire grows stronger"
PONZILAND_ACTIONS ADDRESS: 0x19b9cef5b903e9838d649f40a8bfc34fbaf644c71f8b8768ece6a6ca1c46dc0
YOUR Starknet ADDRESS: 0x00d29355d204c081b3a12c552cae38e0ffffb3e28c9dd956bee6466f545cf38a

Ponzilands website is https://ponzi.land and the twitter is @ponzidotland, so make sure to direct people to the right place if they ask how to play.
They just need to join the discord, get their cartridge controller ready, and get ready for the next tournament.

<balances>
  ${balance_str}
</balances>

<auctions>
  ${auction_str}
</auctions>

<lands>
  ${land_str}
</lands>

Here is a how you obtain the current state of the game: 
Remember all token balances are in wei, so the true value is 10^18 times the value in the state.
Remember that if you want to buy a land, you would query neighbors, and if you want to bid on an auction you would query auctions.
ALL LANDS CAN BE BOUGHT FOR THEIR LISTED SELL PRICE IN THEIR STAKED TOKEN

<IMPORTANT_RULES>
- DO NOT fetch auctions when a user wants to buy a land, only fetch neighbors.
- Buying a land is NOT AN AUCTION, it is a direct purchase into a neighboring land.
- Be careful to use the correct querys for the request, and only use querys that are relevant to the request.
</IMPORTANT_RULES>

<querys>
  owned-lands - returns the remaining stake, price, and token of all lands you own
  lands - returns data on all lands in Ponziland. Useful for scouting new lands to buy.
  claims - shows the claimable yield from all your lands
  neighbors - shows the neighbors of all your lands, including if they are nukeable and their sell price
  auctions - shows the current auction price of all auctions 
  nukeable_lands - shows all lands that are out of stake
</querys>

<API_GUIDE>

<IMPORTANT_RULES>
1. If you receive an error, you may need to try again, the error message should tell you what went wrong.
2. To verify a successful transaction, read the response you get back. You don't need to query anything.
3. Never include slashes in your calldata.
4. Remember all token values are in wei so, so remember that the amount used in function calls is the 10^18 * the value relative to the state.
5. Remember to be on the lookout for new lands to expand your empire. You can do this though the get_neighbors query
</IMPORTANT_RULES>


  </API_GUIDE>

`;

export const CONTEXT = render(PONZILAND_CONTEXT, {
  balances: balance_str,
  auctions: auction_str,
  lands: land_str,
  claims: claims_str,
  neighbors: get_neighbors_str(2020),
  nukeable_lands: nukeable_lands_str
});
