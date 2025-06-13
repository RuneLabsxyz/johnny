import { env } from '../../../env';

const address = env.STARKNET_ADDRESS;

// Utility function to trim leading zeros from hex addresses
const trimLeadingZeros = (hexString: string): string => {
  if (!hexString.startsWith('0x')) return hexString;
  const trimmed = hexString.slice(2).replace(/^0+/, '') || '0';
  return '0x' + trimmed;
};

export const balance_query = `query GetTokenBalances {
    tokenBalances(accountAddress:"${address}"){
      edges{
        node{
          tokenMetadata{
             ... on ERC20__Token {
              symbol
              amount
              contractAddress
            }
          }
        }
      }
    }
  }`
  
export const auction_query = `query GetActiveAuctions {
    ponziLandAuctionModels(where:{is_finished: false}){
        edges{
        node{
            start_time
            is_finished
            start_price
            floor_price
            land_location
            decay_rate
        }
        }
    }
  }`
  
export const land_query = (address: string) => `query GetOwnedLands {
  ponziLandLandModels(where:{owner:"${trimLeadingZeros(address)}"}, first: 1000){
    edges{
      node{
        location
        sell_price
        token_used
      }
    }
  }
}
`

export const query_lands_under_price = (price: number, token: string) => {
  let price_str = (BigInt(price) * BigInt(10 ** 18)).toString();
  let query = `query GetLandsUnderPrice {
  ponziLandLandModels(where:{sell_priceLT:"${price_str}", token_used:"${trimLeadingZeros(token)}"}, first: 1000){
    edges{
      node{
        owner
        location
        sell_price
        token_used
      }
    }
  }
}`;

  console.log('query', query);

  return query;
}

export const land_staked_with_query = (address: string) => {
  let query = `query GetLandStakedWith {
    ponziLandLandModels(where:{token_used:"${trimLeadingZeros(address)}"}, first: 1000){
      edges{
        node{
            location
            owner
        }
      }
    }
  }`

  return query;
}

export const land_bought_query = (buyer?: string, seller?: string) => {
  let args = "";
  if (buyer && seller ) {
    args = `where:{buyer:"${trimLeadingZeros(buyer)}", seller:"${trimLeadingZeros(seller)}"}`;
  } else if (buyer) {
    args = `where:{buyer:"${trimLeadingZeros(buyer)}"}`;
  } else if (seller) {
    args = `where:{seller:"${trimLeadingZeros(seller)}"}`;
  }
  
  let query = `query GetLandBought {
    ponziLandLandBoughtEventModels(${args}, first: 25){
      edges{
        node{
          land_location
          buyer
          seller
          sold_price
          token_used
          
        }
      }
    }
  }`  

  console.log('query', query);
  return query;
}