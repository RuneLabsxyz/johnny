import { render } from "../../../../fork/daydreams/packages/core/src";
import { fetchGraphQL } from "../../../../fork/daydreams/packages/core/src";
import { CairoCustomEnum, Contract, RpcProvider, type Abi } from "starknet";
import { balance_query, auction_query, land_query, query_lands_under_price } from "./gql";
import { getAllTokensFromAPI } from "../utils/ponziland_api";
import { getTokenData, formatTokenAmount, indexToPosition  } from "../utils/utils";
import { env, getTokenAddress } from "../../../env";

let manifest = env.MANIFEST;
let view_manifest = env.VIEW_MANIFEST;

let provider = new RpcProvider({ nodeUrl: env.STARKNET_RPC_URL });
let abi = manifest.contracts[0].abi;

const address = env.STARKNET_ADDRESS!;

let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);
let viewContract = (new Contract(view_manifest.contracts[0].abi, view_manifest.contracts[0].address, provider)).typedv2(view_manifest.contracts[0].abi as Abi);
let ponzilandAddress = manifest.contracts[0].address;
let block_time = (await provider.getBlock()).timestamp;



export const get_balances_str = async () => {
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

export const get_lands_str = async (address: string) => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query(address),
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  console.log(land_query)
  console.log('lands', lands)
  if (!lands) {
    return "You do not own any lands"
  }

  let tokens = await getAllTokensFromAPI();

  let nuke_time = await Promise.all(lands.map((land: any) => {
    let info = ponziLandContract.call("get_time_to_nuke", [land.location]);
    return info;
  }));

  let can_level_up = await Promise.all(lands.map((land: any) => {
    return viewContract.can_level_up(land.location);
  }));

  let yields = await Promise.all(lands.map(async (land: any) => {
    return await calculateLandYield(land, tokens);
  }));

  console.log('yields', yields)

  let coords = lands.map((land: any) => `(${indexToPosition(Number(land.location))[0]}, ${indexToPosition(Number(land.location))[1]})`)

  
  let land_str = "Here are your lands. Remember to only increase the stake of profitable lands, and to level up lands you can. \n \n" + lands.map((land: any, index: number) =>
    `location: ${BigInt(land.location).toString()} ${coords[index]} - 
    Token: ${getTokenData(land.token_used, tokens)?.symbol}
    Remaining Stake Time: ${nuke_time[index] / BigInt(60)} minutes
    
    Can Level Up: ${can_level_up[index]}

    Yield: ${yields[index]}
  
    Listed Price: ${BigInt(land.sell_price).toString()}
  `).join("\n");

  console.log('land_str', land_str)
  return land_str;
}

export const get_claims_str = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query(address),
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
    ).then((res: any) => BigInt(res[0]) / BigInt(10 ** 18));
    return current_price;
  }));

  auctions.forEach((auction: any, index: number) => {
    auction.current_price = initial_prices[index];
  });

  let coords = auctions.map((auction: any) => `(${indexToPosition(Number(auction.land_location))[0]}, ${indexToPosition(Number(auction.land_location))[1]})`)

  let auction_str = auctions.map((auction: any, index: number) =>
    `location: ${BigInt(auction.land_location).toString()} ${coords[index]} - Current Price: ${auction.current_price}`).join("\n");

  return auction_str;
}

export const get_neighbors_str = async (location: number) => {

  let neighbors: Array<CairoCustomEnum> = await viewContract.get_neighbors(location);

  let tokens = await getAllTokensFromAPI();

  let res = neighbors.map((temp: CairoCustomEnum) => {
    if (temp.activeVariant() == "Land") {
      let neighbor = temp.unwrap();
      let coords = `(${indexToPosition(Number(neighbor.location))[0]}, ${indexToPosition(Number(neighbor.location))[1]})`
      if (BigInt(neighbor.owner) != BigInt(address)) {
        return `Location: ${BigInt(neighbor.location).toString()} ${coords} - Sell Price: ${BigInt(neighbor.sell_price).toString()} - Token: ${getTokenData(neighbor.token_used, tokens)!.symbol}`;
      }
      else {
        return `Location: ${BigInt(neighbor.location).toString()} ${coords} - Sell Price: ${BigInt(neighbor.sell_price).toString()} - Token: ${getTokenData(neighbor.token_used, tokens)!.symbol} - Owner: ${neighbor.owner} (You)`;
      }
    } else if (temp.activeVariant() == "Auction") {
      let neighbor = temp.unwrap();
      let coords = `(${indexToPosition(Number(neighbor.land_location))[0]}, ${indexToPosition(Number(neighbor.land_location))[1]})` 
      return `Location: ${BigInt(neighbor.land_location).toString()} ${coords} - Auction`;
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

  lands = lands.filter((land: any) => (land.owner != address && BigInt(land.owner) != BigInt(0)));
  console.log('lands', lands)

  let coords = lands.map((land: any) => `(${indexToPosition(Number(land.location))[0]}, ${indexToPosition(Number(land.location))[1]})`)

  let land_str = lands.map((land: any, index: number) => ` Owner: ${land.owner} Location: ${BigInt(land.location).toString()} ${coords[index]} Token: ${getTokenData(land.token_used, tokens)!.symbol} sell price: ${formatTokenAmount(BigInt(land.sell_price))}`).join("\n");
  return land_str;
}

export const get_auction_yield_str = async (location: number) => {
  let neighbors = await viewContract.get_neighbors(location);
  let tokens = await getAllTokensFromAPI();
  let income = BigInt(0);

  let neighbor_tax_rates = await Promise.all(neighbors.map(async (neighbor: any) => {
    if (neighbor.activeVariant() == "Land") {
      let value = neighbor.unwrap();
      return await viewContract.get_tax_rate_per_neighbor(value.location);
    }
  }));

  let detailed_income = "";

  neighbors.forEach((neighbor: any, index: number) => {
    if (neighbor.activeVariant() == "Land") {

      let value = neighbor.unwrap();
      console.log('value', value)
      let neighbor_yield = neighbor_tax_rates[index];
      let neighbor_token = getTokenData(value.token_used, tokens);
      let coords = `(${indexToPosition(Number(value.location))[0]}, ${indexToPosition(Number(value.location))[1]})`
      if (!neighbor_token) {
        console.log("No token?")
      }
      else {
        // Yield is in estark
        if (!neighbor_token.ratio) {
          income += BigInt(neighbor_yield);
          detailed_income += `
          Location: ${value.location} ${coords[index]} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} estark
          `;
        }
        else {
          let adjusted_yield = Math.floor(Number(neighbor_yield) / neighbor_token.ratio);
          income += BigInt(adjusted_yield);
          detailed_income += `
          Location: ${value.location} ${coords} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} ${neighbor_token.symbol} (${formatTokenAmount(BigInt(adjusted_yield))} estark)
          `;
        }
      }
    }
  });

  let max_price = (Number(income) * 8) / .02;
  return `
  
  PotentialIncome: ${formatTokenAmount(income)} estark
  <detailed_income>
  ${detailed_income}
  </detailed_income>;

  Maximum Listing Price For Profit: ${formatTokenAmount(BigInt(Math.floor(max_price)))} estark. (If you list for more than this you will lose money)
  Only bid on auctions if you can list it for less than this, but more than the auction price. 
  `;
}

export const get_unowned_land_yield_str = async (location: number) => {
  let neighbors = await viewContract.get_neighbors(location);
  let land = (await viewContract.get_land(location)).unwrap();
  let tokens = await getAllTokensFromAPI();
  let income = BigInt(0);

  let neighbor_tax_rates = await Promise.all(neighbors.map(async (neighbor: any) => {
    if (neighbor.activeVariant() == "Land") {
      let value = neighbor.unwrap();
      return await viewContract.get_tax_rate_per_neighbor(value.location);
    }
  }));

  let agent_token_address = getTokenAddress(address);
  let agent_token = tokens.find((token) => token.address == agent_token_address);

  let detailed_income = "";

  neighbors.forEach((neighbor: any, index: number) => {
    if (neighbor.activeVariant() == "Land") {

      let value = neighbor.unwrap();
      console.log('value', value)
      let neighbor_yield = neighbor_tax_rates[index];
      let neighbor_token = getTokenData(value.token_used, tokens);
      let coords = `(${indexToPosition(Number(value.location))[0]}, ${indexToPosition(Number(value.location))[1]})`
      if (!neighbor_token) {
        console.log("No token?")
      }
      else {
        // Yield is in estark
        if (!neighbor_token.ratio) {
          income += BigInt(neighbor_yield);
          detailed_income += `
          Location: ${value.location} ${coords} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} estark
          `;
        }
        else {
          let adjusted_yield = Math.floor(Number(neighbor_yield) / neighbor_token.ratio);
          income += BigInt(adjusted_yield);
          detailed_income += `
          Location: ${value.location} ${coords} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} ${neighbor_token.symbol} (${formatTokenAmount(BigInt(adjusted_yield))} estark)
          `;
        }
      }
    }
  });

  let max_price = (Number(income) * 8) / .02;

  let estark_price = formatTokenAmount(BigInt(Math.floor(agent_token!.ratio! / Number(land.sell_price))));

  
  return `

  Land Location: ${BigInt(land.location).toString()} (${indexToPosition(Number(land.location))[0]}, ${indexToPosition(Number(land.location))[1]})
  Owner: ${BigInt(land.owner)}

  Land Price: ${formatTokenAmount(BigInt(land.sell_price))} ${getTokenData(land.token_used, tokens)?.symbol}
  ${agent_token!.symbol} Equivalent: ${formatTokenAmount(BigInt(Math.floor(agent_token!.ratio! * land.sell_price)))} ${agent_token!.symbol}
  estark Equivalent: ${estark_price} estark
  
  PotentialIncome: ${formatTokenAmount(income)} estark / ${formatTokenAmount(BigInt(Math.floor(agent_token!.ratio! * Number(income))))} ${agent_token!.symbol}
  <detailed_income>
  ${detailed_income}
  </detailed_income>;

  Maximum Listing Price For Profit: ${formatTokenAmount(BigInt(Math.floor(agent_token!.ratio! * max_price)))} ${agent_token!.symbol}. (If you list for more than this you will lose money)
  
  Only bid on auctions if you can list it for less than this, but more than the auction price. 
  `;
}


export const get_player_lands_str = async (address: string) => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query(address),
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  let coords = lands.map((land: any) => `(${indexToPosition(Number(land.location))[0]}, ${indexToPosition(Number(land.location))[1]})`)
  let land_str = lands.map((land: any, index: number) => `
  Location: ${BigInt(land.location).toString()} ${coords[index]} Owner: ${land.owner} - Token: ${getTokenData(land.token_used, tokens)!.symbol} - Sell Price: ${formatTokenAmount(BigInt(land.sell_price))}
  `).join("\n");

  return land_str;
}

export const get_owned_lands = async () => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    land_query(address),
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  if (!lands) {
    return "You do not own any lands"
  }

  return lands;
}

export const calculateLandYield = async (land: any, tokens: TokenPrice[]) => {
  let token = getTokenData(land.token_used, tokens);
  let tax_rate = Number(await viewContract.get_tax_rate_per_neighbor(land.location));
  console.log('tax rate', tax_rate)
  if (token.ratio) {
    tax_rate = tax_rate * token.ratio;
  }
  let neighbors = await viewContract.get_neighbors(land.location);
  let income = BigInt(0);

  let neighbor_tax_rates = await Promise.all(neighbors.map(async (neighbor: any) => {
    if (neighbor.activeVariant() == "Land") {
      let value = neighbor.unwrap();
      return await viewContract.get_tax_rate_per_neighbor(value.location);
    }
  }));

  let detailed_income = "";

  console.log('tax_rate', tax_rate)
  neighbors.forEach((neighbor: any, index: number) => {
    if (neighbor.activeVariant() == "Land") {

      let value = neighbor.unwrap();
      console.log('value', value)
      let neighbor_yield = neighbor_tax_rates[index];
      let neighbor_token = getTokenData(value.token_used, tokens);
      let coords = `(${indexToPosition(Number(value.location))[0]}, ${indexToPosition(Number(value.location))[1]})`
      if (!neighbor_token) {
        console.log("No token?")
      }
      else {
        // Yield is in estark
        if (!neighbor_token.ratio) {
          income += BigInt(neighbor_yield);
          detailed_income += `
          Location: ${value.location} ${coords} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} estark
          `;
        }
        else {
          let adjusted_yield = Math.floor(Number(neighbor_yield) / neighbor_token.ratio);
          income += BigInt(adjusted_yield);
          detailed_income += `
          Location: ${value.location} ${coords} - Yield: ${formatTokenAmount(BigInt(neighbor_yield))} ${neighbor_token.symbol} (${formatTokenAmount(BigInt(adjusted_yield))} estark)
          `;
        }
      }
    }
  });

  console.log('income', income)

  if (tax_rate == 0) {
    return 0;
  }
  let adjusted_income = BigInt(income) / BigInt(Math.floor(tax_rate));

  console.log('adjusted income', adjusted_income)

  return `
  Income: ${formatTokenAmount(income)} estark
  <detailed_income>
  ${detailed_income}
  </detailed_income>
  Tax Rate: ${formatTokenAmount(BigInt(Math.floor(tax_rate)))}
  Net Yield: ${adjusted_income * BigInt(100)}% ( ${formatTokenAmount(income - BigInt(Math.floor(tax_rate)))} estark)
  `;

}

export const get_prices_str = async () => {
  let tokens = await getAllTokensFromAPI();

  let prices = tokens.map((token) => {
    return `
    ${token.symbol}: ${token.ratio} estark
    `;
  }).join("\n");

  return prices;
}

export const query_lands_under_price_str = async (price: number, token: string) => {
  let lands = await fetchGraphQL(
    env.GRAPHQL_URL + "/graphql",
    query_lands_under_price(price, token),
    {}
  ).then((res: any) => res?.ponziLandLandModels?.edges?.map((edge: any) => edge?.node));

  let tokens = await getAllTokensFromAPI();

  let res = lands.map((land: any) => `
  Location: ${BigInt(land.location).toString()} Owner: ${land.owner} - Token: ${getTokenData(land.token_used, tokens)!.symbol} - Sell Price: ${formatTokenAmount(BigInt(land.sell_price))}
  `).join("\n");

  return res;
}