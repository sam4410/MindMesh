// POSTs JSON and returns the parsed response, throwing on a non-2xx status.
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed with status ${res.status}`);
  return res.json() as Promise<T>;
}
