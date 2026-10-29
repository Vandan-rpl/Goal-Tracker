-- ============================================================
-- Ideas: drop the year from IdeaNumber
-- ============================================================
-- Old format: IDEA-YYYY-0001 (year taken from CreatedDate)
-- New format: IDEA-0001      (IdeaID padded to at least 4 digits;
--                             IDEA-10000 onwards keeps every digit)
--
-- IdeaNumber stays a computed column on the IDENTITY IdeaID, so two
-- ideas created at the same moment can never get the same number.
-- A computed column can't be altered in place, so it is dropped and
-- re-added together with its unique index.
-- ============================================================

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Ideas_IdeaNumber'
      AND object_id = OBJECT_ID(N'dbo.Ideas')
)
BEGIN
    DROP INDEX UX_Ideas_IdeaNumber ON dbo.Ideas;
END;
GO

ALTER TABLE dbo.Ideas DROP COLUMN IdeaNumber;
GO

ALTER TABLE dbo.Ideas ADD IdeaNumber AS (CONCAT('IDEA-',
    REPLICATE('0', 4 - LEN(IdeaID)), IdeaID)) PERSISTED;
GO

CREATE UNIQUE INDEX UX_Ideas_IdeaNumber ON dbo.Ideas (IdeaNumber);
GO
