export function createId(prefix: string): string {
  const id = crypto.randomUUID().replaceAll('-', '');
  return `${prefix}_${id}`;
}
