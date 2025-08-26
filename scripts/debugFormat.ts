import { SQLFormatter } from '../src/formatter';

const f = new SQLFormatter();

const cases = {
  insert: `insert into dbo.Users (id,name,age) values (1,'John',30)`,
  group: `select departmentid, count(*) from dbo.Employees group by departmentid having count(*) > 5`,
  delete: `delete from dbo.Users where age < 18`,
  nested: `select id, (select count(*) from dbo.Orders o where o.userid=u.id) as OrderCount from dbo.Users u`,
  union: `select id, name from dbo.Users union select id, name from dbo.Admins`,
  cte: `with ActiveUsers as (select id, name from dbo.Users where isActive = 1) select * from ActiveUsers`,
  top: `select distinct top 10 name from dbo.Products`
};

for (const [k, v] of Object.entries(cases)) {
  console.log('---', k, '---');
  console.log(f.format(v));
  console.log('\n');
}
