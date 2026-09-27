-- PART 2 of 2 (with 002), applied AFTER the reload, inside the same transaction. Adding it here
-- means Postgres validates all 445 freshly loaded rows: if any located row lacked a
-- point_id, or an unlocated row had one, the whole transaction aborts.
ALTER TABLE "project_points" ADD CONSTRAINT "project_points_point_id_ck" CHECK (("project_points"."point_id" IS NULL) = ("project_points"."lat" IS NULL));
