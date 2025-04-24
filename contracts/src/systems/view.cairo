// define the interface
import orchard::ponziland::models::{Land, Auction};
#[starknet::interface]
pub trait IPlayerActions<T> {
    fn get_neighbors(ref self: T, location: u64) -> Array<LandOrAuction>;

}

// dojo decorator
#[dojo::contract]
pub mod player_actions {
    use super::{IPlayerActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use orchard::ponziland::coords::{position_to_index, index_to_position};
    use orchard::models::{Johnny, Orchard, OrchardTrait};
    use orchard::ponziland::consts::{PONZILAND_WORLD_ADDRESS, JOHNNY_ADDRESS};
    
    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;
    use orchard::ponziland::coords::{get_all_neighbors};

    #[abi(embed_v0)]
    impl PlayerActionsImpl of IPlayerActions<ContractState> {

        fn get_neighbors(ref self: ContractState, location: u64) -> Array<LandOrAuction> {
            let mut world = self.world(namespace());
            let ponziland = self.world(@"ponziLand");

            let neighbors = get_all_neighbors(location);

            let mut neighbors_array = Array::new();

            for neighbor in neighbors {
                let maybe_auction: Auction = ponziland.read_model(neighbor);
                let maybe_land: Land = ponziland.read_model(neighbor);

                if maybe_auction.floor_price != 0 {
                    neighbors_array.push(LandOrAuction::Auction(maybe_auction));
                } 
                else if maybe_land.sell_price != 0 {
                    neighbors_array.push(LandOrAuction::Land(maybe_land));
                }
                else {
                    neighbors_array.push(LandOrAuction::None);
                }
            }

            neighbors
        }


        
    }

    pub fn namespace() -> @ByteArray {
        @"orchards2"
    }
}