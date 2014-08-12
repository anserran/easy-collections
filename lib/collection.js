var Q = require('q');

var Collection = function(db, name) {
    this.db = db;
    this.collection = db.collection(name);
};

/**
 * Inserts an object in the collection. Returns a promise with the ObjectID of the recently
 * created object.
 */
Collection.prototype.insert = function(object) {
    var deferred = Q.defer();
    this.collection.insert(object, function(err, docs) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(docs[0]._id);
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
        _id: objectID
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

/**
 * Removes objects in the collection
 * @param  {Object} where clause
 */
Collection.prototype.remove = function(where) {
    var deferred = Q.defer();
    this.collection.remove(where, function(err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(true);
        }
    });
    return deferred.promise;
};

/**
 * Removes the object with the given objectID
 * @return {Object} a promise with the result
 */
Collection.prototype.removeById = function(objectID) {
    return this.remove({
        _id: objectID
    });
};

/**
 * Finds and returns in a promise objects in the collection
 */
Collection.prototype.find = function(where, findOne) {
    var deferred = Q.defer();
    this.collection.find(where).toArray(function(err, results) {
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
        _id: objectID
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

module.exports = Collection;