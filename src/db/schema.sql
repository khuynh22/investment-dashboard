-- src/db/schema.sql  (run once in the Neon SQL editor; see deployment notes)
CREATE TABLE IF NOT EXISTS holdings (
  ticker     text PRIMARY KEY,
  quantity   numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prices (
  ticker     text PRIMARY KEY REFERENCES holdings(ticker) ON DELETE CASCADE,
  price      numeric NOT NULL,
  source     text NOT NULL CHECK (source IN ('auto','manual')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
