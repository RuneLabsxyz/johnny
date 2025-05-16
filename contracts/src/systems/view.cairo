// define the interface
use orchard::ponziland::models::{Land, Auction, LandOrAuction};
#[starknet::interface]
pub trait IPlayerActions<T> {
    fn get_neighbors(self: @T, location: u16) -> Array<LandOrAuction>;
    fn get_land_or_auction(self: @T, location: u16) -> LandOrAuction;
}

// dojo decorator
#[dojo::contract]
pub mod player_actions {
    use super::{IPlayerActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use orchard::ponziland::coords::{position_to_index, index_to_position};
    use orchard::models::{Johnny, Orchard, OrchardTrait};
    use orchard::ponziland::consts::{PONZILAND_WORLD_ADDRESS, JOHNNY_ADDRESS};

    use orchard::ponziland::coords::{get_all_neighbors};
    use orchard::ponziland::models::{LandOrAuction, Land, Auction};
    
    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;


    #[abi(embed_v0)]
    impl PlayerActionsImpl of IPlayerActions<ContractState> {

        fn get_neighbors(self: @ContractState, location: u16) -> Array<LandOrAuction> {
            let mut world = self.world(namespace());
            let ponziland = self.world(@"ponzi_land");

            let neighbors = get_all_neighbors(location);

            let mut neighbors_array = ArrayTrait::new();

            for neighbor in neighbors {
                let maybe_auction: Auction = ponziland.read_model(neighbor);
                let maybe_land: Land = ponziland.read_model(neighbor);

                if maybe_auction.floor_price != 0 && maybe_auction.is_finished == false {
                    neighbors_array.append(LandOrAuction::Auction(maybe_auction));
                } 
                else if maybe_land.sell_price != 0 {
                    neighbors_array.append(LandOrAuction::Land(maybe_land));
                }
                else {
                    neighbors_array.append(LandOrAuction::None);
                }
            };

            neighbors_array
        }

        fn get_land_or_auction(self: @ContractState, location: u16) -> LandOrAuction {
            let mut world = self.world(namespace());
            let ponziland = self.world(@"ponzi_land");

            let maybe_auction: Auction = ponziland.read_model(location);
            let maybe_land: Land = ponziland.read_model(location);

            if maybe_auction.floor_price != 0 && maybe_auction.is_finished == false {
                LandOrAuction::Auction(maybe_auction)
            }
            else if maybe_land.sell_price != 0 {
                LandOrAuction::Land(maybe_land)
            }
            else {
                LandOrAuction::None
            }
            
            
        }



        
    }

    pub fn namespace() -> @ByteArray {
        @"orchards3"
    }
}