# friendship-task

### 1- Implement the friend and unfriend routes:

### 2- Improve Search query to display 2nd if user is friend-of-a-friend

```
http://localhost:3001/api/search/:userId/:query

```

### 3- Can you get this to work for 3rd and 4th connections as well?

```
Yes we can make depth of connections dynamic by providing depth number.
 implemented in endpoint:
http://localhost:3001/api/depth/:userId/:query/:depth

 performance will be affected by:
 1- Dataset size
 2- Depth number because we need joint statements equal to depth number
 for example if we need 4th connections we need to have 4 join statements

 * I have added indexes(friendId, userId) in "Friends" table and (name) in "Users" table to improve the performance in "init" function

```

### additional recommendations

implementing a caching layer can significantly reduce the load on the database.
