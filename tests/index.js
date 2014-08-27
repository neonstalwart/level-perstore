define(function (require) {
	var test = require('intern!object'),
		assert = require('intern/chai!assert'),
		Store = require('dojo/node!../index'),
		sinon = require('dojo/node!sinon'),
		dbUtil = require('./util/db'),
		Q = require('dojo/node!q'),
		Query = require('dojo/node!rql/query').Query,
		data = [
			{ id: 1, value: 'one' },
			{ id: 2, value: 'two' },
			{ id: 3, value: 'three' }
		],
		db,
		mockDb,
		mockStore,
		store;

	test({
		name: 'level-perstore Store API',

		// ensure we have a known db before we start
		before: function () {
			return dbUtil.destroy();
		},

		beforeEach: function () {
			mockDb = {
				get: sinon.stub()
			};

			db = dbUtil.create();
			store = new Store({ db: db });
			mockStore = new Store({ db: mockDb });
		},

		afterEach: function () {
			return Q.ninvoke(db, 'close').then(function () {
				return dbUtil.destroy();
			});
		},

		constructor: {
			'is a function': function () {
				assert.isFunction(Store, 'Store is a function');
			},

			'a db must be provided': function () {
				assert.throws(function () {
					return new Store();
				}, ReferenceError, 'A db must be provided to create a new level-perstore');
			},

			'returns Store instances': function () {
				/* jshint newcap:false */
				var store = Store({ db: mockDb });

				assert.instanceOf(store, Store, 'store is an instance of level-perstore');
			}
		},

		put: {
			'returns a promise': function () {
				var value = {
						id: 'foo',
						name: 'bar'
					},
					result = mockStore.put(value);

				assert.isFunction(result.then, 'store.put returns a promise');
			},

			'inserts new values': function () {
				var key = 'foo',
					value = {
						id: key,
						name: 'bar'
					};

				return store.put(value).then(function () {
						return Q.ninvoke(db, 'get', key);
					})
					.then(function (actual) {
						assert.deepEqual(actual, value, 'store.put should insert values into the db');
					});
			},

			'resolves to identifier of object': function () {
				var value = {
						name: 'bar'
					};

				return store.put(value).then(function (key) {
					return Q.ninvoke(db, 'get', key)
						.then(function (actual) {
							assert.strictEqual(actual.id,  key, 'key should be generated when not provided');
							assert.strictEqual(actual.name, value.name, 'store.put should resolve to the key');
						});
				});
			},

			options: {
				'overwrite: false fails if value already exists for key': function () {
					var options = {
							overwrite: false
						},
						key = 'foo',
						value = {
							id: key,
							name: 'bar'
						};

					return store.put(value).then(function () {
						return store.put(value, options);
					})
					.then(function () {
						assert.fail('overwrite: false should not overwrite an existing value');
					})
					.catch(function (err) {
						assert.propertyVal(err, 'code', 'EXISTS');
					});
				},

				'can add values in a tight loop': function () {
					var keys = [],
						numValues = 2000,
						options = {
							overwrite: false
						};

					while (numValues--) {
						keys.push(Math.random());
					}

					return Q.all(keys.map(function (key) {
							return store.put({
								id: key
							}, options);
						}))
						.then(function (actual) {
							assert.deepEqual(actual, keys, 'parallel adds should be possible');
						});
				},

				'id indicates key for object': function () {
					var key = 'foo',
						options = {
							id: key
						},
						value = {
							id: 'baz',
							name: 'bar'
						},
						expected = {
							id: key,
							name: 'bar'
						};

					return store.put(value, options).then(function () {
						return Q.ninvoke(db, 'get', key);
					})
					.then(function (actual) {
						assert.deepEqual(actual, expected, 'options.id should specify id of value');
					});
				}
			}
		},

		get: {
			'returns a promise': function () {
				var id = {},
					result = mockStore.get(id);

				assert.isFunction(result.then, 'store.get returns a promise');
			},

			'should call db.get with id': function () {
				var id = {};

				mockDb.get.yieldsAsync(null);

				return mockStore.get(id).then(function () {
					assert.ok(mockDb.get.calledWith(id), 'get should call db.get with id');
				});
			},

			'handles not found error': function () {
				var id = {};

				return store.get(id).then(function (obj) {
					assert.isUndefined(obj, 'non-matching id should return undefined');
				});
			},

			'returns value found at the requested key': function () {
				var key = 'foo',
					value = {
						id: key,
						name: 'bar'
					};

				return store.put(value)
					.then(function () {
						return store.get(key);
					})
					.then(function (actual) {
						assert.deepEqual(actual, value, 'store.get should retrieve values stored at key');
					});
			},

			'should always return new objects': function () {
				var key = 'foo',
					value = {
						id: key,
						name: 'bar'
					};

				return store.put(value)
					.then(function () {
						return Q.all([
							store.get(key),
							store.get(key)
						]);
					})
					.then(function (gets) {
						gets.reduce(function (one, another) {
							assert.notEqual(one, another, 'store.get should return new instances');
							return another;
						}, value);
					});
			}
		},

		delete: {
			'should remove an object from the db': function () {
				var key = 'foo',
					value = {
						id: key,
						name: 'bar'
					};

				return store.put(value)
					.then(function () {
						return store.delete(key);
					})
					.then(function () {
						return store.get(key);
					})
					.then(function (obj) {
						assert.isUndefined(obj, 'delete should remove objects from the db');
					});
			}
		},

		query: {
			beforeEach: function () {
				return Q.all(data.map(function (item) {
					store.put(item);
				}));
			},

			'returns a promise for the results': function () {
				var key = data[0].id,
					query = new Query().eq('id', key),
					results = store.query(query);

				assert.isFunction(results.then, 'query results should be a promise');

				return results.then(function (results) {
					assert.isArray(results, 'results should be an array');
					results.forEach(function (item) {
						assert.propertyVal(item, 'id', key, 'items should match query');
					});
				});
			},

			'limits results based on query': function () {
				var query = new Query().gt('id', 0).limit(2);

				return store.query(query).then(function (results) {
					results.forEach(function (item) {
						assert.ok(item.id > 0, 'items should match query');
					});
					assert.strictEqual(results.length, 2, 'query limit should be applied');
				});
			}

			// TODO: sort(?!)
		}
	});
});
