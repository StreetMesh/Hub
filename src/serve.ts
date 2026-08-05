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
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

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

/**
 * Every room currently open, by the venue's name for it.
 *
 * The hub holds this because Colyseus does not: its own registry is keyed on
 * the room id it invented, and the only name the venue knows is the one it put
 * in the ticket. Kept here rather than in room metadata, which Colyseus
 * publishes in a listing — a table's occupants are nobody else's business.
 *
 * One process. A hub spread across several would need this somewhere shared,
 * and would need to say so rather than quietly answer "no such room" for half
 * of them.
 */
const open = new Map<string, Resultful>()

/**
 * Only what this file needs of a room, so that rooms may import from here
 * without this having to import them back.
 */
type Resultful = {
  result(): Record<string, unknown> | null
  present(): Array<{ name: string; seat: string }>
}

export function remember(room: Resultful, name: string): void {
  open.set(name, room)
}

export function forget(name: string): void {
  open.delete(name)
}

/**
 * How a game ends up in somebody's own records.
 *
 * The venue asks; the hub answers only for a room that is over. The venue signs
 * what comes back, which is why this is the one thing here worth being careful
 * about: it is the hub's only influence on what gets written into a person's
 * repository, and it cannot sign anything itself.
 *
 * Answers nothing until there is a result, and lists nothing at all. You have
 * to already know the name of the table to ask about it, and that name came
 * from the venue.
 */
function answerResults(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', 'http://hub.invalid')

  if (url.pathname === '/present') {
    answerPresence(url, response)

    return
  }

  if (url.pathname !== '/result') {
    response.writeHead(404).end()

    return
  }

  const room = open.get(url.searchParams.get('room') ?? '')
  const result = room?.result() ?? null

  if (result === null) {
    // No such table, or one still being played. Deliberately the same answer:
    // whether a game exists is not a question this should help anybody explore.
    response.writeHead(404, { 'Content-Type': 'application/json' }).end('{}')

    return
  }

  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
}

/**
 * Who is actually at a table right now.
 *
 * The venue knows who sat down; only this knows who is still sitting there. A
 * seat survives somebody closing the tab — it has to, or their opponent could
 * take their chair while they reconnected — so a venue counting seats is
 * counting a history rather than a room.
 *
 * Asked about named rooms and never listing them. The caller has the names
 * already; they came from the venue's own records. A room nobody asks about is
 * a room this will not mention, which is why there is no endpoint that returns
 * everything — the prototype had one and it published every live table.
 */
function answerPresence(url: URL, response: ServerResponse): void {
  const asked = url.searchParams.getAll('room')
  const present: Record<string, Array<{ name: string; seat: string }>> = {}

  for (const name of asked) {
    // Absent rather than empty for a room that is not open, so "nobody is
    // there" and "there is no room" stay different answers.
    const room = open.get(name)

    if (room) {
      present[name] = room.present()
    }
  }

  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(present))
}

export async function serve(experiences: Experience[], port: number): Promise<Hub> {
  const http = createServer(answerResults)

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
