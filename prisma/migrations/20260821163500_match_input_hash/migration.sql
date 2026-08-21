-- A verdict's reuse key now hashes what the matcher reads of a call — its
-- extracted fields and its rules — rather than the announcement text they came
-- from. Re-reading an unchanged page under a corrected prompt produced
-- different fields under an identical article hash, so every verdict was reused
-- and the correction never reached a feed.
--
-- Renamed rather than dropped and re-added: the rows are worth keeping, and
-- their stored values are article hashes that cannot equal an input hash. Every
-- existing verdict therefore misses on the next run and is recomputed once,
-- which is the intended consequence — the data behind them changed.

ALTER TABLE "Match" RENAME COLUMN "grantContentHash" TO "grantInputHash";
