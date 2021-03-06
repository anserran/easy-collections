var Collection = require('../lib/collection');

var MongoClient = require('mongodb').MongoClient;
var db;

module.exports = {
    setUp: function (callback) {
        MongoClient.connect('mongodb://127.0.0.1:27017/easy-collection-test', function (err, database) {
            if (err) {
                console.log(err);
            }
            db = database;
            db.dropDatabase(function () {
                callback();
            });
        });
    },
    tearDown: function (callback) {
        db.dropDatabase(function () {
            db.close();
            callback();
        });
    },
    testCollection: function (test) {
        test.expect(7);

        var games = new Collection(db, 'games');
        var id;

        games.insert({
            title: 'My title'
        }).then(function (docs) {
            id = docs._id;
            return games.findById(id)
                .then(function (game) {
                    test.strictEqual('My title', game.title);
                });
        }).then(function () {
            return games.findAndModify(id, {
                'title': 'Other title'
            }).then(function (result) {
                test.ok(result);
            });
        }).then(function () {
            return games.findById(id)
                .then(function (game) {
                    test.strictEqual('Other title', game.title);
                });
        }).then(function () {
            return games.findAndModify(id, {'title': 'Wrong title'}, {'title': 'New title'})
                .then(function (result) {
                    test.ok(!result);
                }).fail(function (err) {
                    test.ok(err);
                });
        }).then(function () {
            return games.findAndModify(id, {'title': 'Other title'}, {
                title: 'Ñor'
            }).then(function (result) {
                test.strictEqual(result.title, 'Ñor');
            });
        }).then(function () {
            return games.removeById(id);
        }).then(function (result) {
            test.strictEqual(result._id.toString(), id.toString());
            return games.count().then(function (count) {
                test.strictEqual(count, 0);
            });
        }).fail(function (err) {
            test.ok(false, err.stack);
        }).then(function () {
            test.done();
        });
    },
    testPreremove: function (test) {
        test.expect(2);
        var ids = [];
        var games = new Collection(db, 'games');

        games.setPreRemove(function () {
            ids.pop();
        });

        games.insert({})
            .then(function (game) {
                ids.push(game._id);
                return games.insert({}).then(function (game) {
                    ids.push(game._id);
                    return games.insert({}).then(function (game) {
                        ids.push(game._id);
                    });
                });
            }).then(function () {
                console.log(ids);
                test.strictEqual(3, ids.length);
                return games.remove();
            }).then(function () {
                test.strictEqual(0, ids.length);
            }).fail(function (err) {
                test.ok(false, err.stack);
            }).then(function () {
                test.done();
            });
    },
    testFilter: function (test) {
        test.expect(8);

        var users = new Collection(db, 'users');
        users.setFilter(function (user) {
            delete user.password;
            return user;
        });
        var userId;

        users.insert({
            name: 'admin',
            password: 'ñor'
        }).then(function (user) {
            userId = user._id;
            test.strictEqual(user.name, 'admin');
            test.strictEqual(user.password, undefined);
        }).then(function () {
            return users.findById(userId);
        }).then(function (user) {
            test.strictEqual(user.name, 'admin');
            test.strictEqual(user.password, undefined);
            return users.findAndModify(userId, {
                name: 'admin2'
            });
        }).then(function (user) {
            test.strictEqual(user.name, 'admin2');
            test.strictEqual(user.password, undefined);
            return users.removeById(user._id);
        }).then(function (user) {
            test.strictEqual(user.name, 'admin2');
            test.strictEqual(user.password, undefined);
        }).fail(function (err) {
            console.log(err);
            test.ok(false);
        }).then(function () {
            test.done();
        });
    },
    testValidator: function (test) {
        test.expect(3);

        var users = new Collection(db, 'users');

        users.setInsertValidator(function (user) {
            var valid = user.name && user.password;
            if (valid) {
                return users.find({
                    name: user.name
                }, true).then(function (otherUser) {
                    if (otherUser) {
                        return null;
                    } else {
                        return user;
                    }
                });
            } else {
                return false;
            }
        });

        users.setUpdateValidator(function (user, id) {
            for (var key in user) {
                if (key !== 'password') {
                    return null;
                }
            }
            return user;
        });

        var userId;

        users.insert({
            name: 'admin'
        }).fail(function (err) {
            console.log(JSON.stringify(err));
            test.ok(err);
            return users.insert({
                name: 'admin',
                password: 'ñor'
            });
        }).then(function (user) {
            userId = user._id;
            return users.findAndModify(user._id, {
                name: 'admin2'
            });
        }).fail(function (err) {
            console.log(JSON.stringify(err));
            test.ok(err);
            return users.findAndModify(userId, {
                password: 'do'
            });
        }).then(function (user) {
            console.log(user);
            test.strictEqual(user.password, 'do');
        }).fail(function (err) {
            test.ok(false, 'Final error: ' + JSON.stringify(err));
        }).then(function () {
            test.done();
        });
    },
    testExist: function (test) {
        test.expect(2);
        Collection.exists(db, 'ñor')
            .then(function (exists) {
                test.ok(!exists);
                var collection = new Collection(db, 'totally_exists');
                return collection.insert({}).then(function () {
                    return Collection.exists(db, 'totally_exists').then(function (result) {
                        test.ok(result);
                    });
                });
            }).fail(function (err) {
                console.log(err);
                test.ok(false);
            }).then(function () {
                test.done();
            });
    }
};