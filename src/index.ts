/**
 * A hub, serving whatever experiences a venue has installed.
 *
 * The list comes from a module the venue writes, because the venue is the only
 * thing that knows what it has installed — this package cannot go looking
 * without assuming a directory layout that belongs to somebody else's
 * application.
 *
 *   HUB_EXPERIENCES=../hub-experiences.ts npm start
 *
 * That module default-exports an array of `Experience`. With none given, this
 * still runs and still checks tickets — a hub with no rooms is a door with
 * nothing behind it, which is exactly what is wanted while proving the door.
 */

import { serve, type Experience } from './serve.ts'

const port = Number(process.env.HUB_PORT ?? 2567)
const from = process.env.HUB_EXPERIENCES

const experiences: Experience[] = from ? ((await import(from)).default ?? []) : []

await serve(experiences, port)

console.log(
  experiences.length === 0
    ? `hub listening on ${port} with no experiences installed`
    : `hub listening on ${port}: ${experiences.map((e) => e.name).join(', ')}`,
)
