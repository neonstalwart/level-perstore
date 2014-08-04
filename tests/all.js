define(function (require) {
	var test = require('intern!object'),
		assert = require('intern/chai!assert'),
		Store = require('dojo/node!../index'),
		sinon = require('dojo/node!sinon'),
		LevelUp = require('dojo/node!levelup'),
		LevelDown = require('dojo/node!leveldown'),
		Q = require('dojo/node!q'),
		dbLocation = './tests/db',
		destroyDb = Q.nbind(LevelDown.destroy, LevelDown, dbLocation),
		dbOptions = {
			keyEncoding: 'json',
			valueEncoding: 'json'
		},
		db,
		mockDb,
		mockStore,
		store;

	test({
		name: 'level-perstore Store API',

		// ensure we have a known db before we start
		before: function () {
			return destroyDb();
		},

		beforeEach: function () {
			mockDb = {
				get: sinon.stub()
			};

			db = new LevelUp('./tests/db', dbOptions);
			store = new Store({ db: db });
			mockStore = new Store({ db: mockDb });
		},

		afterEach: function () {
			return Q.ninvoke(db, 'close').then(function () {
				return destroyDb();
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
						return Q.ninvoke(db,'get', key);
					})
					.then(function (actual) {
						assert.deepEqual(actual, value, 'store.put should insert values into the db');
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
				var store = new Store({ db: mockDb }),
					id = {},
					result = store.get(id);

				assert.isFunction(result.then, 'store.get returns a promise');
			},

			'should call db.get with id': function () {
				var store = new Store({
						db: mockDb
					}),
					id = {};

				mockDb.get.yieldsAsync(null);

				return store.get(id).then(function () {
					assert.ok(mockDb.get.calledWith(id), 'get should call db.get with id');
				});
			},

			'handles not found error': function () {
				var id = {},
					store = new Store({ db: db });

				return store.get(id).then(function (obj) {
					assert.isUndefined(obj, 'non-matching id should return undefined');
				});
			},

			'returns value found at the requested key': function () {
				var store = new Store({ db: db }),
					key = 'foo',
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
			}
		}
	});
});
