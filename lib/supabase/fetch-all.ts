const BATCH_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

// Supabase geeft standaard maximaal 1000 rijen terug. Deze helper haalt alles op in blokken.
// De query moet een stabiele volgorde hebben (bijvoorbeeld op id) zodat geen rijen dubbel of niet meekomen.
export async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await buildQuery(from, from + BATCH_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < BATCH_SIZE) break
  }
  return rows
}
