/**
 * Standing a hub up, with whatever rooms it has been given.
 *
 * A hub on its own does nothing useful — it has no rooms, because rooms are
 * where the rules live and rules belong to experiences. So this takes them as
 * an argument rather than discovering them: a venue knows what it has
 * installed, and this does not need to.
 *
 * That is the seam. An experience ships a room definition; a venue collects the
 * ones it has and hands them over; this serves them behind the same door.
 */

import { Server, type Room } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { createServer } from 'node:http'

/**
 * A room class, as something that can be constructed.
 *
 * Colyseus has this type internally and does not export it from its package
 * index, so it is written out here rather than reached for down a build path
 * that is not ours to depend on. The constructor arguments are Colyseus's
 * business, which is what the `any` says.
 */
export type RoomClass = new (...args: any[]) => Room

export interface Experience {
  /**
   * The room type's name, as an NSID — `com.streetmesh.games.chess`.
   *
   * Named the way collections are, and for the same reason: whoever controls
   * the domain controls the name, so two experiences by different authors
   * cannot collide without somebody doing it on purpose.
   */
  name: string
  room: RoomClass
}

export interface Hub {
  server: Server
  stop: () => Promise<void>
}

/**
 * The same name, in a form that survives being put in a URL.
 *
 * Colyseus asks for a room type by posting to `matchmake/create/{name}`, and a
 * dot in that path is read as the start of a file extension — so an NSID
 * arrives as `com` and nothing matches. Underscores are not legal in an NSID,
 * which makes them a separator that can never collide with a real name and can
 * always be undone.
 *
 * The NSID stays the name everywhere it matters: in tickets, in scopes, in
 * collections. This is a transport detail and does not leak past this file.
 */
export function typeNameFor(nsid: string): string {
  return nsid.replaceAll('.', '_')
}

export async function serve(experiences: Experience[], port: number): Promise<Hub> {
  const http = createServer()

  const server = new Server({
    transport: new WebSocketTransport({ server: http }),
  })

  for (const experience of experiences) {
    /*
     * Filtered on the venue's room name, so everybody the venue sent to one
     * table arrives in one room. Without it Colyseus would open a fresh room
     * per person and two players would each be alone in their own game.
     */
    server.define(typeNameFor(experience.name), experience.room).filterBy(['room'])
  }

  await server.listen(port)

  return {
    server,
    stop: async () => {
      /*
       * Rooms are told before the socket goes, so clients see a room closing
       * rather than a connection dropping. The two look identical to a browser
       * and mean very different things to somebody mid-game.
       */
      await server.gracefullyShutdown(false)
      http.close()
    },
  }
}
