const db = require('./database');

const init = async () => {
  await db.run(
    'CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));'
  );
  await db.run(
    'CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);'
  );
  // Indexes
  await db.run('CREATE INDEX userId ON Friends (userId);');
  await db.run('CREATE INDEX friendId ON Friends (friendId);');
  await db.run('CREATE INDEX name ON Users (name);');

  const users = [];
  const names = ['foo', 'bar', 'baz'];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = '';
    for (j = 0; j < 3; ++j) {
      name += names[n % 3];
      n = Math.floor(n / 3);
      name += n % 10;
      n = Math.floor(n / 10);
    }
    users.push(name);
  }
  const friends = users.map(() => []);
  for (i = 0; i < friends.length; ++i) {
    const n = 10 + Math.floor(90 * Math.random());
    const list = [...Array(n)].map(() =>
      Math.floor(friends.length * Math.random())
    );
    list.forEach((j) => {
      if (i === j) {
        return;
      }
      if (friends[i].indexOf(j) >= 0 || friends[j].indexOf(i) >= 0) {
        return;
      }
      friends[i].push(j);
      friends[j].push(i);
    });
  }
  console.log('Init Users Table...');
  await Promise.all(
    users.map((un) => db.run(`INSERT INTO Users (name) VALUES ('${un}');`))
  );
  console.log('Init Friends Table...');
  await Promise.all(
    friends.map((list, i) => {
      return Promise.all(
        list.map((j) =>
          db.run(
            `INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${
              j + 1
            });`
          )
        )
      );
    })
  );
  console.log('Ready.');
};

/**
 * @name search
 * @description Search users
 * @param {*} req
 * @param {*} res
 * @returns {
 * Promise<{
 * success: boolean,
 * users: {
 * id: number,
 * name: string,
 * connection: number
 * }[]
 * }>}
 * */
const search = async (req, res) => {
  console.time('search');
  const query = req.params.query;
  const userId = parseInt(req.params.userId);
  // validate inputs
  if (!userId) {
    res.statusCode = 400;
    return res.json({ success: false, error: 'Invalid userId' });
  }
  if (!query) {
    res.statusCode = 400;
    return res.json({ success: false, error: 'Invalid query' });
  }
  db.all(
    `
  SELECT DISTINCT U.id, U.name, 
    CASE
        WHEN F1.friendId IS NOT NULL THEN 1 -- Direct friend
        WHEN F2.friendId IS NOT NULL THEN 2 -- Friend of a friend (2nd connection)
        ELSE 0 -- No connection
    END AS connection
  FROM Users U
  LEFT JOIN Friends F1 ON U.id = F1.friendId AND F1.userId = ${userId} -- Direct friends
  LEFT JOIN Friends F2 ON F1.friendId = F2.userId AND F2.friendId != ${userId} -- Friends of friends (2nd connection)
  WHERE U.name LIKE '${query}%'
  LIMIT 20;
  `
  )
    .then((results) => {
      res.statusCode = 200;
      res.json({
        success: true,
        users: results,
      });
    })
    .catch((err) => {
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
  console.timeEnd('search');
};

/**
 * @name searchWithDepth
 * @description Search users with depth of friendship
 * @param {*} req
 * @param {*} res
 * @returns {
 * Promise<{
 *  success: boolean,
 *  users: {
 *    id: number,
 *    name: string,
 *    connection: number
 *  }[]
 * }>}
 */
const searchWithDepth = async (req, res) => {
  const depth = parseInt(req.params.depth);
  const query = req.params.query;
  const userId = parseInt(req.params.userId);

  if (!depth || depth < 1 || depth > 40) {
    res.statusCode = 400;
    return res.json({ success: false, error: 'Invalid depth' });
  }

  let sql = `
    SELECT DISTINCT U.id, U.name, 
  `;
  let caseStatement = 'CASE ';
  for (let i = 1; i <= depth; i++) {
    sql += ` LEFT JOIN Friends F${i} ON `;
    if (i === 1) {
      sql += `U.id = F1.friendId AND F1.userId = ${userId}`;
    } else {
      sql += `F${
        i - 1
      }.friendId = F${i}.userId AND F${i}.friendId != ${userId}`;
    }

    caseStatement += `WHEN F${i}.friendId IS NOT NULL THEN ${i} `;
  }
  caseStatement += 'ELSE 0 END AS connection';
  sql += ` WHERE U.name LIKE '${query}%' LIMIT 20;`;

  sql = sql.replace(
    'SELECT DISTINCT U.id, U.name,',
    `SELECT DISTINCT U.id, U.name, ${caseStatement} FROM Users U`
  );
  db.all(sql)
    .then((results) => {
      res.statusCode = 200;
      res.json({
        success: true,
        users: results,
      });
    })
    .catch((err) => {
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

/**
 * @name addFriend
 * @description Add a friend to a user
 * @param {*} req
 * @param {*} res
 * @returns  {
 * Promise<{
 * success: boolean
 * }>}
 */
const addFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);
  const users = await db.all(
    `SELECT id from Users where id in (${userId}, ${friendId});`
  );
  if (users.length < 2) {
    res.statusCode = 400;
    return res.json({ success: false, error: 'Invalid userId or friendId' });
  }
  db.run(
    `INSERT INTO Friends (userId, friendId) VALUES (${userId}, ${friendId});`
  )
    .then(() => {
      res.statusCode = 200;
      res.json({ success: true });
    })
    .catch((err) => {
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

/**
 * @name removeFriend
 * @description Remove a friend from a user
 * @param {*} req
 * @param {*} res
 * @returns  {
 * Promise<{
 * success: boolean
 * }>}
 */

const removeFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);
  const users = await db.all(
    `SELECT id from Users where id in (${userId}, ${friendId});`
  );
  if (users.length < 2) {
    res.statusCode = 400;
    return res.json({ success: false, error: 'Invalid userId or friendId' });
  }
  db.run(
    `DELETE FROM Friends WHERE userId = ${userId} AND friendId = ${friendId};`
  )
    .then(() => {
      res.statusCode = 200;
      res.json({ success: true });
    })
    .catch((err) => {
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

module.exports = {
  init,
  search,
  searchWithDepth,
  addFriend,
  removeFriend,
};
