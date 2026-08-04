/**
 * What an experience is given.
 *
 * The public surface of this package, and deliberately small: a base room that
 * has already dealt with who may be here, the shape of presence, and the way to
 * stand a hub up. An experience writes rules and nothing else.
 *
 * Kept apart from `index.ts`, which is a program rather than a library — an
 * experience importing the bootstrap would start a server as a side effect of
 * asking for a base class.
 */

export { VenueRoom, type JoinOptions, type Seated } from './room.ts'
export { Occupant, Occupancy, type OccupantType, type OccupancyType } from './presence.ts'
export { verifyTicket, type Ticket } from './ticket.ts'
export { serve, typeNameFor, type Experience, type Hub, type RoomClass } from './serve.ts'
export { discover } from './discover.ts'
