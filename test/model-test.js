var Collection = require('../lib/collection');

var MongoClient = require('mongodb').MongoClient;
var db;


function MyObject() {

}

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
    testModel: function (test) {

        test.expect(8);

        var model = {
            'user': {
                type: 'string',
                required: true
            },
            'password': {
                type: 'string',
                required: true
            },
            'age': {
                type: 'number'
            },
            'married': {
                type: 'boolean'
            },
            'enabled': {
                type: 'boolean',
                default: true
            },
            'resources': {
                type: 'object',
                model: {
                    'create': {
                        type: 'number',
                        required: true
                    },
                    'read': {
                        type: 'boolean'
                    }
                }
            },
            classObject: {
                type: 'object',
                class: 'MyObject'
            }
        };

        var collection = new Collection(db, 'model-collection', model);

        collection.insert({})
            .fail(function (err) {
                test.strictEqual(err.code, 'E_INVALID_DOCUMENT')
                return collection.insert({
                    user: 'admin',
                    password: 'admin',
                    age: 10,
                    married: true,
                    resources: {create: 5, read: false},
                    classObject: new MyObject()
                });
            }).then(function (user) {
                test.ok(user);
                test.ok(user.enabled);
                return collection.findAndModify(user._id, {age: 14, married: false})
            }).then(function (user) {
                test.strictEqual(user.age, 14);
                test.strictEqual(user.married, false);
                return collection.findAndModify(user._id, {age: 'ñor'})
            }).fail(function (err) {
                test.strictEqual(err.code, 'E_INVALID_DOCUMENT');
                return collection.insert({user: 'admin', password: 'admin', resources: {}})
            }).fail(function (err) {
                test.strictEqual(err.code, 'E_INVALID_DOCUMENT');
                return collection.insert({user: 'admin', password: 'admin', whatever: 'ñor'});
            }).fail(function (err) {
                test.strictEqual(err.code, 'E_INVALID_DOCUMENT');
            }).then(function () {
                test.done()
            });
    }
};
