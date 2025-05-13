// define the interface
use orchard::ponziland::models::{Land, Auction, LandOrAuction};
use starknet::ContractAddress;


#[starknet::interface]
pub trait IMortgage<T> {
    fn create_mortgage(self: @T, location: u16, recipient: ContractAddress);

}

// dojo decorator
#[dojo::contract]
pub mod mortgage {
    use super::{IMortgage};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use orchard::ponziland::coords::{position_to_index, index_to_position};
    use orchard::models::{Johnny, Orchard, OrchardTrait};
    use orchard::ponziland::consts::{PONZILAND_WORLD_ADDRESS, JOHNNY_ADDRESS};

    use orchard::ponziland::coords::{get_all_neighbors};
    use orchard::ponziland::models::{LandOrAuction, Land, Auction};
    
    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;


    #[abi(embed_v0)]
    impl MortgageImpl of IMortgage<ContractState> {

        fn create_mortgage(self: @ContractState, location: u16, recipient: ContractAddress) {
            let mut world = self.world(namespace());
            let ponziland = self.world(@"ponzi_land");


            let maybe_auction: Auction = ponziland.read_model(location);
            let maybe_land: Land = ponziland.read_model(location);




            neighbors_array
        }


        
    }

    pub fn namespace() -> @ByteArray {
        @"orchards3"
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Mortgage {
    #[key]
    pub location: u16,
    pub recipient: ContractAddress,
    pub timestamp: u64,
}