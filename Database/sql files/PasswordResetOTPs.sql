IF OBJECT_ID('dbo.PasswordResetOTPs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetOTPs (
        ResetID              BIGINT IDENTITY(1,1) NOT NULL,
        UserID               INT            NOT NULL,
        OTPHash              NVARCHAR(255)  NOT NULL,
        OTPExpiresAt         DATETIME2(0)   NOT NULL,
        AttemptCount         INT            NOT NULL CONSTRAINT DF_PasswordResetOTPs_AttemptCount DEFAULT (0),
        Status               NVARCHAR(20)   NOT NULL CONSTRAINT DF_PasswordResetOTPs_Status DEFAULT ('Pending'),
        VerifiedAt           DATETIME2(0)   NULL,
        ResetTokenHash       NVARCHAR(255)  NULL,
        ResetTokenExpiresAt  DATETIME2(0)   NULL,
        UsedAt               DATETIME2(0)   NULL,
        InvalidatedAt        DATETIME2(0)   NULL,
        InvalidatedReason    NVARCHAR(50)   NULL,
        RequestIP            NVARCHAR(45)   NULL,
        UserAgent            NVARCHAR(500)  NULL,
        CreatedAt            DATETIME2(0)   NOT NULL CONSTRAINT DF_PasswordResetOTPs_CreatedAt DEFAULT (GETDATE()),
        UpdatedAt            DATETIME2(0)   NOT NULL CONSTRAINT DF_PasswordResetOTPs_UpdatedAt DEFAULT (GETDATE()),

        CONSTRAINT PK_PasswordResetOTPs PRIMARY KEY CLUSTERED (ResetID),
        CONSTRAINT FK_PasswordResetOTPs_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT CK_PasswordResetOTPs_Status CHECK (Status IN ('Pending', 'Verified', 'Used', 'Expired', 'Locked', 'Invalidated')),
        CONSTRAINT CK_PasswordResetOTPs_AttemptCount CHECK (AttemptCount >= 0),
        CONSTRAINT CK_PasswordResetOTPs_TokenPair CHECK (
            (ResetTokenHash IS NULL AND ResetTokenExpiresAt IS NULL) OR
            (ResetTokenHash IS NOT NULL AND ResetTokenExpiresAt IS NOT NULL)
        )
    );

    -- Latest OTP per user, rate-limit counts (requests in last hour)
    CREATE NONCLUSTERED INDEX IX_PasswordResetOTPs_User_CreatedAt
        ON dbo.PasswordResetOTPs (UserID, CreatedAt DESC)
        INCLUDE (Status, OTPExpiresAt, AttemptCount);

    -- Reset token lookup at the "set new password" step
    CREATE NONCLUSTERED INDEX IX_PasswordResetOTPs_ResetTokenHash
        ON dbo.PasswordResetOTPs (ResetTokenHash)
        WHERE ResetTokenHash IS NOT NULL;

    PRINT 'PasswordResetOTPs table created.';
END
ELSE
    PRINT 'PasswordResetOTPs already exists - no changes made.';
GO