import { SQLFormatter } from '../src/formatter';

const sample = `CREATE PROCEDURE [[dbo]].[[GetCustomerData]]
@webId INT, @username NVARCHAR(50) ='', @page INT = 1
AS
SELECT
    [[Customerid]], [[Username]]
FROM [dbo].[Customer] WITH(NOLOCK) c WITH(NOLOCK)
LEFT JOIN [dbo].[Orders] WITH(NOLOCK) o WITH(NOLOCK)
    ON o.[[Customerid]] = c.[[Customerid]]
WHERE c.[[Webid]] = @webId
    AND c.[[Username]] = @username`;

const f = new SQLFormatter();
console.log('--- Original ---');
console.log(sample);
console.log('\n--- First Format ---');
const once = f.format(sample);
console.log(once);
console.log('\n--- Second Format ---');
const twice = f.format(once);
console.log(twice);

console.log('\nIdempotent:', once === twice);
