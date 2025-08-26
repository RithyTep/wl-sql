import * as assert from "assert";
import { SQLFormatter } from "../formatter";

describe("SQL Formatter", () => {
  const f = new SQLFormatter();

  interface TestCase {
    name: string;
    input: string;
    expected: string;
  }

  const cases: TestCase[] = [
    {
      name: "formats stored procedure (README example)",
      input: `
create procedure dbo.GetCustomerData
@webId int,@username nvarchar(50)='',@page int=1
as
select customerid,username from customer c
left join orders o on o.customerid=c.customerid
where c.webid=@webId and c.username=@username
`,
      expected: `CREATE PROCEDURE [dbo].[GetCustomerData]
    @webId INT,
    @username NVARCHAR(50) = '',
    @page INT = 1
AS
SELECT
    [CustomerId], [Username]
FROM [dbo].[Customer] c WITH(NOLOCK)
LEFT JOIN [dbo].[Orders] o WITH(NOLOCK)
    ON o.[CustomerId] = c.[CustomerId]
WHERE c.[WebId] = @webId
    AND c.[Username] = @username`,
    },
    {
      name: "simple SELECT with string & comment preserved",
      input: `select id, name from dbo.Person p where p.id = 1 and name = 'select from' -- do not change select`,
      expected: `SELECT
    [Id], [Name]
FROM [dbo].[Person] p WITH(NOLOCK)
WHERE p.[Id] = 1
    AND [Name] = 'select from' -- do not change select`,
    },
    {
      name: "INSERT statement with values",
      input: `insert into dbo.Users (id,name,age) values (1,'John',30)`,
      expected: `INSERT INTO [dbo].[Users] ([Id], [Name], [Age])
VALUES (1, 'John', 30)`,
    },
    {
      name: "UPDATE with WHERE clause",
      input: `update dbo.Users set name='Jane', age=25 where id=1`,
      expected: `UPDATE [dbo].[Users]
SET [Name] = 'Jane',
    [Age] = 25
WHERE [Id] = 1`,
    },
    {
      name: "DELETE statement with condition",
      input: `delete from dbo.Users where age < 18`,
      expected: `DELETE FROM [dbo].[Users]
WHERE [Age] < 18`,
    },
    {
      name: "SELECT with GROUP BY and HAVING",
      input: `select departmentid, count(*) from dbo.Employees group by departmentid having count(*) > 5`,
      expected: `SELECT
    [DepartmentId], COUNT(*)
FROM [dbo].[Employees] WITH(NOLOCK)
GROUP BY [DepartmentId]
HAVING COUNT(*) > 5`,
    },
    {
      name: "SELECT with ORDER BY and alias",
      input: `select id, name from dbo.Products p order by p.name desc`,
      expected: `SELECT
    [Id], [Name]
FROM [dbo].[Products] p WITH(NOLOCK)
ORDER BY p.[Name] DESC`,
    },
    {
      name: "CASE WHEN expression",
      input: `select id, case when age >= 18 then 'Adult' else 'Minor' end as AgeGroup from dbo.Users`,
      expected: `SELECT
    [Id],
    CASE WHEN [Age] >= 18 THEN 'Adult' ELSE 'Minor' END AS [AgeGroup]
FROM [dbo].[Users] WITH(NOLOCK)`,
    },
    {
      name: "nested subquery",
      input: `select id, (select count(*) from dbo.Orders o where o.userid=u.id) as OrderCount from dbo.Users u`,
      expected: `SELECT
    [Id],
    (
        SELECT COUNT(*)
        FROM [dbo].[Orders] o WITH(NOLOCK)
        WHERE o.[UserId] = u.[Id]
    ) AS [OrderCount]
FROM [dbo].[Users] u WITH(NOLOCK)`,
    },
    {
      name: "UNION between two queries",
      input: `select id, name from dbo.Users union select id, name from dbo.Admins`,
      expected: `SELECT
    [Id], [Name]
FROM [dbo].[Users] WITH(NOLOCK)
UNION
SELECT
    [Id], [Name]
FROM [dbo].[Admins] WITH(NOLOCK)`,
    },
    {
      name: "CTE with SELECT",
      input: `with ActiveUsers as (select id, name from dbo.Users where isActive = 1) select * from ActiveUsers`,
      expected: `WITH ActiveUsers AS (
    SELECT
        [Id], [Name]
    FROM [dbo].[Users] WITH(NOLOCK)
    WHERE [IsActive] = 1
)
SELECT *
FROM ActiveUsers`,
    },
    {
      name: "comment blocks preserved",
      input: `/* test comment */ select id from dbo.Users -- trailing comment`,
      expected: `/* test comment */
SELECT
    [Id]
FROM [dbo].[Users] WITH(NOLOCK) -- trailing comment`,
    },
    {
      name: "multi-join with ON conditions",
      input: `select u.id, o.id from dbo.Users u inner join dbo.Orders o on u.id=o.userid inner join dbo.Payments p on o.id=p.orderid`,
      expected: `SELECT
    u.[Id], o.[Id]
FROM [dbo].[Users] u WITH(NOLOCK)
INNER JOIN [dbo].[Orders] o WITH(NOLOCK)
    ON u.[Id] = o.[UserId]
INNER JOIN [dbo].[Payments] p WITH(NOLOCK)
    ON o.[Id] = p.[OrderId]`,
    },
    {
      name: "TOP and DISTINCT",
      input: `select distinct top 10 name from dbo.Products`,
    expected: `SELECT DISTINCT TOP 10
    [Name]
  FROM [dbo].[Products] WITH(NOLOCK)`,
    },
  ];

  cases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const output = f.format(input);
      assert.strictEqual(output, expected);
    });
  });
});
