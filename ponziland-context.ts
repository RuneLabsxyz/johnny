import { render } from "../fork/daydreams/packages/core/src/";
import { env } from "./env";
import { fetchGraphQL } from "../fork/daydreams/packages/core/src/";
import manifest from "./manifest.json";
import { Contract, RpcProvider, type Abi } from "starknet";
import { balance_query, auction_query, land_query } from "./querys";
import { estimateNukeTime } from "./querys";
import { nuke_query } from "./querys";

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
let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);


let contracts = [
  {name: "estark", contract: estarkContract, address: estarkAddress},
  {name: "ebrother", contract: ebrotherContract, address: ebrotherAddress},
  {name: "elords", contract: elordsContract, address: elordsAddress},
  {name: "epaper", contract: epaperContract, address: epaperAddress},
]

if (estarkAbi === undefined) {
  throw new Error('no abi.');
}

let block_time = (await provider.getBlock()).timestamp;

// After the contracts array declaration, add a helper function to map a token address to its name:
const getTokenName = (tokenAddr: string | number): string => {
  for (const token of contracts) {
    if (BigInt(token.address) === BigInt(tokenAddr)) {
      return token.name;
    }
  }
  return tokenAddr.toString();
};

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
  const balancesData = await Promise.all(
    contracts.map(async (token) => {
      const balance = await token.contract.call("balanceOf", [address]);
      const approved = await token.contract.call("allowance", [address, ponzilandAddress]);
      return {
        name: token.name,
        balance: BigInt(balance.toString()) / BigInt(10 ** 18),
        approved: BigInt(approved.toString()) / BigInt(10 ** 18),
        address: address,
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
  ).then((res: any) => res.ponziLandLandModels.edges.map((edge: any) => edge?.node));
  console.log('lands', lands)
  return lands;
}

export const get_lands_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query,
    {}
  ).then((res: any) => res.ponziLandLandModels.edges.map((edge: any) => edge?.node));
  let land_info = await Promise.all(lands.map((land: any) => {
    let info = ponziLandContract.call("get_neighbors_yield", [land.location]);
    return info;
  }));
  let land_claims = await Promise.all(lands.map((land: any) => {
    return ponziLandContract.call("get_next_claim_info", [land.location]);
  }));
  
  lands.forEach((land: any, index: number) => {
    land.neighbors_info = land_info.map((land_info: any) => {
      return land_info.yield_info.map((info: any) => {
        return `
          location: ${info.location}
          token: ${info.token}
          sell_price: ${info.sell_price}
          per hour: ${info.per_hour}
          nukeable: ${info.nukeable}
        `;
      }).join("\n");
    });
    land.neighbor_number = land_claims[index].length;
    land.claims = land_claims[index].map((claim: any) => {
      let claims: any[] = [];
      for (let contract of contracts) {
        if (claim.token === contract.address) {
          land.claims += `${contract.name} (${claim.token}): ${claim.amount}\n`;
        }
      }
      return claims;
    });
    land.remaining_stake_time = estimateNukeTime(land.sell_price, land.stake_amount, land.neighbor_number);
    console.log('land.remaining_stake_time', land.remaining_stake_time)
  }); 

  let land_str = lands.map((land: any) => 
    `location: ${BigInt(land.location).toString()} - 
    Remaining Stake
    Amount: ${BigInt(land.stake_amount).toString()}
    Token: ${getTokenName(land.token_used)}
    Time: ${land.remaining_stake_time/60} minutes
  
    Listed Price: ${BigInt(land.sell_price).toString()}
  `).join("\n");
  return land_str;
}

export const get_claims_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query,
    {}
  ).then((res: any) => res.ponziLandLandModels.edges.map((edge: any) => edge?.node));

  let land_claims = await Promise.all(lands.map((land: any) => {
    return ponziLandContract.call("get_next_claim_info", [land.location]);
  }));

  console.log('land_claims', land_claims)

  // Flatten the claims data and format it
  let claims = lands.map((land: any, index: number) => {
    let landClaims = land_claims[index]
      .map((claim: any) => {
        // Find matching contract for the token
        for (let contract of contracts) {
          if (BigInt(claim.token_address) === BigInt(contract.address)) {
            return `    ${contract.name}: ${BigInt(claim.amount)}`;
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
  ).then((res: any) => res.ponziLandAuctionModels.edges.map((edge: any) => edge?.node));

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

export const get_neighbors_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query,
    {}
  ).then((res: any) => res.ponziLandLandModels.edges.map((edge: any) => edge?.node));
  let land_info = await Promise.all(lands.map((land: any) => {
    let info = ponziLandContract.call("get_neighbors_yield", [land.location]);
    return info;
  }));

  let neighbors = lands.map((land: any, index: number) => {
    let info = land_info[index];
    let neighbors = info.yield_info.map((yield_info: any) => {
      return yield_info;
    })
    return neighbors;
  })

  let neighbor_data = await Promise.all(neighbors.flat().map((info: any) => {
    return ponziLandContract.call("get_land", [info.location]);
  }))

  let flat_data = neighbor_data.flat();

  let res = neighbors.flat().map((neighbor: any, index: number) => {
    let yield_info = neighbor;
    let data = flat_data[index];
    console.log('data', data)
    console.log('address', BigInt(address))
    if (BigInt(data.owner) != BigInt(address)) {
      return `
        location: ${yield_info.location}
        token: ${getTokenName(yield_info.token)}
        sell_price: ${formatTokenAmount(yield_info.sell_price)}
        `;
    }
  }).join("\n");

  console.log('res', res)
  return res;
}

let neighbors_str = await get_neighbors_str();
let balance_str = await getBalances();

let auction_str = await get_auctions_str();

let land_str = await get_lands_str();
let claims_str = await get_claims_str();
let nukeable_lands_str = await get_nukeable_lands_str();
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

You should regulalaly monitor your lands stake and price relative to its neighbors, and keep an eye out for auctions and cheap lands.
<contract_addresses>
  - your address: 0x07480be1854e8464b85b7310d1f9602d810674e2bc43a3d73a168c816a2bbd8a
  - ponziland-actions: 0x1f058fe3a5a82cc12c1e38444d3f9f3fd3511ef4c95851a3d4e07ad195e0af6  
</contract_addresses>

<state>

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
  lands - returns the remaining stake, price, and token of all lands you own
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
5. Make sure to approve the token for the ponziland-actions contract before bidding for all tokens and for the correct amount.
6. Remember you can call multiple functions in the same transaction, like approve and bid, but only bid on one land at a time.
7. If you are going to nuke a land, make sure that you only nuke a single land in a transaction, and include nothing else.
8. You can bundle multiple claims together, or bundle approves with other transactions, but try to only do one thing at a time.
9. Remember that all lands can be bought for their listed sell price in their staked token, even if there is not an auction.
10. DO NOT CHECK AUCTIONS AGAIN IN RESPONSE TO A FAILED BID
</IMPORTANT_RULES>



  <FUNCTIONS>
  <APPROVE>
      <DESCRIPTION>
        Approves a token for the ponziland-actions contract.
      </DESCRIPTION>
      <PARAMETERS>
        - token_address: The address of the token to approve
        - amount: The amount to approve
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
    <CLAIM>
      <DESCRIPTION>
        Claims the yield from a land.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to bid on
      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "claim",
            "calldata": [
              <land_location>,         
            ]
          }

      </EXAMPLE>
    </CLAIM>
    <BUY_LAND>
      <DESCRIPTION>
        Buys a land.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to buy
        - token_for_sale: Contract address of the token to bid with
        - sell_price: The price the land will be listed for after the auction ends (in wei, so x10^18)
        - amount_to_stake: The amount to be staked to pay the lands taxes (in wei, so x10^18)
        - liquidity_pool: The liquidity pool to be used for the stake

        Sell Price and Amount to Stake are u256, which in cairo means they have a high and low value and you must pass in a 0 as the low value.
        Make sure the land location is correct based on the graphql query.
        The sell price and the amount to stake should be about 10 to 100 (*10^18), but make sure you can afford the stake.
        Make sure you approve the token for the ponziland-actions contract before bidding.
        Remember that you must approve the token that the land is listed for, which is not always estark.

      </PARAMETERS>
      <EXAMPLE>
    
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "buy",
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
    </BUY_LAND>
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
    <NUKE>
      <DESCRIPTION>
        Nukes a land that is out of stake.
      </DESCRIPTION>
      <PARAMETERS>
        - land_location: Location of the land to nuke
      </PARAMETERS>
      <EXAMPLE>
          {
            "contractAddress": "<ponziland-actions>",
            "entrypoint": "nuke",
            "calldata": [
              <land_location>,
            ]
          }

    </NUKE>
  </FUNCTIONS>

  <EXECUTE_TRANSACTION_INFORMATION>
    Remember that you can make multiple function calls in the same transaction.
    This means EXECUTE_TRANSACTION should only ever be called once per output, and should include all calls as an array.
    You should keep calls to a minimum, and only try to do one thing at a time. 
    If you include multiple transactions that spend tokens, make sure to approve enough for all of them
  </EXECUTE_TRANSACTION_INFORMATION>

  </API_GUIDE>

`;

export const CONTEXT = render(PONZILAND_CONTEXT, {
  balances: balance_str,
  auctions: auction_str,
  lands: land_str,
  neighbors: neighbors_str,
  claims: claims_str,
  nukeable_lands: nukeable_lands_str
});

// API DOCs etc
export const PONZILAND_GUIDE = `

<PROVIDER_GUIDE>

</PROVIDER_GUIDE>
`;
