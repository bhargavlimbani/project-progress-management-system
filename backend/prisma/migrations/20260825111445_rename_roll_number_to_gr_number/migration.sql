-- Rename Student.rollNumber -> Student.grNumber
--
-- Written by hand as a RENAME rather than letting Prisma generate a
-- DROP + ADD, which would discard every existing value in the column.
ALTER TABLE "Student" RENAME COLUMN "rollNumber" TO "grNumber";
