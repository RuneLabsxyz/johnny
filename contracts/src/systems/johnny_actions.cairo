#[starknet::interface]
trait IJohnnyActions<T> {
    fn move(ref self: T, location: u64);
    fn plant(ref self: T);
    fn tend(ref self: T);
}

#[dojo::contract]
mod johnny_actions {
    use super::{IJohnnyActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use orchard::ponziland::consts::JOHNNY_ADDRESS;
    use orchard::ponziland::coords::{left, right, up, down};
    use orchard::models::{Johnny, Status, Orchard, Stage};


    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;

    fn dojo_init(ref self: ContractState) {

        let mut world = self.world(@"orchards");

        let johnny = Johnny {
            address: starknet::contract_address_const::<JOHNNY_ADDRESS>(),
            location: 70,
            status: Status::None,
            last_action_time: get_block_timestamp(),
        };

        world.write_model(@johnny);
    }

    #[abi(embed_v0)]
    impl JohnnyActionsImpl of IJohnnyActions<ContractState> {
        fn move(ref self: ContractState, location: u64) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");

            let mut world = self.world(@"orchards");
            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            //TODO: HANDLE UNWRAP BETTER
            let valid = location == left(johnny.location).unwrap() || 
                location == right(johnny.location).unwrap() || 
                location == up(johnny.location).unwrap() || 
                location == down(johnny.location).unwrap();

            assert!(valid, "Invalid move");

            johnny.location = location;
            world.write_model(@johnny);
        }

        fn plant(ref self: ContractState) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");

            let mut world = self.world(@"orchards");
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let mut orchard: Orchard = world.read_model(johnny.location);

            assert!(orchard.planted_time == 0, "Orchard already planted");

            orchard.planted_time = get_block_timestamp();
            orchard.stage = Stage::Nursery;
            orchard.health = 100;
            orchard.last_tend_time = get_block_timestamp();

            world.write_model(@orchard);
        }

        fn tend(ref self: ContractState) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");
            let mut world = self.world(@"orchards");

            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let mut orchard: Orchard = world.read_model(johnny.location);

            assert!(orchard.planted_time != 0, "Orchard not planted");

            orchard.last_tend_time = get_block_timestamp();
            orchard.health = 100;
            world.write_model(@orchard);
        }
    }

}
