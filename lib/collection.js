var Q = require('q'),
    ObjectID = require('mongodb').ObjectID;

/**
 * Create a collections whose methods always return a promise. You should pass a db object that implements the
 * collection method and the name of the collection. You can also pass a model a model for the inserts/updates.
 */
var Collection = function (db, name, model) {
    this.db = db;
    this.name = name;
    this.model = model;
    this.sort = {};
};

/***
 * @returns the mongo collection object
 */
Collection.prototype.collection = function () {
    return this.db.collection(this.name);
};

/**
 * Sets the validator for the inserts and updates of documents int he colleciton. The validator receives the document,
 * a boolean that is true for the insert option and false for the update option, and the id (ObjectID) of the document
 * if it is being updated.
 *
 * The validator can modify the document, and those modifications will be stored. It can return a value or a promise.
 * When the document is invalid, it should return a false value.
 */
Collection.prototype.setInsertValidator = function (validator) {
    this._insertValidator = validator;
};
/**
 * Sets the update validator
 */
Collection.prototype.setUpdateValidator = function (validator) {
    this._updateValidator = validator;
};

/**
 * Validates a document against the collection model
 */
Collection.prototype.validateModel = function (doc, insert) {
    if (!this.model) {
        return true;
    } else {
        return this._validateModel(this.model, doc, insert);
    }
};


Collection.prototype._validateModel = function (model, doc, insert) {
    // Check that all fields in the doc are in the model
    for (var field in doc) {
        if (!(field in model)) {
            return false;
        }
    }

    for (var key in model) {
        if (insert && model[key].required && !(key in doc)) {
            return false;
        }

        if (key in doc) {
            if (typeof doc[key] !== model[key].type) {
                return false;
            }

            if (typeof doc[key] === 'object') {
                if (model[key].class) {
                    return doc[key].constructor && doc[key].constructor.name === model[key].class;
                } else if (!this._validateModel(model[key].model, doc[key], insert)) {
                    return false;
                }
            }
        } else if (insert && model[key].default) {
            doc[key] = model[key].default;
        }
    }
    return true;
};

/**
 * Validates the document
 * @param doc the document to validate
 * @param insert if the document is going to be inserted (true) or updated (false)
 * @param id if the document is going to be update, this param holds the document id
 */
Collection.prototype.validate = function (doc, insert, id) {
    var validator = insert ? this._insertValidator : this._updateValidator;
    if (validator) {
        var that = this;
        return Q(validator(doc, id))
            .then(function (result) {
                if (!result || !that.validateModel(result, insert)) {
                    throw {
                        code: 'E_INVALID_DOCUMENT'
                    };
                } else {
                    return result;
                }
            });
    } else if (this.validateModel(doc, insert)) {
        return Q(doc);
    }

    return Q.fcall(function () {
        throw {
            code: 'E_INVALID_DOCUMENT'
        };
    });

};


/**
 * All documents retrieved will be filtered through this function. Can be use used to add/delete fields from the document.
 * Modifications must be done over the given document
 * @param {Function} filter receives a document, and returns the document filtered or a promise.
 */
Collection.prototype.setFilter = function (filter) {
    this._filter = filter;
};

/**
 * Filters a document with the current filter
 */
Collection.prototype.filter = function (doc) {
    if (this._filter) {
        return Q(this._filter(doc));
    } else {
        return Q(doc);
    }
};

/**
 * Inserts an object in the collection
 */
Collection.prototype.insert = function (document) {
    var that = this;
    return this.validate(document, true)
        .then(function (validated) {
            var deferred = Q.defer();
            that.collection().insertOne(validated, function (err, result) {
                if (err) {
                    deferred.reject(err);
                } else {
                    that.filter(result.ops[0]).then(function (filtered) {
                        deferred.resolve(filtered);
                    }).fail(function (err) {
                        deferred.reject(err);
                    });
                }
            });
            return deferred.promise;
        });
};


/**
 * A function to be executed before removing a document. The function receives the document id
 */
Collection.prototype.setPreRemove = function (preRemove) {
    this._preRemove = preRemove;
};

/**
 * Removes the object with the given objectID
 */
Collection.prototype.removeById = function (objectID) {
    var that = this;

    var promise;
    if (this._preRemove) {
        promise = Q(this._preRemove(toObjectID(objectID)));
    } else {
        promise = Q(true);
    }

    return promise.then(function () {
        var deferred = Q.defer();
        that.collection().findOneAndDelete({
            _id: toObjectID(objectID)
        }, function (err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                var value = result.value;
                that.filter(value).then(function (filtered) {
                    deferred.resolve(filtered);
                }).fail(function (err) {
                    deferred.reject(err);
                });
            }
        });
        return deferred.promise;
    });
};


/**
 * Removes objects in the collection
 * @param  {Object} where clause
 */
Collection.prototype.remove = function (where) {
    var that = this;
    return this.find(where || {}).then(function (results) {
        var removes = [];
        for (var i = 0; i < results.length; i++) {
            removes.push(that.removeById(results[i]._id));
        }
        return Q.all(removes);
    });
};

/**
 * Finds and returns in a promise objects in the collection
 */
Collection.prototype.find = function (where, findOne) {
    var deferred = Q.defer();
    var that = this;
    this.collection().find(where || {}).sort(this.sort).toArray(function (err, results) {
        if (err) {
            deferred.reject(err);
        } else {
            that.filterAll(results).then(function () {
                deferred.resolve(findOne ? (results.length > 0 ? results[0] : null) : results);
            }).fail(function (err) {
                deferred.reject(err);
            });
        }
    });
    return deferred.promise;
};

Collection.prototype.findById = function (objectID) {
    return this.find({
        _id: toObjectID(objectID)
    }, true);
};

/**
 * @param objectID the id of the object to modify
 * @param where (Optional) the where clause to find the object
 * @param set the update for the object
 * @returns {*|promise}
 */
Collection.prototype.findAndModify = function () {
    var where = arguments.length == 3 ? arguments[1] : {};
    var set = arguments.length == 2 ? arguments[1] : arguments[2];
    where._id = toObjectID(arguments[0]);

    var that = this;
    return this.validate(set, false, where._id).then(function (set) {
        var deferred = Q.defer();
        if (!set) {
            deferred.reject({
                status: 400,
                message: 'Invalid update'
            });
            return;
        }

        that.collection().findOneAndUpdate(where, {
            $set: set
        }, {
            upsert: false,
            returnOriginal: false
        }, function (err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                var value = result.value;
                that.filter(value).then(function (filtered) {
                    deferred.resolve(filtered);
                }).fail(function (err) {
                    deferred.reject(err);
                });
            }
        });
        return deferred.promise;
    });
};

Collection.prototype.count = function () {
    var deferred = Q.defer();
    this.collection().count(function (err, count) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(count);
        }
    });
    return deferred.promise;
};

var toObjectID = function (objectID) {
    try {
        return typeof objectID === 'string' ? new ObjectID(objectID) : objectID;
    } catch (err) {
        return null;
    }
};

Collection.prototype.toObjectID = function (objectID) {
    return toObjectID(objectID);
};

/**
 * Filters all docuemnts with the current filter.
 */
Collection.prototype.filterAll = function (docs) {
    var promises = [];
    for (var i = 0; i < docs.length; i++) {
        promises.push(this.filter(docs[i]));
    }
    return Q.all(promises);
};


Collection.exists = function (db, name) {
    var deferred = Q.defer();
    db.listCollections({name: name}).toArray(function (err, items) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(items.length === 1);
        }
    });
    return deferred.promise;
};

module.exports = Collection;