#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame::pallet]
pub mod pallet {
    use super::*;
    use core::fmt::Debug;
    use frame::{pallet, prelude::*};
    use frame::deps::codec::{Decode, Encode, MaxEncodedLen};
    use frame::deps::scale_info::TypeInfo;
    use frame::deps::sp_runtime::RuntimeDebug;
    use sp_core::bounded::BoundedVec;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[derive(
        Encode, Decode, DecodeWithMemTracking, Clone, Copy,
        PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug, Default,
    )]
    pub struct Coordinate {
        pub x: u32,
        pub y: u32,
    }    


    //=====Pallet Configuration=====

    #[pallet::config]
    pub trait Config: frame_system::Config + Debug {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type RuntimeCall: IsType<<Self as frame_system::Config>::RuntimeCall> + From<Call<Self>>;

        type Location: Parameter
            + Member
            + Default
            + Copy
            + Encode
            + Decode
            + MaxEncodedLen
            + TypeInfo
            + PartialEq
            + Eq;

        type RobotId: Parameter
            + Member
            + Default
            + Copy
            + MaxEncodedLen
            + TypeInfo
            + PartialEq
            + Eq;

        type TaskDefinition: Parameter
            + Member
            + MaxEncodedLen
            + TypeInfo
            + PartialEq
            + Eq;

        #[pallet::constant]
        type MaxGlobalCommands: Get<u32>;
    }

    #[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    #[scale_info(skip_type_params(T))]
    pub enum Command<T: Config> {
        GoToLocation(T::Location),
        PerformTask(T::TaskDefinition),
        Halt,
        WaitForCommand,
    }

    //=====Pallet Storage=====

    #[pallet::storage]
    #[pallet::getter(fn registered_robots)]
    pub type RegisteredRobots<T: Config> =
        StorageMap<_, Blake2_128Concat, T::RobotId, (), ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn global_command_queue)]
    pub type GlobalCommandQueue<T: Config> = StorageValue<
        _,
        BoundedVec<Command<T>, T::MaxGlobalCommands>, // 3) Command<T> here
        ValueQuery,
    >;

    //=====Pallet Errors=====
    #[pallet::error]
    #[derive(PartialEq, Clone)]
    pub enum Error<T> {
        InvalidRobotId,
        QueueFull,
        QueueEmpty,
    }

    //=====Pallet Events=====
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        CommandEnqueued(Command<T>),
        CommandPulled {
            robot_id:  T::RobotId,
            command:   Command<T>,
            coordinate: Option<T::Location>,
        },
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn register_robot(origin: OriginFor<T>, robot_id: T::RobotId) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            RegisteredRobots::<T>::insert(&robot_id, ());
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn enqueue_command(
            origin: OriginFor<T>,
            command: Command<T>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            let mut queue = GlobalCommandQueue::<T>::get();
            queue.try_push(command.clone()).map_err(|_| Error::<T>::QueueFull)?;
            GlobalCommandQueue::<T>::put(queue);
            Self::deposit_event(Event::CommandEnqueued(command));
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn pull_next(origin: OriginFor<T>, robot_id: T::RobotId) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            ensure!(
                RegisteredRobots::<T>::contains_key(&robot_id),
                Error::<T>::InvalidRobotId
            );

            let mut queue = GlobalCommandQueue::<T>::get();
            let cmd = queue.get(0).cloned().ok_or(Error::<T>::QueueEmpty)?;
            queue.remove(0);
            GlobalCommandQueue::<T>::put(queue);

            let coord = if let Command::GoToLocation(c) = &cmd {
                Some(*c)
            } else {
                None
            };

            Self::deposit_event(Event::CommandPulled {
                robot_id,
                command: cmd,
                coordinate: coord,
            });
            Ok(())
        }
    }
}
