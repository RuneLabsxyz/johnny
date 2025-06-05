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
  ponziLandLandModels(where:{owner:"${trimLeadingZeros(address)}"}){
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
  return `query GetLandsUnderPrice {
  ponziLandLandModels(where:{sell_priceLT:${price_str}, token_used:"${trimLeadingZeros(token)}"}){
    edges{
      node{
        owner
        location
        sell_price
        token_used
      }
    }
  }
}`
}