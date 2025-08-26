CREATE PROCEDURE [dbo].[Coloris_GameProvider_GetCustomerRecordReport_2.0.0] @page INT,
@rowCountPerPage INT,
@webId INT,
@startDate DATETIME,
@endDate DATETIME,
@filterUsername NVARCHAR(50) = '' AS
SET
  [NOCOUNT] ON;

BEGIN DECLARE @searchedCustomerId INT = 0;

IF(@filterUsername != '') BEGIN
SELECT
  @searchedCustomerId = [CustomerId]
FROM
  [Main].[dbo].[Customer] WITH (NOLOCK)
WHERE
  [WebId] = @webId
  AND [Username] = @filterUsername;

IF @searchedCustomerId IS NULL
OR @searchedCustomerId = 0 BEGIN
SELECT
  808 AS [ErrorCode],
  'User Not Found' AS [ErrorMessage] RETURN
END
END DECLARE @timeZone NVARCHAR(100);

SELECT
  @timeZone = [TimeZoneName]
FROM
  [Account].[dbo].[Company] WITH(NOLOCK)
WHERE
  [WebId] = @webId;

DECLARE @isGmtMinus4 BIT = CASE
  WHEN @timeZone = 'SA Western Standard Time' THEN 1
  ELSE 0
END;

DECLARE @statusStreamer INT = 32768;

CREATE TABLE #[playerList] (
[WebId] INT,
[CustomerId] INT,
[UserName] NVARCHAR(50),
[CreatedOn] DATETIME,
[IsAbleToSearch] BIT
);

INSERT [INTO]
  #[playerList] ([WebId],[CustomerId],[UserName],[CreatedOn],[IsAbleToSearch])
SELECT
  [WebId],
  [CustomerId],
  [UserName],
  [CreatedOn],
  1 AS [IsAbleToSearch]
FROM
  [Main].[dbo].[Customer] WITH (NOLOCK)
WHERE
  [WebId] = @webId
  AND [AccountType] = 1
  AND [CustomerStatus] & @statusStreamer <> @statusStreamer
  AND (
    @searchedCustomerId = 0
    OR [CustomerId] = @searchedCustomerId
  );

CREATE NONCLUSTERED INDEX [IX_playerList_CustomerId_WebId] ON #[playerList] ([CustomerId], [WebId]);
IF NOT EXISTS (
  SELECT
    1
  FROM
    #[playerList])
    BEGIN
  SELECT
    808 AS [ErrorCode],
    'User Not Found' AS [ErrorMessage] RETURN
END CREATE TABLE #[bets]
(
  [WebId] INT,
  [CustomerId] INT,
  [ProductType] INT,
  [GameType] INT,
  [DisplayName] NVARCHAR(50),
  [Username] NVARCHAR(50),
  [Currency] CHAR(3),
  [RefNo] NVARCHAR(100),
  [MainSportType] NVARCHAR(50),
  [SubSportType] NVARCHAR(50),
  [OrderTime] DATETIME,
  [BetOption] NVARCHAR(100),
  [SubBetOdds] DECIMAL(12, 3),
  [MarketType] NVARCHAR(150),
  [BetType] INT,
  [HandicapPoint] DECIMAL(12, 2),
  [LiveScore] NVARCHAR(50),
  [HalfTimeScore] NVARCHAR(50),
  [FullTimeScore] NVARCHAR(50),
  [Match] NVARCHAR(150),
  [CustomizedBetType] NVARCHAR(100),
  [KickOffTime] DATETIME,
  [League] NVARCHAR(150),
  [WinLoseDate] DATETIME,
  [MainBetOdds] DECIMAL(12, 3),
  [OddsStyle] NVARCHAR(10),
  [Stake] DECIMAL(19, 6),
  [ActualStake] DECIMAL(19, 6),
  [NetTurnover] DECIMAL(19, 6),
  [Status] NVARCHAR(50),
  [SubBetStatus] NVARCHAR(50),
  [ExchangeRate] DECIMAL(10, 6),
  [IsShowBetDetailButton] BIT,
  [GameProviderId] INT,
  [GameProviderType] INT,
  [CreatedOn] DATETIME,
  [TableName] NVARCHAR(100),
  [GameId] NVARCHAR(100),
  [GameName] NVARCHAR(50),
  [MemberWinLose] DECIMAL(19, 6),
  [MemberCommission] DECIMAL(19, 6),
  [Ip] NVARCHAR(100),
  [IsLiveBet] BIT,
  [OrderDetail] NVARCHAR(4000),
  [MatchTimeOrScoreAtThatTime] NVARCHAR(4000),
  [RollbackTime] DATETIME,
  [ResettleTime] DATETIME,
  [IsResettled] BIT,
  [VoidReason] NVARCHAR(500),
  [IsCashOut] BIT,
  [GameRoundId] NVARCHAR(100) DEFAULT '',
  [GamePeriodId] NVARCHAR(100) DEFAULT '',
  [SettledTime] DATETIME,
  [IsHalfWinlose] BIT,
  [IsAbleToSearch] BIT
);

CREATE TABLE #[tmpResettle] ([WebId] INT, [RefNo] NVARCHAR(100), [CreatedOn] DATETIME, [ModifiedOn] DATETIME);
;

WITH [cteResettle] AS (
  SELECT
    b.[WebId],
    b.[RefNo],
    b.[CreatedOn],
    b.[ModifiedOn],
    ROW_NUMBER() OVER (
      PARTITION BY b.[RefNo]
      ORDER BY
        b.[CreatedOn] DESC
    ) AS [rn]
  FROM
    [SboResettledBet] b WITH(NOLOCK)
    INNER JOIN #[playerList] p ON b.[CustomerId] = p.[customerId] AND b.[WebId] = p.[WebId]
  WHERE
    b.[WebId] = @webId
)
INSERT [INTO]
  #[tmpResettle] ([WebId], [RefNo], [CreatedOn], [ModifiedOn])
SELECT
  [WebId],
  [RefNo],
  [CreatedOn],
  [ModifiedOn]
FROM
  [cteResettle]
WHERE
  [rn] = 1;

-- Sports (SBO)
INSERT [INTO]
  #[bets]
SELECT
  p.[webId],
  p.[customerId],
  1,
  CASE
    WHEN [betFrom] = 'lv' THEN 2
    WHEN b.[BetType] = 666 THEN 3
    ELSE 1
  END,
  CASE
    WHEN [betFrom] = 'lv' THEN 'SBO Live Video'
    WHEN b.[BetType] = 666 THEN 'Sports-P2P'
    ELSE 'SBO Sports'
  END,
  b.[Username],
  b.[Currency],
  b.[RefNo],
  b.[SportsType] AS [MainBetSportsType],
  [bd].[SportType] AS [SubBetSportsType],
  b.[OrderTime],
  [bd].[BetOption],
  [bd].[Odds] AS [SubBetOdds],
  [bd].[MarketType],
  [bd].[BetType],
  [bd].[HandicapPoint],
  [bd].[LiveScore],
  [bd].[HalfTimeScore],
  [bd].[FullTimeScore],
  CASE
    WHEN b.[BetType] = 666 THEN 'Sports-P2P'
    ELSE [bd].[Match]
  END,
  [bd].[CustomizedBetType],
  [bd].[KickOffTime],
  [bd].[League],
  CASE
    WHEN @isGmtMinus4 = 1 THEN b.[WinlostDate]
    ELSE b.[WinlostDateByTimeZone]
  END AS [WinLoseDate],
  b.[Odds] AS [mainBetOdds],
  b.[OddsStyle],
  b.[Stake],
  b.[ActualStake],
  CASE
    WHEN b.[Status] IN ('won', 'lose')
    AND b.[IsHalfWinLose] = 'false'
    AND b.[IsCashOut] = 'false' THEN b.[ActualStake]
    WHEN b.[Status] IN ('won', 'lose')
    AND b.[IsHalfWinLose] = 'true'
    AND b.[IsCashOut] = 'false' THEN b.[ActualStake] / 2
    ELSE 0
  END AS [NetTurnover],
  CASE
    WHEN b.[Status] = 'void' THEN b.[StatusAtGameProvider]
    ELSE CASE
      WHEN b.[IsHalfWinLose] = 1 THEN 'Half ' + b.[Status]
      ELSE b.[Status]
    END
  END,
  CASE
    WHEN [bd].[IsHalfWinlose] = 1 THEN 'Half ' + [bd].[Status]
    ELSE [bd].[Status]
  END,
  b.[ExchangeRate],
  0 AS [IsShowBetDetailButton],
  -1 AS [GameProviderId],
  1 AS [GameProviderType],
  p.[CreatedOn],
  '',
  '',
  b.[SportsType],
  b.[Winlost],
  b.[PlayerComm],
  b.[Ip],
  b.[IsLive],
  '',
  CASE
    WHEN b.[isLive] = 1 THEN 'Live! ' + [bd].[LiveScore]
    ELSE CONVERT(VARCHAR(20), [bd].[KickOffTime], 120)
  END AS [MatchTimeOrScoreAtThatTime],
  r.[CreatedOn] AS [RollbackTime],
  r.[ModifiedOn] AS [ResettleTime],
  CASE
    WHEN r.[CreatedOn] IS NULL THEN 0
    ELSE 1
  END AS [IsResettled],
  b.[VoidReason],
  b.[IsCashOut],
  '',
  '',
  CASE
    WHEN b.[Status] IN('won', 'lose', 'draw') THEN b.[ModifiedTime]
    ELSE NULL
  END,
  b.[IsHalfWinLose],
  p.[IsAbleToSearch]
FROM
  [vSboSportBets60] b WITH(NOLOCK)
  JOIN [vSboSportBetDetails60] [bd] WITH(NOLOCK) ON b.[RefNo] = [bd].[RefNo]
  LEFT JOIN #[tmpResettle] r ON b.[WebId] = r.[WebId] AND b.[RefNo] = r.[RefNo]
  INNER JOIN #[playerList] p ON b.[WebId] = p.[webId] AND b.[CustomerId] = p.[customerId]
WHERE
  b.[WebId] = @webId
  AND b.[OrderTime] BETWEEN @startDate
  AND @endDate;

-- Virtual Sports
INSERT [INTO]
  #[bets]
SELECT
  p.[webId],
  p.[customerId],
  4,
  -1,
  'SBO Virtual Sports',
  [vsb].[username],
  [vsb].[Currency],
  [vsb].[RefNo],
  [vsb].[ProductType],
  '',
  [vsb].[OrderTime],
  [vsbd].[BetOption],
  [vsbd].[Odds] AS [SubBetOdds],
  [vsbd].[MarketType],
  0 AS [BetType],
  CASE
    WHEN [TRY_CONVERT](DECIMAL(12, 3), [vsbd].[Hdp]) IS NULL THEN 0
    ELSE CONVERT(DECIMAL(12, 3), [vsbd].[Hdp])
  END,
  '',
  [vsbd].[HalfTimeScore],
  [vsbd].[FullTimeScore],
  [vsbd].[Match],
  '',
  CASE
    WHEN @isGmtMinus4 = 1 THEN CONVERT(DATE, [vsb].[WinlostDate])
    ELSE CONVERT(DATE, [vsb].[WinlostDateByTimeZone])
  END AS [KickOffTime],
  [vsbd].[Hdp] AS [League],
  CASE
    WHEN @isGmtMinus4 = 1 THEN CONVERT(DATE, [vsb].[WinlostDate])
    ELSE CONVERT(DATE, [vsb].[WinlostDateByTimeZone])
  END AS [WinLoseDate],
  [vsb].[Odds] AS [mainBetOdds],
  '',
  [vsb].[Stake],
  [vsb].[ActualStake],
  CASE
    WHEN [vsb].[Status] IN ('won', 'lose') THEN [vsb].[ActualStake]
    ELSE 0
  END AS [NetTurnover],
  [vsb].[Status],
  [vsbd].[Status],
  [vsb].[ActualRate],
  0 AS [IsShowBetDetailButton],
  -1 AS [GameProviderId],
  4 AS [GameProviderType],
  p.[CreatedOn],
  '',
  CONVERT(NVARCHAR(50), [GameId]),
  [vsb].[ProductType],
  [vsb].[Winlost],
  [vsb].[PlayerComm],
  '-',
  0,
  '',
  '',
  NULL AS [RollbackTime],
  NULL AS [ResettleTime],
  0 AS [IsResettled],
  '' AS [VoidReason],
  0 AS [IsCashOut],
  '',
  '',
  CASE
    WHEN [vsb].[Status] IN('won', 'lose', 'draw') THEN [vsb].[ModifiedTime]
    ELSE NULL
  END,
  0 AS [IsHalfWinlose],
  p.[IsAbleToSearch]
FROM
  [vSboVirtualSportBets60] [vsb] WITH(NOLOCK)
  LEFT JOIN [vSboVirtualSportSubBets60] [vsbd] WITH(NOLOCK) ON [vsb].[RefNo] = [vsbd].[RefNo]
  INNER JOIN #[playerList] p ON [vsb].[WebId] = p.[webId] AND [vsb].[CustomerId] = p.[customerId]
WHERE
  [vsb].[WebId] = @webId
  AND [vsb].[OrderTime] BETWEEN @startDate
  AND @endDate;

-- ThirdParty Sports
INSERT [INTO]
  #[bets]
SELECT
  p.[webId],
  p.[customerId],
  6,
  ISNULL(g.[ReportGameProviderId], -1),
  g.[DisplayName],
  b.[Username],
  b.[Currency],
  b.[RefNo],
  [bd].[SportType] AS [MainBetSportsType],
  [bd].[SportType] AS [SubBetSportsType],
  b.[OrderTime],
  [bd].[BetOption],
  [bd].[Odds] AS [SubBetOdds],
  [bd].[MarketType],
  0,
  [bd].[HandicapPoint],
  CONVERT(NVARCHAR, [bd].[LiveHomeScore]) + ':' + CONVERT(NVARCHAR, [bd].[LiveAwayScore]) AS [LiveScore],
  [bd].[HalfTimeScore],
  [bd].[FullTimeScore],
  ISNULL([bd].[HomeTeam], '') + ' vs ' + ISNULL([bd].[AwayTeam], '') AS [Match],
  '',
  CASE
    WHEN @isGmtMinus4 = 1 THEN ISNULL([bd].[WinlostDate], b.[WinlostDate])
    ELSE ISNULL(
      [bd].[WinlostDateByTimeZone],
      b.[WinlostDateByTimeZone]
    )
  END,
  ISNULL([bd].[League], ''),
  CASE
    WHEN @isGmtMinus4 = 1 THEN ISNULL([bd].[WinlostDate], b.[WinlostDate])
    ELSE ISNULL(
      [bd].[WinlostDateByTimeZone],
      b.[WinlostDateByTimeZone]
    )
  END AS [WinLoseDate],
  b.[Odds] AS [mainBetOdds],
  b.[OddsStyle],
  b.[Stake],
  b.[ActualStake],
  CASE
    WHEN b.[Status] IN ('won', 'lose')
    AND b.[IsHalfWinLose] = 'false'
    AND b.[StatusAtGameProvider] <> 'cashout' THEN b.[ActualStake]
    WHEN b.[Status] IN ('won', 'lose')
    AND b.[IsHalfWinLose] = 'true'
    AND b.[StatusAtGameProvider] <> 'cashout' THEN b.[ActualStake] / 2
    ELSE 0
  END AS [NetTurnover],
  CASE
    WHEN b.[Status] = 'void' THEN b.[StatusAtGameProvider]
    ELSE b.[Status]
  END,
  [bd].[Status],
  b.[ExchangeRate],
  g.[IsShowBetDetailButton],
  g.[GameProviderId],
  g.[GameProviderType],
  p.[CreatedOn],
  '',
  '',
  CASE
    WHEN b.[IsParlay] = 1 THEN 'Mix Parlay'
    ELSE [bd].[SportType]
  END AS [GameName],
  b.[Winlost],
  b.[PlayerComm],
  b.[Ip],
  [bd].[IsLive],
  '',
  CASE
    WHEN [bd].[IsLive] = 1 THEN 'Live! ' + CONVERT(NVARCHAR, [bd].[LiveHomeScore]) + ':' + CONVERT(NVARCHAR, [bd].[LiveAwayScore])
    ELSE CONVERT(
      VARCHAR(20),
      CASE
        WHEN @isGmtMinus4 = 1 THEN [bd].[WinlostDate]
        ELSE [bd].[WinlostDateByTimeZone]
      END,
      120
    )
  END AS [MatchTimeOrScoreAtThatTime],
  NULL AS [RollbackTime],
  NULL AS [ResettleTime],
  0 AS [IsResettled],
  '' AS [VoidReason],
  CASE
    WHEN b.[StatusAtGameProvider] = 'cashout' THEN 1
    ELSE 0
  END AS [IsCashOut],
  b.[GameRoundId],
  b.[GamePeriodId],
  CASE
    WHEN b.[Status] IN('won', 'lose', 'draw') THEN b.[ModifiedTime]
    ELSE NULL
  END,
  b.[IsHalfWinlose],
  p.[IsAbleToSearch]
FROM
  [vSboThirdPartySportBets60] b WITH(NOLOCK)
  LEFT JOIN [vSboThirdPartySportBetDetails60] [bd] WITH(NOLOCK) ON b.[RefNo] = [bd].[RefNo]
  AND [bd].[Language] = 'en'
  INNER JOIN [vAllGameProvidersForReport] g WITH(NOLOCK) ON b.[GPID] = g.[GameProviderId]
  AND (
    g.[GameProviderProductType] IS NULL
    OR (
      b.[ProductType] IS NULL
      AND 'Sports' = g.[GameProviderProductType]
    )
    OR (b.[ProductType] = g.[GameProviderProductType])
  )
  INNER JOIN #[playerList] p ON b.[WebId] = p.[webId] AND b.[CustomerId] = p.[customerId]
WHERE
  b.[WebId] = @webId
  AND b.[OrderTime] BETWEEN @startDate
  AND @endDate;

SELECT
  0 AS [errorCode],
  'success' AS [errorMessage];

CREATE NONCLUSTERED INDEX [IX_tmpbets_RefNo_OrderTime] ON #[bets] ([RefNo], [OrderTime] DESC);
DECLARE @totalBetCount INT;

SELECT
  @totalBetCount = COUNT(DISTINCT [RefNo])
FROM
  #[bets];
;

WITH [Paged] AS (
  SELECT
    [MaxPage] = CASE
      WHEN @totalBetCount % @rowCountPerPage = 0 THEN @totalBetCount / @rowCountPerPage
      ELSE @totalBetCount / @rowCountPerPage + 1
    END,
    DENSE_RANK() OVER(
      ORDER BY
        [OrderTime] DESC,
        [RefNo] DESC
    ) AS [RowNumber],
    [ProductType],
    [GameType],
    [DisplayName],
    [Username],
    [Currency],
    [RefNo],
    [MainSportType],
    [SubSportType],
    [OrderTime],
    ISNULL([BetOption], '') AS [BetOption],
    [SubBetOdds],
    ISNULL([MarketType], '') AS [MarketType],
    [BetType],
    [HandicapPoint],
    ISNULL([LiveScore], '') AS [LiveScore],
    [HalfTimeScore],
    [FullTimeScore],
    ISNULL([Match], '') AS [Match],
    [CustomizedBetType],
    [KickOffTime],
    [League],
    [WinLoseDate] AS [WinLostDate],
    [MainBetOdds],
    [OddsStyle],
    [Stake],
    [ActualStake],
    [Status],
    [SubBetStatus],
    [ExchangeRate],
    [IsShowBetDetailButton],
    [GameProviderId],
    [GameProviderType],
    [CreatedOn],
    [TableName],
    [GameId],
    [GameName],
    [MemberWinLose],
    [MemberCommission],
    [Ip],
    [IsLiveBet],
    [OrderDetail],
    [MatchTimeOrScoreAtThatTime],
    [RollbackTime],
    [ResettleTime],
    [IsResettled],
    [VoidReason],
    [CustomerId],
    [IsCashOut],
    [GameRoundId],
    [GamePeriodId],
    [SettledTime],
    [IsAbleToSearch],
    CASE
      WHEN [OddsStyle] IN ('E', 'EU', 'Euro', 'Decimal') THEN CASE
        WHEN [GameProviderId] = 1015 THEN [Stake] * ([MainBetOdds] + 1)
        ELSE [Stake] * [MainBetOdds]
      END
      WHEN [OddsStyle] IN ('H', 'HK', 'Hongkong') THEN [Stake] * ([MainBetOdds] + 1)
      WHEN [OddsStyle] IN (
        'I',
        'ID',
        'Indo',
        'IndoOdds',
        'M',
        'MY',
        'Malay'
      ) THEN CASE
        WHEN [MainBetOdds] > 0 THEN [Stake] * ([MainBetOdds] + 1)
        WHEN [MainBetOdds] < 0 THEN [ActualStake] + ([ActualStake] / -([MainBetOdds]))
      END
      ELSE [Stake] * [MainBetOdds]
    END AS [EstimateMaxPayoutAmount],
    [ActualStake] AS [EstimateTaxableAmount],
    CASE
      WHEN [MemberWinLose] > 0 THEN 0
      ELSE - [MemberWinLose]
    END AS [TaxableAmount]
  FROM
    #[bets]
)
SELECT
  p.[MaxPage],
  p.[RowNumber],
  p.[ProductType],
  p.[GameType],
  p.[DisplayName],
  p.[Username],
  p.[Currency],
  p.[RefNo],
  p.[MainSportType],
  p.[SubSportType],
  p.[OrderTime],
  p.[BetOption],
  p.[SubBetOdds],
  p.[MarketType],
  p.[BetType],
  p.[HandicapPoint],
  p.[LiveScore],
  p.[HalfTimeScore],
  p.[FullTimeScore],
  p.[Match],
  p.[CustomizedBetType],
  p.[KickOffTime],
  p.[League],
  p.[WinLostDate],
  p.[MainBetOdds],
  p.[OddsStyle],
  p.[Stake],
  p.[ActualStake],
  p.[Status],
  p.[SubBetStatus],
  p.[ExchangeRate],
  p.[IsShowBetDetailButton],
  p.[GameProviderId],
  p.[GameProviderType],
  p.[CreatedOn],
  p.[TableName],
  p.[GameId],
  p.[GameName],
  p.[MemberWinLose],
  p.[MemberCommission],
  p.[Ip],
  p.[IsLiveBet],
  p.[OrderDetail],
  p.[MatchTimeOrScoreAtThatTime],
  p.[RollbackTime],
  p.[ResettleTime],
  p.[IsResettled],
  p.[VoidReason],
  p.[CustomerId],
  p.[IsCashOut],
  p.[GameRoundId],
  p.[GamePeriodId],
  p.[SettledTime],
  p.[IsAbleToSearch],
  ISNULL([phone_val].[Value], '') AS [Phone],
  ISNULL([address_val].[Value], '') AS [Address],
  ISNULL([identity_val].[Value], '') AS [IdentityCardNumber],
  p.[EstimateMaxPayoutAmount],
  p.[EstimateTaxableAmount],
  p.[TaxableAmount]
FROM
  [Paged] p
  LEFT JOIN [Main].[dbo].[CompanyFlowCustomizeValue] [phone_val] WITH(NOLOCK) ON [phone_val].[WebId] = @webId
  AND [phone_val].[CustomerId] = p.[CustomerId]
  AND [phone_val].[PropertyName] = 'Phone'
  LEFT JOIN [Main].[dbo].[CompanyFlowCustomizeValue] [address_val] WITH(NOLOCK) ON [address_val].[WebId] = @webId
  AND [address_val].[CustomerId] = p.[CustomerId]
  AND [address_val].[PropertyName] = 'Address'
  LEFT JOIN [Main].[dbo].[CompanyFlowCustomizeValue] [identity_val] WITH(NOLOCK) ON [identity_val].[WebId] = @webId
  AND [identity_val].[CustomerId] = p.[CustomerId]
  AND [identity_val].[PropertyName] = 'ID'
WHERE
  p.[RowNumber] BETWEEN (@page - 1) * @rowCountPerPage + 1
  AND @page * @rowCountPerPage;

DROP TABLE #[tmpResettle];
DROP TABLE #[bets];
DROP TABLE #[playerList];
END
