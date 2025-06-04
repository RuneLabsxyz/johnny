import { env } from '../../../env';

const address = env.STARKNET_ADDRESS;


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
  ponziLandLandModels(where:{owner:"${address}"}){
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

export const query_lands_under_price = (price: number, token: string) => `query GetLandsUnderPrice {
  ponziLandLandModels(where:{sell_price_lte:${price}, token_used:"${token}"}){
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
