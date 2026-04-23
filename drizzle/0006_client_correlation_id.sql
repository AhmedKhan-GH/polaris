-- Add a nullable client-minted correlation token. The client sends it
-- on create; the server stores it on the row; realtime echoes it back
-- in the INSERT payload. This lets the client match realtime events
-- to its own pending placeholders without owning the primary key.

ALTER TABLE "orders" ADD COLUMN "client_correlation_id" uuid;
