var Q = require('q');
var async = require('async');
var ObjectID = require('mongodb').ObjectID;


var Collection = function(db, name) {
    this.db = db;
    this.collection = db.collection(name);
    this.preRemoves = [];
};

/**
 * Inserts an object in the collection. Returns a promise with the ObjectID of the recently
 * created object.
 */
Collection.prototype.insert = function(object) {
    var deferred = Q.defer();
    this.collection.insert(object || {}, function(err, docs) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(docs);
        }
    });
    return deferred.promise;
};

/**
 * Sets the property with the given value to an object contained by the collection.
 * If no object with the given ID is found, nothing happens. If the property does not exist,
 * it is automatically created.
 * @param {ObjectID} objectID mongo id of the object
 * @param {string} propertyName name of the property
 * @param {Object} propertyValue value of the property
 */
Collection.prototype.setProperty = function(objectID, propertyName, propertyValue) {
    var deferred = Q.defer();
    var set = {};
    set [propertyName] = propertyValue;

    this.collection.update({
        _id: toObjectID(objectID)
    }, {
        $set: set
    }, function(err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(true);
        }
    });
    return deferred.promise;
};

Collection.prototype.findAndModify = function(objectID, set) {
    var deferred = Q.defer();
    this.collection.findAndModify({
        _id: toObjectID(objectID)
    }, [
        ['_id', 'asc']
    ], {
        $set: set
    }, {
        new: true
    }, function(err, object) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(object);
        }
    });
    return deferred.promise;
};

/**
 * Removes objects in the collection
 * @param  {Object} where clause
 */
Collection.prototype.remove = function(where) {
    var that = this;
    return this.find(where || {}).then(function(results) {
        var removes = [];
        for (var i = 0; i < results.length; i++) {
            removes.push(that.removeById(results[0]._id));
        }
        return Q.all(removes);
    });
};

/**
 * Removes the object with the given objectID
 * @return {Object} a promise with the result
 */
Collection.prototype.removeById = function(objectID) {
    var that = this;
    return this.executePreRemove(toObjectID(objectID)).then(function() {
        var deferred = Q.defer();
        that.collection.remove({
            _id: toObjectID(objectID)
        }, function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(true);
            }
        });
        return deferred.promise;
    });
};

/**
 * Finds and returns in a promise objects in the collection
 */
Collection.prototype.find = function(where, findOne) {
    var deferred = Q.defer();
    this.collection.find(where || {}).toArray(function(err, results) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(findOne ? (results.length > 0 ? results[0] : null) : results);
        }
    });
    return deferred.promise;
};

Collection.prototype.findById = function(objectID) {
    return this.find({
        _id: toObjectID(objectID)
    }, true);
};

Collection.prototype.count = function() {
    var deferred = Q.defer();
    this.collection.count(function(err, count) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(count);
        }
    });
    return deferred.promise;
};

/**
 * Adds a callback to execute before removing an object from the collection
 * @param  {Function} callback receives an objectID and a next function to be called once the callback is done
 */
Collection.prototype.preRemove = function(callback) {
    this.preRemoves.push(callback);
};

Collection.prototype.executePreRemove = function(objectID) {
    var deferred = Q.defer();

    var preRemoves = [];
    for (var i = 0; i < this.preRemoves.length; i++) {
        preRemoves.push(async.apply(this.preRemoves[i], objectID));
    }

    async.series(preRemoves, function(err, result) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(result);
        }
    });

    return deferred.promise;
};

var toObjectID = function(objectID) {
    try {
        return typeof objectID === 'string' ? new ObjectID(objectID) : objectID;
    } catch (err) {
        return null;
    }
};

module.exports = Collection;