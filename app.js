const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeAndDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};
initializeAndDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "dheeraj_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//to register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser != undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const newpass = await bcrypt.hash(password, 10);
      let q = `insert into user(name,username,password,gender)
        values('${name}','${username}','${newpass}','${gender}');`;
      let res = await db.run(q);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "dheeraj_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// //API 1
// //Returns a list of all states in the state table
// const convertStateDbObjectAPI1 = (objectItem) => {
//   return {
//     stateId: objectItem.state_id,
//     stateName: objectItem.state_name,
//     population: objectItem.population,
//   };
// };
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  //we should get the ids of whom the user follows
  const getFollowerIdsQ = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowerIds = await db.all(getFollowerIdsQ);
  const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getTweetQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime 
      from user inner join tweet 
      on user.user_id= tweet.user_id where user.user_id in (${getFollowerIdsSimple})
       order by tweet.date_time desc limit 4 ;`;
  const responseResult = await db.all(getTweetQuery);
  //console.log(responseResult);
  response.send(responseResult);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  //we should get the ids of whom the user follows
  const getFollowerIdsQ = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowerIds = await db.all(getFollowerIdsQ);
  const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getTweetQuery = `select name from user where user_id in (${getFollowerIdsSimple});`;
  const responseResult = await db.all(getTweetQuery);
  //console.log(responseResult);
  response.send(responseResult);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  //we should get the ids of whom the user follows
  const getFollowerIdsQ = `select follower_user_id from follower 
    where following_user_id=${getUserId.user_id};`;
  const getFollowerIds = await db.all(getFollowerIdsQ);
  const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  const getTweetQuery = `select name from user where user_id in (${getFollowerIdsSimple});`;
  const responseResult = await db.all(getTweetQuery);
  //console.log(responseResult);
  response.send(responseResult);
});
const Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  //console.log(tweetId);
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  // console.log(getUserId);
  //get the ids of whom the use is following
  const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  //console.log(getFollowingIdsArray);
  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });
  //console.log(getFollowingIds);
  //get the tweets made by the users he is following
  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  // console.log(followingTweetIds);
  //console.log(followingTweetIds.includes(parseInt(tweetId)));
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);
    //console.log(likes_count);
    const reply_count_query = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);
    // console.log(reply_count);
    const tweet_tweetDateQuery = `select tweet, date_time from tweet where tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);
    //console.log(tweet_tweetDate);
    response.send(Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId);
    //get the ids of whom thw use is following
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    //console.log(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `select user.username as likes from user inner join like
       on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);
      //console.log(getLikedUserNamesArray);
      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });

      response.send({
        likes: getLikedUserNames,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId);
    //get the ids of whom thw use is following
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    //console.log(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `select user.name as name,reply.reply as reply from user inner join reply
       on user.user_id=reply.user_id where reply.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);
      console.log(getLikedUserNamesArray);
      //   const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
      //     return {likeseachUser.likes;
      //   });

      response.send({ replies: getLikedUserNamesArray });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  let { tweetId } = request.query;
  //we should get the ids of whom the user follows
  const getTweetsIdsQ = `select tweet_id from tweet 
    where user_id=${getUserId.user_id};`;
  const getFollowerIds = await db.all(getTweetsIdsQ);
  const getTweetsIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.tweet_id;
  });
  console.log(getTweetsIdsSimple);

  const NameandDate = `select tweet as tweet,date_time as dateTime from tweet where tweet_id in (${getTweetsIdsSimple});`;
  const responseResult = await db.all(NameandDate);
  console.log(responseResult);

  const finalans = [];
  for (let i = 0; i < getTweetsIdsSimple.length; i++) {
    const reply_count_query = `select count(user_id) as replies from reply where tweet_id =${getTweetsIdsSimple[i]};`;
    const reply_count = await db.get(reply_count_query);
    //console.log(reply_count);
    const likes_count_query = `select count(user_id) as likes from like where tweet_id =${getTweetsIdsSimple[i]};`;
    const likes_count = await db.get(likes_count_query);
    finalans[i] = {
      tweet: responseResult[i].tweet,
      likes: likes_count.likes,
      replies: reply_count.replies,
      dateTime: responseResult[i].dateTime,
    };
  }

  response.send(finalans);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getTweetsListArray = await db.all(getTweetsListQuery);
    const getTweetsList = getTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getTweetsList);
    if (getTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;
