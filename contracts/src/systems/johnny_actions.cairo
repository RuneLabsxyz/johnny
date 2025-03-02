use orchard::models::Johnny;


#[starknet::interface]
trait IJohnnyActions<T> {
    fn move(ref self: T, location: u64);
    fn plant(ref self: T);
    fn tend(ref self: T);
    fn refresh(ref self: T);
    fn johnny_status(self: @T) -> Johnny;
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

            assert!(can_act(johnny), "Johnny cannot act");


            //TODO: HANDLE UNWRAP BETTER
            let valid = location == left(johnny.location).unwrap() || 
                location == right(johnny.location).unwrap() || 
                location == up(johnny.location).unwrap() || 
                location == down(johnny.location).unwrap();

            johnny.status = Status::Moving(location);
            johnny.last_action_time = get_block_timestamp();
            assert!(valid, "Invalid move");

            //TODO: MOVE AFTER 
            johnny.location = location;
            world.write_model(@johnny);
        }

        fn plant(ref self: ContractState) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");
            let mut world = self.world(@"orchards");
            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            assert!(can_act(johnny), "Johnny cannot act");

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

            assert!(can_act(johnny), "Johnny cannot act");

            let mut orchard: Orchard = world.read_model(johnny.location);

            assert!(orchard.planted_time != 0, "Orchard not planted");

            orchard.last_tend_time = get_block_timestamp();
            orchard.health = 100;
            world.write_model(@orchard);
        }

        fn refresh(ref self: ContractState) {

            let mut world = self.world(@"orchards");
            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            let can_act = can_act(johnny);

            if can_act {
                match johnny.status {
                    Status::None => {

                    },
                    Status::Planting => {
                        let mut orchard: Orchard = world.read_model(johnny.location);
                        orchard.planted_time = get_block_timestamp();
                        orchard.stage = Stage::Nursery;
                        orchard.health = 100;
                        orchard.last_tend_time = get_block_timestamp();
                        world.write_model(@orchard);
                    },
                    Status::Tending => {
                        let mut orchard: Orchard = world.read_model(johnny.location);
                        orchard.last_tend_time = get_block_timestamp();
                        orchard.health = 100;
                        world.write_model(@orchard);
                    },
                    Status::Moving(location) => {
                        johnny.location = location;

                    },
                }
            }

            johnny.status = Status::None;

            world.write_model(@johnny);
        }

        fn johnny_status(self: @ContractState) -> Johnny {
            let mut world = self.world(@"orchards");
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            return johnny;
        }
    }

    fn can_act(johnny: Johnny) -> bool {
        let time_passed = get_block_timestamp() - johnny.last_action_time;

        match johnny.status {
            Status::None => true,
            Status::Planting => {
                time_passed > 600
            },
            Status::Tending => {
                time_passed > 6000
            },
            Status::Moving => {
                time_passed > 60000
            },
        }
    }

}
