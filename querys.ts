export const balance_query = `query GetTokenBalances {
    tokenBalances(accountAddress:"0x07480be1854e8464b85b7310d1f9602d810674e2bc43a3d73a168c816a2bbd8a"){
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
  
export const land_query = `query GetOwnedLands {
  ponziLandLandModels(where:{owner:"0x07480be1854e8464b85b7310d1f9602d810674e2bc43a3d73a168c816a2bbd8a"}){
  edges{
    node{
      location
      stake_amount
      last_pay_time
      sell_price
      token_used
    }
  }
  }
  }`