/**
 * A room nobody enters without a ticket.
 *
 * This is the base every experience builds on, and the only thing it knows how
 * to do is check that a venue said somebody may sit down. It knows nothing
 * about chess, or watch parties, or auctions — and nothing about federation
 * either, which is the point: the venue resolved the address and checked the
 * delegation, and all that arrives here is a signature.
 *
 * What an experience adds is rules. What it never has to add is any of this.
 */

import { Room, type Client } from '@colyseus/core'
import { verifyTicket, type Ticket } from './ticket.ts'

export interface Seated {
  ticket: Ticket
}

/**
 * Which room, in the venue's words.
 *
 * Not the same as Colyseus's `roomId`, which is generated here and means
 * nothing to anybody else. The venue named this room when it minted the ticket,
 * and that name is what the ticket is checked against — so it has to travel
 * with the join and be held by the room.
 */
export interface JoinOptions {
  ticket?: string
  room?: string
}

export abstract class VenueRoom<State extends object = object> extends Room<State> {
  protected readonly seats = new Map<string, Ticket>()

  /** The venue's name for this room, which every ticket must agree with. */
  protected venueRoom = ''

  onCreate(options: JoinOptions): void {
    if (typeof options?.room !== 'string' || options.room === '') {
      throw new Error('A room has to be created under the name the venue gave it.')
    }

    this.venueRoom = options.room

    this.opened(options)
  }

  /**
   * Called before a client is admitted, and a throw here is a refusal rather
   * than an error — which is why everything deciding whether somebody may be
   * here belongs in it rather than in `onJoin`.
   */
  async onAuth(client: Client, options: JoinOptions): Promise<Seated> {
    if (typeof options?.ticket !== 'string' || options.ticket === '') {
      throw new Error('A seat here needs a ticket from the venue.')
    }

    /*
     * Compared against the name this room was opened under, never against the
     * name in the ticket itself. A ticket that vouched for its own room would
     * open any room it was pointed at.
     */
    const ticket = await verifyTicket(options.ticket, this.venueRoom)

    /*
     * One seat, one occupant. Without this a second connection presenting the
     * same ticket would sit down beside the first, and the two would disagree
     * about the room from then on.
     */
    for (const seated of this.seats.values()) {
      if (seated.subject === ticket.subject) {
        throw new Error('Somebody is already sitting there.')
      }
    }

    return { ticket }
  }

  onJoin(client: Client, options: JoinOptions, auth: Seated): void {
    this.seats.set(client.sessionId, auth.ticket)
    this.seated(client, auth.ticket)
  }

  onLeave(client: Client): void {
    const ticket = this.seats.get(client.sessionId)

    this.seats.delete(client.sessionId)

    if (ticket) {
      this.left(client, ticket)
    }
  }

  /** Who is here, as the venue vouched for them. */
  protected occupants(): Ticket[] {
    return [...this.seats.values()]
  }

  protected opened(options: JoinOptions): void {}

  protected seated(client: Client, ticket: Ticket): void {}

  protected left(client: Client, ticket: Ticket): void {}
}
