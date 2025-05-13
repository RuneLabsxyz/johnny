// define the interface
#[starknet::interface]
pub trait IPlayerActions<T> {
    fn claim_apples(ref self: T, location: u64);
    fn tend_orchard(ref self: T, location: u64);

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


    #[abi(embed_v0)]
    impl PlayerActionsImpl of IPlayerActions<ContractState> {

        fn claim_apples(ref self: ContractState, location: u64) {
            let mut world = self.world(namespace());
            let ponziland = self.world(@"ponziland");

            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let orchard: Orchard = world.read_model(johnny.location);
            assert!(orchard.planted_time != 0, "Orchard not planted");

            //TODO
            world.write_model(@johnny);
        }

        fn tend_orchard(ref self: ContractState, location: u64) {
            let mut world = self.world(namespace());

            let ponziland = self.world(@"ponziland");

            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let mut orchard: Orchard = world.read_model(johnny.location);
            assert!(orchard.planted_time != 0, "Orchard not planted");

            //TODO

            orchard.tend(get_block_timestamp());

            world.write_model(@orchard);
        }

        
    }

    pub fn namespace() -> @ByteArray {
        @"orchards3"
    }
}