/**
 * Drops keys whose value is undefined (e.g. optional fields of a parsed PATCH body), so the
 * result fits types built for exactOptionalPropertyTypes such as Prisma's update inputs.
 */
export function withoutUndefined<T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
