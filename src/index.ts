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

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { discover } from './discover.ts'
import { serve, type Experience } from './serve.ts'

const port = Number(process.env.HUB_PORT ?? 2567)

/*
 * Two ways to say what to serve, and the first is the one to reach for.
 *
 * HUB_ROOMS is a pattern — installing a package puts a room where the pattern
 * already looks, so nothing has to be edited to turn it on. HUB_EXPERIENCES
 * names a module instead, for a venue that wants to decide the list itself.
 */
const pattern = process.env.HUB_ROOMS
const from = process.env.HUB_EXPERIENCES

/*
 * Resolved against where the command was run, not against this file.
 *
 * A bare `import()` of a relative path resolves relative to the importing
 * module, which is inside this package — so an operator passing the obvious
 * `./hub-experiences.ts` from their own directory gets a confusing
 * ERR_MODULE_NOT_FOUND naming a path they never typed.
 */
const experiences: Experience[] = pattern
  ? await discover(pattern)
  : from
    ? ((await import(pathToFileURL(resolve(process.cwd(), from)).href)).default ?? [])
    : []

await serve(experiences, port)

console.log(
  experiences.length === 0
    ? `hub listening on ${port} with no experiences installed`
    : `hub listening on ${port}: ${experiences.map((e) => e.name).join(', ')}`,
)
