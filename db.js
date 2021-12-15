var {MongoClient} = require('mongodb');
var url = 'mongodb+srv://admin:ne3words@movie-mindset.tpzis.mongodb.net/movie-mindset?retryWrites=true&w=majority'
var db = null;
var client = null;

async function connect(){
    if (db == null){
    var options = {
        useUnifiedTopology: true,
    }
    client = await MongoClient.connect(url,options);
    db = await client.db("movie-mindset");
    }
    return db;
}

async function registerUser(username,password){
    console.log('hellooooooooooo');
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser!= null){
        throw new Error('user already exists!');
    }
    var max = await conn.collection('users').find().sort({userId:-1}).limit(1);
    var last_user = await max.next();
    var max_id = await last_user.userId;
    console.log(max_id);
    var userId = max_id + 1;
    console.log(userId);
    conn.collection('users').insertOne({userId,username,password});
    return userId;
}


async function login(username,password){
    var conn = await connect();
    var user = await conn.collection('users').findOne({username});

    if (user == null){
        throw new Error('user does not exist');
    }
    var password_compare = await user.password;
    if (!password==password_compare){
        throw new Error('invalid password');
    }
    var userId = await user.userId;
    return userId;
}

async function addRating(userId, movieId, r){
    var conn = await connect();
    var rating = parseInt(r);
    await conn.collection('ratings').insertOne({userId,movieId,rating});
}

async function getMovie(uid){
    var conn = await connect();
    var my_ratings = await conn.collection('ratings').find({userId: uid})
    var result = await my_ratings.toArray()
    var movies = result.map(a => a.movieId);

    var rating = await conn.collection('ratings').aggregate([{$match: {movieId:{$nin: movies}}},{$sample:{size:1}}]);
    
    var rating_data = await rating.next()
    var movieid = await rating_data.movieId

    var movie = await conn.collection('movies').findOne({id: movieid});

    //console.log(movie)
    return movie;
}

async function getRecs(uid){
    var conn = await connect();

    var ratings = await conn.collection('ratings');

    //Get ratings for all movies the current user has seen
    var my_ratings = await ratings.find({userId: uid, rating: {$ne: 0}})

    //Save current user's seen movie IDs to an array
    var result = await my_ratings.toArray()
    var my_movies = result.map(a => a.movieId);
    var my_ratings = result.map(a => a.rating);
    var result = objectify(my_movies, my_ratings);

    var check_result = await ratings.aggregate([{$match:{movieId: {$in: my_movies}}}, {$group:{_id:"$userId", average: {$avg:"$rating"}, ratings: {$push:"$rating"}, movies:{$push:"$movieId"}}}]).toArray();
    
    var all_users = check_result.map(a => a._id)
    var all_movies = check_result.map(a => [a.movies, a.ratings]);

    var all_avgs = check_result.map(a => a.average);

    var sims = {};
    
    for (let i = 1; i < all_movies.length; i++) {
        var user = all_users[i];
        if (all_movies[i].length != 0 && parseInt(user) != uid) {
            var new_result = objectify(all_movies[i][0], all_movies[i][1]);

            var filtered = Object.keys(result)
                .filter(key => Object.keys(new_result).includes(key))
                .reduce((obj, key) => {
                    obj[key] = result[key];
                    return obj;
                }, {});

            var matched_ratings = Object.values(filtered);
            var user_ratings = Object.values(new_result);

            var sum = matched_ratings.reduce((a, b) => a + b, 0);
            var my_avg = (sum / matched_ratings.length) || 0;

            var user_avg = all_avgs[i];

            var my_sub = matched_ratings.map(a => a - my_avg);
            var user_sub = user_ratings.map(a => a - user_avg);

            var num = dot(my_sub, user_sub);

            var sim = 0;
            var den = null;
            if (num != 0) {
                den = Math.sqrt(dot(my_sub, my_sub)*dot(user_sub, user_sub));
                if (den != 0) {
                    sim = num/den;
                }
            } 
            sims[user] = sim;
            //console.log(sim);
        }
    }
    //console.log(sims);

    Object.keys(sims).forEach(key => {
        if (sims[key] <= 0) delete sims[key];
      });

    var pos_sim = Object.keys(sims).map(a => parseInt(a));

    var movie_ratings = await ratings.aggregate([ {$match: {movieId: {$nin: my_movies}, userId: {$in: pos_sim}}}, {$group:{_id:"$movieId", users: {$push:"$userId"}, ratings: {$push:"$rating"}}} ]).toArray()

    var pred = {} 
    for (let i = 0; i < movie_ratings.length; i++) {
        var users = movie_ratings[i].users;
        var sims_cur = users.map(a => sims[a]);
        if (sims_cur.length > 4) {
            var ratings = movie_ratings[i].ratings;
            var pred_num = dot(sims_cur, ratings);
            var pred_den = sims_cur.reduce((a, b) => a + b, 0);
            pred[movie_ratings[i]._id] = Number((pred_num/pred_den).toFixed(2));
        }
    }

    var sortable = [];
    for (var movie in pred) {
        sortable.push([movie, pred[movie]]);
    }

    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });
    console.log(sortable);

    recs = sortable.slice(0,12).map(a => parseInt(a[0]))
    console.log(recs);
    var recs_data = await conn.collection('movies').find({id: {$in: recs}}).toArray();

    var ids = recs_data.map(a => a.id);
    var data = recs_data.map(a => [a.title, a.year, a.poster]);

    var full_recs = objectify(ids, data);

    //console.log(full_recs);
    var final_recs = [];

    for (var a in recs) {
        console.log(recs[a]);
        var id = recs[a];
        console.log(id);
        final_recs.push(full_recs[id]);
    }

    return final_recs;
}

function dot(x,y) {
    var result = x.reduce(function(r,a,i){return r+a*y[i]},0);
    return result;
}

function objectify(a, b) {
    var result = {};
    a.forEach((key, i) => result[key] = b[i]);
    return result
}

function intersect(a, b) {
    return a.filter(Set.prototype.has, new Set(b));
  }

module.exports = {
    login,
    registerUser,
    addRating,
    getMovie,
    getRecs,
    url
}