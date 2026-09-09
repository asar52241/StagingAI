-- Server-only order and rate-limit state. Images remain in browser IndexedDB.
-- Keep value as text: compare-and-set compares the exact serialized record.
CREATE TABLE IF NOT EXISTS public.stagingai_records (
  key text PRIMARY KEY,
  value text NOT NULL,
  expires_at bigint NOT NULL CHECK (expires_at > 0)
);

CREATE INDEX IF NOT EXISTS stagingai_records_expiry_idx
  ON public.stagingai_records (expires_at);

REVOKE ALL ON TABLE public.stagingai_records FROM PUBLIC;
