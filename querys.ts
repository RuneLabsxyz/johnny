export const balance_query = `query GetTokenBalances {
    tokenBalances(accountAddress:"0x576CC90c1BD97011CC9c6351ACe3A372f13290ad2f114Eee05f0Cc5ee78d8e7"){
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
  ponziLandLandModels(where:{owner:"0x576CC90c1BD97011CC9c6351ACe3A372f13290ad2f114Eee05f0Cc5ee78d8e7"}){
  edges{
    node{
      location
      sell_price
      token_used
    }
  }
  }
  }`

  export const nuke_query = `query GetNukeableLands {
    ponziLandLandModels(where:{stake_amount: "0"}){
      edges{
        node{
          location
        }
      }
    }
  }`
