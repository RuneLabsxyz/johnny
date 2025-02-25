// define the interface
#[starknet::interface]
pub trait IPlayerActions<T> {
    fn get_johnny_location(self: @T) -> (u64, u64);
    fn get_johnny_location_index(self: @T) -> u64;
    fn claim_apples(ref self: T, location: u64);
    fn tend_orchard(ref self: T, location: u64);

}

// dojo decorator
#[dojo::contract]
pub mod player_actions {
    use super::{IPlayerActions};
    use starknet::{ContractAddress, get_caller_address};
    use orchard::ponziland::coords::{position_to_index, index_to_position};
    use orchard::models::{Johnny, Orchard};
    use orchard::ponziland::consts::{PONZILAND_WORLD_ADDRESS, JOHNNY_ADDRESS};
    
    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;

    #[abi(embed_v0)]
    impl PlayerActionsImpl of IPlayerActions<ContractState> {
        fn get_johnny_location(self: @ContractState) -> (u64, u64) {
            let world = self.world(@"orchards");
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            return index_to_position(johnny.location);
        }

        fn get_johnny_location_index(self: @ContractState) -> u64 {
            let world = self.world(@"orchards");
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            return johnny.location;
        }

        fn claim_apples(ref self: ContractState, location: u64) {
            let world = self.world(@"orchards");
            let ponziland = self.world(@"ponziland");

            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let orchard: Orchard = world.read_model(johnny.location);
            assert!(orchard.planted_time != 0, "Orchard not planted");

            //TODO
        }

        fn tend_orchard(ref self: ContractState, location: u64) {
            let world = self.world(@"orchards");

            let ponziland = self.world(@"ponziland");

            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let orchard: Orchard = world.read_model(johnny.location);
            assert!(orchard.planted_time != 0, "Orchard not planted");

            //TODO
        }

        
    }
}
