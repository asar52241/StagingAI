/** Keep campaign attribution, remove payment signatures and other private query values. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    for (const key of [...url.searchParams.keys()]) {
      if (!/^(utm_(source|medium|campaign|term|content|id)|yclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch { return ""; }
}
