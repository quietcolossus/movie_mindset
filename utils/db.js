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
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser!= null){
        throw new Error('user already exists!');
    }
    var max = await conn.collection('users').find().sort({userId:-1}).limit(1);
    var last_user = await max.next();
    var max_id = await last_user.userId;
    var userId = max_id + 1;
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

    return movie;
}

async function getRecs(uid){

    //Connect to ratings table of database
    var conn = await connect();
    var ratings = await conn.collection('ratings');

    //Get ratings for all movies the current user has seen
    var my_ratings = await ratings.find({userId: uid, rating: {$ne: 0}})

    //Save current user's seen movie IDs and ratings to an object
    var result = await my_ratings.toArray()
    var my_movies = result.map(a => a.movieId);
    var my_ratings = result.map(a => a.rating);
    var result = objectify(my_movies, my_ratings);

    //Query the database for all ids and ratings of movies the user has has rated, and populate them in a table grouped by user id, also get the average rating from those ratings 

    var check_result = await ratings.aggregate([{$match:{movieId: {$in: my_movies}}}, {$group:{_id:"$userId", average: {$avg:"$rating"}, ratings: {$push:"$rating"}, movies:{$push:"$movieId"}}}]).toArray();
    
    //Breaking down received data into iterable data structures

    var all_users = check_result.map(a => a._id)
    var all_movies = check_result.map(a => [a.movies, a.ratings]);
    var all_avgs = check_result.map(a => a.average);

    var sims = {}; //store the similarities here
    
    //looping through all the results of the query above
    for (let i = 1; i < all_movies.length; i++) {
        var user = all_users[i];

        //filtering out users with no shared rating and the current user
        if (all_movies[i].length != 0 && parseInt(user) != uid) {

            //some data management and restructuring
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

            //the average ratings of shared movies between current user and other user
            var my_avg = (sum / matched_ratings.length) || 0;
            var user_avg = all_avgs[i];

            //subtracting the averages from the ratings
            var my_sub = matched_ratings.map(a => a - my_avg);
            var user_sub = user_ratings.map(a => a - user_avg);
            
            //dot product of the subtracted arrays to get the numerator of the similarity equation 
            var num = dot(my_sub, user_sub);

            var sim = 0;
            var den = null;
            //don't bother getting the denominator if the numerator is 0
            if (num != 0) {
                //denominator is the square root of the product of each subtracted array's dot product with itself (essentially squaring each element and adding them)
                den = Math.sqrt(dot(my_sub, my_sub)*dot(user_sub, user_sub));
                if (den != 0) {
                    sim = num/den;
                }
            } 
            sims[user] = sim;
        }
    }

    //filtering out all non-postitive similarities
    Object.keys(sims).forEach(key => {
        if (sims[key] <= 0) delete sims[key];
      });
    var pos_sim = Object.keys(sims).map(a => parseInt(a));
    
    //querying the ratings database for movies not seen by current user that also have a rating from a user with a positive similarity
    //getting all users that have rated that movie, and the ratings
    var movie_ratings = await ratings.aggregate([ {$match: {movieId: {$nin: my_movies}, userId: {$in: pos_sim}}}, {$group:{_id:"$movieId", users: {$push:"$userId"}, ratings: {$push:"$rating"}}} ]).toArray()

    //Generating predicted ratings for all movies that match the above query, ignoring movies with less than 5 ratings from similar users
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

    //Sorting by highest predicted rating
    var sortable = [];
    for (var movie in pred) {
        sortable.push([movie, pred[movie]]);
    }

    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });

    //Getting the top 12
    recs = sortable.slice(0,12).map(a => parseInt(a[0]))

    //Getting display data for those 12 movies
    var recs_data = await conn.collection('movies').find({id: {$in: recs}}).toArray();
    var ids = recs_data.map(a => a.id);
    var data = recs_data.map(a => [a.title, a.year, a.poster]);
    var full_recs = objectify(ids, data);

    //Some data management for easier parsing on the front end
    var final_recs = [];

    for (var a in recs) {
        var id = recs[a];
        final_recs.push(full_recs[id]);
    }

    //return the recommendations
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