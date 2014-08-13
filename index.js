module.exports = Store;

var Q = require('q'),
	create = require('level-create'),
	retry = require('retry'),
	uuid = require('uuid'),
	createFilter = require('rql/js-array').query,
	IteratorReadStream = require('./IteratorReadStream');

function add(db, key, value) {
	var dfd = Q.defer(),
		operation = retry.operation();

	function resolve(value) {
		dfd.resolve(value);
	}

	function tryAgain(err) {
		// only retry if the db is locked
		if (err.code === 'LOCKED' && operation.retry(err)) {
			return;
		}

		dfd.reject(operation.mainError() || err);
	}

	operation.attempt(function () {
		Q.nfcall(create, db, key, value).then(resolve, tryAgain);
	});

	return dfd.promise;
}

function Store(options) {
	if (!options || !options.db) {
		throw new ReferenceError('A db must be provided to create a new level-perstore');
	}

	if (!(this instanceof Store)) {
		return new Store(options);
	}

	this.db = options.db;
}

Store.prototype = {
	constructor: Store,

	idProperty: 'id',

	get: function (id) {
		return Q.ninvoke(this.db, 'get', id).catch(function (err) {
			// notFound is not something to be considered an error in perstore
			if (err.notFound) {
				return;
			}
			throw err;
		});
	},

	put: function (value, options) {
		options = options || {};

		var dbOptions = {},
			idProperty = this.idProperty,
			key = 'id' in options ?
				// use the id provided in options and assign it to the value
				value[ idProperty ] = options.id :
				value[ idProperty ] != null ?
					// use the id in the value
					value[ idProperty ] :
					// create a new id
					value[ idProperty ] = uuid.v4(),
			db = this.db,
			result;

		dbOptions.sync = options.sync;

		result = options.overwrite === false ?
			// TODO: include dbOptions after https://github.com/substack/level-create/issues/1 is addressed
			// fail if a value alread exists at the key
			add(db, key, value) :
			// unconditionally write the value to the key
			Q.ninvoke(db, 'put', key, value, dbOptions);

		return result.then(function () {
			return key;
		});
	},

	delete: function (id, options) {
		options = options || {};

		var dbOptions = {
				sync: options.sync
			};

		return Q.ninvoke(this.db, 'del', id, dbOptions);
	},

	query: function (query, options) {
		options = options || {};

		var operators = options.operators || {},
			stream = new IteratorReadStream(this.db),
			stats = {
				count: 0,
				current: 0
			},
			range,
			filter;

		// intercept the limit operator to accomplish 2 things:
		// 1. extract the limit params
		// 2. prevent the filter applying the limit since we apply it to the stream directly
		operators.limit = function (count, start, maxCount) {
			if (!range) {
				range = {
					count: count,
					start: start,
					// TODO: what does maxCount represent?
					maxCount: maxCount
				};
			}

			return this;
		};

		filter = createFilter(query, {
			parameters: options.parameters,
			operators: operators
		});

		return stream.then(function (stream) {
			return Object.create(stream, {
				forEach: {
					value: function (write) {
						return stream.forEach(function (data) {
							var item = data.value,
								// filter the data first to trigger the operators.limit interception
								matches = filter([ item ]).length;

							if (matches) {
								// drop this value if we haven't reached the start of the range
								if (range && stats.current++ < range.start) {
									return;
								}
								write(item);
								// stop the stream if we got as many as were requested
								if (range && ++stats.count >= range.count) {
									stream.close();
								}
							}
						});
					}
				}
			});
		});
	}
};
