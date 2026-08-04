/**
 * Finding the rooms a venue has installed, rather than being told each one.
 *
 * Naming every experience by hand is a step somebody forgets, and forgetting it
 * looks like a table that never opens rather than like a missing line in a
 * file. Views and styles in this project are already discovered — a Livewire
 * namespace, a `@source` glob — and this is the same idea for rooms.
 *
 * The pattern comes from the venue rather than from here. A hub that went
 * looking on its own would have to assume a directory layout belonging to
 * somebody else's application, and be wrong for anybody who arranged theirs
 * differently.
 */

import { access, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { isAbsolute, join, resolve, sep } from 'node:path'
import type { Experience } from './serve.ts'

/**
 * Expand one `*` per path segment, against the working directory.
 *
 * Deliberately not a glob library. One wildcard per segment is the whole of
 * what `packages/  *  /hub/src/room.ts` needs, and a dependency that can also
 * do `**` and braces would be more surface than the problem has.
 */
async function expand(pattern: string): Promise<string[]> {
  const from = isAbsolute(pattern) ? pattern : resolve(process.cwd(), pattern)
  const segments = from.split(sep)

  let found = [segments[0] === '' ? sep : segments[0]]

  for (const segment of segments.slice(1)) {
    if (!segment.includes('*')) {
      found = found.map((base) => join(base, segment))

      continue
    }

    const matcher = new RegExp(`^${segment.split('*').map(escape).join('.*')}$`)
    const widened: string[] = []

    for (const base of found) {
      let entries: string[] = []

      try {
        entries = await readdir(base)
      } catch {
        // A directory that is not there matches nothing, which is not an error
        // — a venue with no packages installed simply has no rooms.
        continue
      }

      widened.push(...entries.filter((entry) => matcher.test(entry)).map((entry) => join(base, entry)))
    }

    found = widened
  }

  return found
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)

    return true
  } catch {
    return false
  }
}

/**
 * Every experience matching a pattern, in a stable order.
 *
 * Sorted, because two hubs given the same packages should register the same
 * rooms in the same order — a difference that depends on how a filesystem
 * happens to enumerate a directory is a difference nobody can reproduce.
 */
export async function discover(pattern: string): Promise<Experience[]> {
  /*
   * Filtered by what is actually there, because expanding a wildcard says
   * nothing about the segments after it. `packages/  *  /hub/src/room.ts`
   * matches every package and then assumes each has a room — so a venue with
   * one experience and one interface package tried to import a file the second
   * has no reason to own.
   */
  const found = await expand(pattern)
  const paths: string[] = []

  for (const path of found) {
    if (await exists(path)) {
      paths.push(path)
    }
  }

  paths.sort()

  const experiences: Experience[] = []

  for (const path of paths) {
    const module = await import(pathToFileURL(path).href)
    const experience = module.default

    if (!experience?.name || !experience?.room) {
      throw new Error(
        `[${path}] matched but does not default-export { name, room }, so it cannot be served.`,
      )
    }

    experiences.push(experience as Experience)
  }

  return experiences
}
