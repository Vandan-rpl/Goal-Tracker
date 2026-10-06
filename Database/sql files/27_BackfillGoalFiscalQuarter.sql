IF COL_LENGTH('dbo.Goals', 'Quarter') IS NULL
BEGIN
    ALTER TABLE dbo.Goals ADD Quarter VARCHAR(10) NULL;
END;
GO

IF COL_LENGTH('dbo.Goals', 'QuarterEndDate') IS NULL
BEGIN
    ALTER TABLE dbo.Goals ADD QuarterEndDate DATE NULL;
END;
GO

UPDATE dbo.Goals
SET
    Quarter = CASE
        WHEN Quarter IS NOT NULL THEN Quarter
        WHEN MONTH(Timeline) BETWEEN 4 AND 6 THEN CONCAT('Q1-', YEAR(Timeline) + 1)
        WHEN MONTH(Timeline) BETWEEN 7 AND 9 THEN CONCAT('Q2-', YEAR(Timeline) + 1)
        WHEN MONTH(Timeline) BETWEEN 10 AND 12 THEN CONCAT('Q3-', YEAR(Timeline) + 1)
        ELSE CONCAT('Q4-', YEAR(Timeline))
    END,
    QuarterEndDate = CASE
        WHEN QuarterEndDate IS NOT NULL THEN QuarterEndDate
        WHEN MONTH(Timeline) BETWEEN 4 AND 6 THEN DATEFROMPARTS(YEAR(Timeline), 6, 30)
        WHEN MONTH(Timeline) BETWEEN 7 AND 9 THEN DATEFROMPARTS(YEAR(Timeline), 9, 30)
        WHEN MONTH(Timeline) BETWEEN 10 AND 12 THEN DATEFROMPARTS(YEAR(Timeline), 12, 31)
        ELSE DATEFROMPARTS(YEAR(Timeline), 3, 31)
    END
WHERE Quarter IS NULL OR QuarterEndDate IS NULL;
GO
