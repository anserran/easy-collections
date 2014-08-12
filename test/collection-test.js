var Collection = require('../lib/collection');

var MongoClient = require('mongodb').MongoClient;
var db;

module.exports = {
    setUp: function(callback) {
        MongoClient.connect('mongodb://127.0.0.1:27017/test', function(err, database) {
            if (err) {
                console.log(err);
            }
            db = database;
            db.collection('games').remove(function() {
                callback();
            });
        });
    },
    tearDown: function(callback) {
        db.close();
        callback();
    },
    testCollection: function(test) {
        test.expect(5);

        var games = new Collection(db, 'games');
        var id;

        games.insert({
            title: 'My title'
        }).then(function(docs) {
            test.ok(docs.length);
            id = docs[0]._id;
            return games.findById(id)
                .then(function(game) {
                    test.strictEqual('My title', game.title);
                });
        }).then(function() {
            return games.setProperty(id, 'title', 'Other title')
                .then(function(result) {
                    test.ok(result);
                });
        }).then(function() {
            return games.findById(id)
                .then(function(game) {
                    test.strictEqual('Other title', game.title);
                });
        }).then(function() {
            return games.removeById(id);
        }).then(function() {
            return games.count().then(function(count) {
                test.strictEqual(count, 0);
            });
        }).fail(function(err) {
            test.ok(false, err.stack);
        }).then(function() {
            test.done();
        });
    },
    testPreremove: function(test) {
        test.expect(2);
        var ids = [];
        var games = new Collection(db, 'games');

        var pre = function(objectID, next) {
            ids.pop();
            next();
        };
        games.preRemove(pre);

        games.insert()
            .then(function(id) {
                ids.push(id);
                return games.insert().then(function(id) {
                    ids.push(id);
                    return games.insert().then(function(id) {
                        ids.push(id);
                    });
                });
            }).then(function() {
                console.log(ids);
                test.strictEqual(3, ids.length);
                return games.remove();
            }).then(function() {
                test.strictEqual(0, ids.length);
            }).fail(function(err) {
                test.ok(false, err.stack);
            }).then(function() {
                test.done();
            });
    }
};